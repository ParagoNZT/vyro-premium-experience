import { z } from "zod";
import { api, identity, json, body, ApiError } from "./access.server";
import { database, logIfChanged, changed } from "./management.server";
import { showRegistration, showNeedsReview } from "./show-directory.server";

const change = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
  maxDevices: z.number().int().min(1).max(10),
  expiresAt: z.string().datetime().nullable(),
  note: z.string().trim().min(1).max(300),
});

export const betaRequest = api(async (request) => {
  const user = await identity(request, true);
  const db = await database();
  if (request.method === "POST") {
    const parsed = change.safeParse(await body(request));
    if (!parsed.success) throw new ApiError(400, "Vérifiez l’accès, la date et le motif.");
    const data = parsed.data;
    const expiry = data.expiresAt === null ? null : new Date(data.expiresAt).toISOString();
    if (data.enabled && expiry && Date.parse(expiry) <= Date.now()) {
      throw new ApiError(400, "Choisissez une date future ou désactivez l’accès.");
    }
    const linked = await db
      .prepare(
        `SELECT c.status FROM clients c JOIN licenses l ON l.client_id=c.id
      JOIN codes b ON b.code_hash=l.beta_code_hash WHERE b.id=?`,
      )
      .bind(data.id)
      .first<{ status: string }>();
    if (!linked) throw new ApiError(409, "Cet accès se gère dans VYRO Studio.");
    if (data.enabled && linked.status !== "active")
      throw new ApiError(409, "Réactivez d’abord la fiche client VYRO.");
    const result = await db.batch([
      db
        .prepare(
          `UPDATE codes SET enabled=?,max_devices=?,expires_at=? WHERE id=?
        AND EXISTS(SELECT 1 FROM licenses l JOIN clients c ON c.id=l.client_id
          WHERE l.beta_code_hash=codes.code_hash AND (?=0 OR c.status='active'))
        AND (SELECT count(*) FROM bindings WHERE code_hash=codes.code_hash)<=?`,
        )
        .bind(
          Number(data.enabled),
          data.maxDevices,
          expiry,
          data.id,
          Number(data.enabled),
          data.maxDevices,
        ),
      logIfChanged(db, user.id, "beta-access-updated", data.id, data.note),
    ]);
    if (!changed(result[0]))
      throw new ApiError(
        409,
        "L’accès a changé ou la limite est inférieure au nombre d’appareils liés.",
      );
    return json({ ok: true });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.floor(Math.max(0, Math.min(100000, Number(url.searchParams.get("page")) || 0)));
  const scope = url.searchParams.get("scope") ?? "all";
  const sort = url.searchParams.get("sort") ?? "recent";
  const partnerKind = scope.startsWith("partner:")
    ? "partner"
    : scope.startsWith("reseller:")
      ? "reseller"
      : null;
  const partnerId = partnerKind ? scope.slice(partnerKind.length + 1) : null;
  let scopeSql = "1=1";
  const scopeArgs: string[] = [];
  if (scope === "show-plus") scopeSql = showRegistration;
  else if (scope === "review") scopeSql = showNeedsReview;
  else if (scope === "direct")
    scopeSql = `c.reseller_id IS NULL AND a.id IS NULL AND NOT (${showRegistration}) AND NOT (${showNeedsReview})`;
  else if (partnerId && z.string().uuid().safeParse(partnerId).success) {
    scopeSql = partnerKind === "partner" ? "a.id=?" : "c.reseller_id=?";
    scopeArgs.push(partnerId);
  } else if (scope !== "all") throw new ApiError(400, "Filtre revendeur invalide.");
  if (sort !== "recent" && sort !== "name" && sort !== "reseller")
    throw new ApiError(400, "Tri invalide.");
  const order =
    sort === "reseller"
      ? "resellerName COLLATE NOCASE, c.name COLLATE NOCASE"
      : sort === "name"
        ? "c.name COLLATE NOCASE"
        : "c.created_at DESC";
  const [codes, stats, resellers] = await Promise.all([
    db
      .prepare(
        `SELECT c.id,c.name,c.enabled,c.max_devices AS maxDevices,c.expires_at AS expiresAt,
      CASE WHEN ${showRegistration} THEN 'SHOW+' ELSE coalesce(a.name,r.name) END AS resellerName,
      CASE WHEN ${showNeedsReview} THEN 1 ELSE 0 END AS needsReview,u.email AS clientEmail,
      CASE WHEN l.license_key IS NOT NULL THEN 1 ELSE 0 END AS hasRecoverableKey,
      CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END AS managedOnSite,
      (SELECT count(*) FROM bindings WHERE code_hash=c.code_hash) AS deviceCount,
      (SELECT max(last_seen) FROM device_profiles WHERE code_hash=c.code_hash) AS lastSeen
      FROM codes c LEFT JOIN resellers r ON r.id=c.reseller_id LEFT JOIN licenses l ON l.beta_code_hash=c.code_hash
      LEFT JOIN clients u ON u.id=l.client_id
      LEFT JOIN partner_app_devices p ON p.code_hash=c.code_hash
      LEFT JOIN partner_apps a ON a.id=p.app_id
      WHERE ${scopeSql} AND instr(lower(c.name||' '||coalesce(u.email,'')),lower(?))>0
      ORDER BY ${order},c.id LIMIT 51 OFFSET ?`,
      )
      .bind(...scopeArgs, search, page * 50)
      .all(),
    db
      .prepare(
        `SELECT (SELECT count(*) FROM codes) AS accesses,
      (SELECT count(*) FROM codes c WHERE enabled=1 AND (expires_at IS NULL OR expires_at>?)
      AND (reseller_id IS NULL OR EXISTS(SELECT 1 FROM resellers WHERE id=c.reseller_id AND enabled=1))) AS activeAccesses,
      (SELECT count(*) FROM bindings) AS devices`,
      )
      .bind(new Date().toISOString())
      .first(),
    db
      .prepare(
        `SELECT id,name,'reseller' AS kind FROM resellers
      UNION ALL SELECT id,name,'partner' AS kind FROM partner_apps WHERE id<>'show-plus'
      ORDER BY name COLLATE NOCASE,id`,
      )
      .all(),
  ]);
  return json({
    codes: codes.results.slice(0, 50),
    hasMore: codes.results.length > 50,
    page,
    stats,
    resellers: resellers.results,
  });
});
