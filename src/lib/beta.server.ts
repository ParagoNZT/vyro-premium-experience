import { z } from "zod";
import { api, identity, json, body, ApiError } from "./access.server";
import { database, logIfChanged, changed } from "./management.server";
import { showRegistration, showNeedsReview } from "./show-directory.server";

// One origin per code. A verified licence or an explicit assignment takes
// priority over a display-name prefix, which can be edited.
const accessOrigins = `
  WITH classified AS (
    SELECT c.id,c.code_hash,c.name,c.enabled,c.max_devices AS maxDevices,c.expires_at AS expiresAt,
      c.created_at AS createdAt,u.email AS clientEmail,r.enabled AS resellerEnabled,
      l.pack_name AS packName,
      CASE WHEN l.id IS NOT NULL THEN 'direct'
        WHEN c.reseller_id IS NOT NULL THEN 'reseller:'||c.reseller_id
        WHEN a.id='show-plus' THEN 'show-plus'
        WHEN a.id IS NOT NULL THEN 'partner:'||a.id
        WHEN ${showRegistration} THEN 'show-plus'
        WHEN ${showNeedsReview} THEN 'review'
        WHEN upper(trim(c.name))='SHOW+' THEN 'show-plus'
        ELSE 'direct' END AS scopeKey,
      coalesce(r.name,a.name) AS assignedName,
      CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END AS managedOnSite,
      CASE WHEN l.license_key IS NOT NULL THEN 1 ELSE 0 END AS hasRecoverableKey
    FROM codes c LEFT JOIN resellers r ON r.id=c.reseller_id
    LEFT JOIN licenses l ON l.beta_code_hash=c.code_hash LEFT JOIN clients u ON u.id=l.client_id
    LEFT JOIN partner_app_devices p ON p.code_hash=c.code_hash LEFT JOIN partner_apps a ON a.id=p.app_id
  ), origins AS (
    SELECT *,CASE WHEN scopeKey='show-plus' THEN 'SHOW+'
      WHEN scopeKey LIKE 'reseller:%' OR scopeKey LIKE 'partner:%' THEN assignedName END AS resellerName
    FROM classified
  )`;
const searchSql =
  "instr(lower(name||' '||coalesce(clientEmail,'')||' '||coalesce(resellerName,'')),lower(?))>0";

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
        `SELECT c.status,l.pack_id,b.max_devices AS maxDevices,b.expires_at AS expiresAt
      FROM clients c JOIN licenses l ON l.client_id=c.id
      JOIN codes b ON b.code_hash=l.beta_code_hash WHERE b.id=?`,
      )
      .bind(data.id)
      .first<{
        status: string;
        pack_id: string | null;
        maxDevices: number;
        expiresAt: string | null;
      }>();
    if (!linked) throw new ApiError(409, "Cet accès se gère dans VYRO Studio.");
    if (data.enabled && linked.status !== "active")
      throw new ApiError(409, "Réactivez d’abord la fiche client VYRO.");
    if (linked.pack_id && (expiry !== linked.expiresAt || data.maxDevices !== linked.maxDevices))
      throw new ApiError(
        409,
        "Pour changer l’échéance ou le quota d’un pack, passez par la licence du client.",
      );
    const result = await db.batch([
      db
        .prepare(
          `UPDATE codes SET enabled=?,max_devices=?,expires_at=? WHERE id=?
        AND EXISTS(SELECT 1 FROM licenses l JOIN clients c ON c.id=l.client_id
          WHERE l.beta_code_hash=codes.code_hash AND (?=0 OR c.status='active')
          AND (l.pack_id IS NULL OR (codes.max_devices=? AND codes.expires_at IS ?)))
        AND (SELECT count(*) FROM bindings WHERE code_hash=codes.code_hash)<=?`,
        )
        .bind(
          Number(data.enabled),
          data.maxDevices,
          expiry,
          data.id,
          Number(data.enabled),
          data.maxDevices,
          expiry,
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
  const showAccess = "scopeKey IN ('show-plus','review')";
  if (scope === "resellers") scopeSql = `(scopeKey LIKE 'reseller:%' OR ${showAccess})`;
  else if (scope === "partners") scopeSql = "scopeKey LIKE 'partner:%'";
  else if (scope === "show-plus") scopeSql = showAccess;
  else if (
    ["review", "direct"].includes(scope) ||
    (partnerId && z.string().uuid().safeParse(partnerId).success)
  ) {
    scopeSql = "scopeKey=?";
    scopeArgs.push(scope);
  } else if (scope !== "all") throw new ApiError(400, "Périmètre d’accès invalide.");
  if (sort !== "recent" && sort !== "name" && sort !== "reseller")
    throw new ApiError(400, "Tri invalide.");
  const order =
    sort === "reseller"
      ? "resellerName COLLATE NOCASE, name COLLATE NOCASE"
      : sort === "name"
        ? "name COLLATE NOCASE"
        : "createdAt DESC";
  const [codes, stats, resellers] = await Promise.all([
    db
      .prepare(
        `${accessOrigins}
      SELECT id,name,enabled,maxDevices,expiresAt,scopeKey,resellerName,clientEmail,hasRecoverableKey,managedOnSite,packName,
      (SELECT count(*) FROM bindings b WHERE b.code_hash=o.code_hash) AS deviceCount,
      (SELECT max(last_seen) FROM device_profiles d WHERE d.code_hash=o.code_hash) AS lastSeen
      FROM origins o WHERE ${scopeSql} AND ${searchSql}
      ORDER BY ${order},id LIMIT 51 OFFSET ?`,
      )
      .bind(...scopeArgs, search, page * 50)
      .all(),
    db
      .prepare(
        `${accessOrigins}
      SELECT count(*) AS accesses,
      coalesce(sum(enabled=1 AND (expiresAt IS NULL OR expiresAt>?) AND coalesce(resellerEnabled,1)=1),0) AS activeAccesses,
      coalesce(sum((SELECT count(*) FROM bindings b WHERE b.code_hash=o.code_hash)),0) AS devices
      FROM origins o WHERE ${scopeSql} AND ${searchSql}`,
      )
      .bind(new Date().toISOString(), ...scopeArgs, search)
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
