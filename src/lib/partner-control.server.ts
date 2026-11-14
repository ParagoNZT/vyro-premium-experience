import { z } from "zod";
import { resellerCreationCents, resellerUpdatesCents } from "@/config/reseller-offer";
import { logoMaxBase64Length, validOrderLogo } from "./reseller-brand-draft";
import { api, ApiError, body, identity, json } from "./access.server";
import { database } from "./management.server";
import { appScope } from "./partner-scope";
import { assertPartnerAccess } from "./show-directory.server";
import type { ManagementDB } from "./db-types";

const appId = z.union([z.literal("show-plus"), z.string().uuid()]);
const accessId = z.string().uuid();
const rawUrl = z.string().trim().min(8).max(2048);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("order"),
    name: z.string().trim().min(2).max(60),
    packageName: z
      .string()
      .trim()
      .max(140)
      .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/),
    brief: z.string().trim().max(900).optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    updates: z.boolean().optional(),
    logoPng: z.string().max(logoMaxBase64Length).refine(validOrderLogo).optional(),
  }),
  z.object({ action: z.literal("renew"), app: appId }),
  z.object({
    action: z.literal("decision"),
    id: accessId,
    paid: z.boolean(),
    receipt: z.string().trim().min(4).max(160),
  }),
  z.object({ action: z.literal("server"), app: appId, url: rawUrl, confirmed: z.literal(true) }),
  z.object({
    action: z.literal("message"),
    app: appId,
    target: accessId,
    title: z.string().trim().min(2).max(100),
    message: z.string().trim().min(2).max(1000),
  }),
  z.object({
    action: z.literal("refresh"),
    app: appId,
    target: accessId,
    kind: z.enum(["playlist", "epg"]),
  }),
  z.object({
    action: z.literal("release"),
    app: appId,
    versionCode: z.number().int().positive().max(10_000_000),
    versionName: z.string().trim().min(1).max(40),
    url: rawUrl,
    sha256: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-f0-9]{64}$/),
    changelog: z.string().trim().max(1200),
    initial: z.boolean().optional(),
  }),
]);

export type PartnerApp = {
  id: string;
  name: string;
  packageName: string;
  serverUrl: string | null;
  coveredUntil: string | null;
  canPublish: number;
  apkUrl: string | null;
  version: string | null;
};
export type PartnerOrder = {
  id: string;
  email?: string;
  kind: "app" | "updates";
  name: string;
  packageName: string;
  cents: number;
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
  brief: string | null;
  accent: string | null;
  wantsUpdates: number;
  hasLogo: number;
  stage: "pending" | "preparing" | "delivered" | "covered" | "cancelled";
  deliveredAt: string | null;
};
export type PartnerOverview = { apps: PartnerApp[]; orders: PartnerOrder[]; hasMore?: boolean };
export type PartnerActivity = {
  recent: {
    id: string;
    kind: string;
    createdAt: string;
    state: "applied" | "failed" | "expired" | "queued" | "message";
  }[];
};

function safeUrl(value: string, server = false) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, "L’adresse HTTPS est invalide.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !url.hostname.includes(".") ||
    /^(\d+\.){3}\d+$|\.(localhost|local|internal|test|invalid)\.?$/i.test(url.hostname) ||
    (server && !!url.search)
  )
    throw new ApiError(400, "Utilisez un domaine HTTPS public, sans identifiants.");
  return server ? url.href.replace(/\/$/, "") : url.href;
}

function audit(
  db: ManagementDB,
  app: string,
  actor: string,
  action: string,
  target: string | null,
  now: string,
) {
  return db
    .prepare(
      `INSERT INTO partner_audit(id,app_id,actor_id,action,target,created_at)
    SELECT ?,?,?,?,?,? WHERE changes()>0`,
    )
    .bind(crypto.randomUUID(), app, actor, action, target, now);
}

export const partnerControlRequest = api(async (request) => {
  const params = new URL(request.url).searchParams;
  const admin = params.get("view") === "admin";
  const user = await identity(request, admin);
  const db = await database();
  const now = new Date().toISOString();
  if (request.method === "GET") {
    if (params.has("orderLogo")) {
      const orderId = accessId.safeParse(params.get("orderLogo"));
      if (!orderId.success) throw new ApiError(404, "Logo introuvable.");
      const order = await db
        .prepare(
          `SELECT logo_png AS logoPng FROM partner_orders WHERE id=?
          AND logo_png IS NOT NULL${admin ? "" : " AND owner_id=?"}`,
        )
        .bind(orderId.data, ...(admin ? [] : [user.id]))
        .first<{ logoPng: string }>();
      if (!order || !validOrderLogo(order.logoPng)) throw new ApiError(404, "Logo introuvable.");
      return json(order);
    }
    const app = params.get("app");
    if (app) {
      await assertPartnerAccess(db, user, app, admin);
      const target = accessId.safeParse(params.get("target"));
      const { results } = await db
        .prepare(
          `SELECT p.id,p.kind,p.created_at AS createdAt,
        CASE WHEN outcome IS NOT NULL THEN outcome WHEN expires_at<=? THEN 'expired' ELSE 'queued' END AS state
        FROM partner_commands p JOIN codes c ON c.code_hash=p.code_hash WHERE p.app_id=?
        AND (? IS NULL OR c.id=?) ORDER BY p.created_at DESC,p.id LIMIT 10`,
        )
        .bind(now, app, target.success ? target.data : null, target.success ? target.data : null)
        .all();
      return json({ recent: results });
    }
    const page = Math.max(0, Math.min(10000, parseInt(params.get("page") ?? "0", 10) || 0));
    const [apps, orders] = await Promise.all([
      db
        .prepare(
          `SELECT a.id,a.name,a.package_name AS packageName,
        coalesce(a.server_url,CASE WHEN a.id='show-plus' THEN (SELECT server_url FROM beta_settings WHERE id=1) END) AS serverUrl,
        (SELECT max(p.ends_at) FROM partner_update_periods p WHERE p.app_id=a.id) AS coveredUntil,
        (a.id='show-plus' OR EXISTS(SELECT 1 FROM partner_update_periods p WHERE p.app_id=a.id AND p.starts_at<=? AND p.ends_at>?)) AS canPublish,
        release.apk_url AS apkUrl,
        coalesce(release.version_name,
          CASE WHEN a.id='show-plus' THEN (SELECT version_name FROM beta_updates WHERE id=1) END) AS version
        FROM partner_apps a LEFT JOIN partner_releases release ON release.app_id=a.id AND release.version_code=(
          SELECT max(r.version_code) FROM partner_releases r WHERE r.app_id=a.id AND ${
            admin
              ? "1=1"
              : `(a.id='show-plus' OR r.initial=1 OR EXISTS(
              SELECT 1 FROM partner_update_periods p WHERE p.app_id=a.id
              AND r.published_at>=p.starts_at AND r.published_at<p.ends_at))`
          }
        ) WHERE ${
          admin
            ? "1=1"
            : `a.enabled=1 AND (a.owner_id=? OR (a.id='show-plus' AND EXISTS(
          SELECT 1 FROM show_reseller_memberships WHERE auth_user_id=? AND verified_email=? AND enabled=1)))`
        }
        ORDER BY a.name COLLATE NOCASE LIMIT 100`,
        )
        .bind(now, now, ...(admin ? [] : [user.id, user.id, user.email.trim().toLowerCase()]))
        .all<PartnerApp>(),
      db
        .prepare(
          `SELECT o.id,${admin ? "o.email," : ""}o.kind,coalesce(o.name,a.name) AS name,
        coalesce(o.package_name,a.package_name) AS packageName,o.cents,o.status,o.created_at AS createdAt,
        o.brief,o.accent,o.wants_updates AS wantsUpdates,(o.logo_png IS NOT NULL) AS hasLogo,
        (SELECT min(r.published_at) FROM partner_releases r WHERE r.app_id=o.app_id AND r.initial=1) AS deliveredAt,
        CASE WHEN o.status<>'paid' THEN o.status WHEN o.kind='updates' THEN 'covered'
          WHEN EXISTS(SELECT 1 FROM partner_releases r WHERE r.app_id=o.app_id AND r.initial=1) THEN 'delivered'
          ELSE 'preparing' END AS stage
        FROM partner_orders o LEFT JOIN partner_apps a ON a.id=o.app_id WHERE ${admin ? "1=1" : "o.owner_id=?"}
        ORDER BY (o.status='pending') DESC,o.created_at DESC,o.id LIMIT 26 OFFSET ?`,
        )
        .bind(...(admin ? [] : [user.id]), page * 25)
        .all<PartnerOrder>(),
    ]);
    return json({
      apps: apps.results,
      orders: orders.results.slice(0, 25),
      hasMore: orders.results.length > 25,
    });
  }
  const parsed = schema.safeParse(await body(request, logoMaxBase64Length + 16384));
  if (!parsed.success) throw new ApiError(400, "Vérifiez les informations saisies.");
  const value = parsed.data;
  if (value.action === "order") {
    if (/^(com\.vyro\.|android\.|com\.android\.)/.test(value.packageName))
      throw new ApiError(400, "Choisissez un identifiant Android propre à votre marque.");
    const id = crypto.randomUUID();
    const written = await db
      .prepare(
        `INSERT OR IGNORE INTO partner_orders
      (id,owner_id,email,kind,name,package_name,cents,created_at,brief,accent,wants_updates,logo_png)
      SELECT ?,?,?,'app',?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM partner_apps WHERE package_name=?)
      AND (SELECT count(*) FROM partner_orders WHERE owner_id=? AND kind='app' AND status='pending')<3`,
      )
      .bind(
        id,
        user.id,
        user.email,
        value.name,
        value.packageName,
        resellerCreationCents,
        now,
        value.brief || null,
        value.accent ?? null,
        value.updates ? 1 : 0,
        value.logoPng ?? null,
        value.packageName,
        user.id,
      )
      .run();
    if (!written.meta.changes)
      throw new ApiError(
        409,
        "Cet identifiant est déjà utilisé ou vous avez trop de demandes en cours.",
      );
    return json({ id }, 201);
  }
  if (value.action === "decision") {
    if (!admin) throw new ApiError(403, "Réservé à l’administration.");
    const id = crypto.randomUUID();
    const update = db
      .prepare(
        `UPDATE partner_orders SET status=?,paid_at=?,decided_by=?,receipt=?
      WHERE id=? AND status='pending'`,
      )
      .bind(
        value.paid ? "paid" : "cancelled",
        value.paid ? now : null,
        user.id,
        value.receipt,
        value.id,
      );
    const result = await db.batch(
      value.paid
        ? [
            update,
            db
              .prepare(
                `INSERT INTO partner_apps(id,owner_id,name,package_name)
        SELECT ?,owner_id,name,package_name FROM partner_orders
        WHERE id=? AND status='paid' AND kind='app' AND app_id IS NULL AND changes()>0`,
              )
              .bind(id, value.id),
            db
              .prepare(
                "UPDATE partner_orders SET app_id=? WHERE id=? AND kind='app' AND changes()>0",
              )
              .bind(id, value.id),
            db
              .prepare(
                `INSERT OR IGNORE INTO partner_update_periods(order_id,app_id,starts_at,ends_at)
        SELECT order_id,app_id,start,strftime('%Y-%m-%dT%H:%M:%fZ',start,'+1 year','floor') FROM (
          SELECT id AS order_id,app_id,max(?,coalesce((SELECT max(ends_at) FROM partner_update_periods p WHERE p.app_id=o.app_id),?)) AS start
          FROM partner_orders o WHERE id=? AND status='paid' AND kind='updates' AND paid_at=? )`,
              )
              .bind(now, now, value.id, now),
            db
              .prepare(
                `INSERT OR IGNORE INTO partner_orders(id,owner_id,email,kind,app_id,cents,created_at)
              SELECT ?,o.owner_id,o.email,'updates',o.app_id,?,? FROM partner_orders o
              WHERE o.id=? AND o.kind='app' AND o.status='paid' AND o.app_id=?
                AND o.wants_updates=1 AND o.paid_at=?`,
              )
              .bind(crypto.randomUUID(), resellerUpdatesCents, now, value.id, id, now),
          ]
        : [update],
    );
    if (!result[0]?.meta.changes) throw new ApiError(409, "Cette demande a déjà été traitée.");
    return json({ ok: true });
  }
  await assertPartnerAccess(db, user, value.app, admin);
  if (value.action === "renew") {
    if (value.app === "show-plus")
      throw new ApiError(409, "SHOW+ bénéficie déjà de son accès aux mises à jour.");
    const id = crypto.randomUUID();
    const written = await db
      .prepare(
        `INSERT OR IGNORE INTO partner_orders (id,owner_id,email,kind,app_id,cents,created_at)
      SELECT ?,owner_id,?,'updates',id,?,? FROM partner_apps WHERE id=? AND owner_id=?`,
      )
      .bind(id, user.email, resellerUpdatesCents, now, value.app, user.id)
      .run();
    if (!written.meta.changes)
      throw new ApiError(409, "Une demande de mises à jour est déjà en cours.");
    return json({ id }, 201);
  }
  if (value.action === "server") {
    const url = safeUrl(value.url, true);
    await db.batch([
      db
        .prepare(
          "UPDATE partner_apps SET server_url=?,server_updated_at=? WHERE id=? AND enabled=1",
        )
        .bind(url, now, value.app),
      audit(db, value.app, user.id, "server", null, now),
    ]);
    return json({ ok: true });
  }
  if (value.action === "release") {
    if (value.initial && (!admin || value.app === "show-plus"))
      throw new ApiError(403, "Seule l’administration peut livrer le premier APK.");
    const url = safeUrl(value.url);
    const released = db
      .prepare(
        `INSERT INTO partner_releases
      (app_id,version_code,version_name,apk_url,sha256,changelog,published_at,initial)
      SELECT a.id,?,?,?,?,?,?,? FROM partner_apps a WHERE a.id=? AND a.enabled=1
      AND ? > coalesce((SELECT max(r.version_code) FROM partner_releases r WHERE r.app_id=a.id),0)
      AND (a.id<>'show-plus' OR ? > coalesce((SELECT version_code FROM beta_updates WHERE id=1),0))
      AND ((?=1 AND NOT EXISTS(SELECT 1 FROM partner_releases r WHERE r.app_id=a.id))
        OR (?=0 AND (a.id='show-plus' OR (
          EXISTS(SELECT 1 FROM partner_releases r WHERE r.app_id=a.id AND r.initial=1)
          AND EXISTS(SELECT 1 FROM partner_update_periods p WHERE p.app_id=a.id AND p.starts_at<=? AND p.ends_at>?)))))`,
      )
      .bind(
        value.versionCode,
        value.versionName,
        url,
        value.sha256,
        value.changelog,
        now,
        Number(Boolean(value.initial)),
        value.app,
        value.versionCode,
        value.versionCode,
        Number(Boolean(value.initial)),
        Number(Boolean(value.initial)),
        now,
        now,
      );
    const statements = [
      released,
      audit(db, value.app, user.id, "release", String(value.versionCode), now),
    ];
    if (value.app === "show-plus")
      statements.push(
        db
          .prepare(
            `INSERT INTO beta_updates
      (id,version_code,version_name,changelog,sha256,updated_at,apk_url)
      SELECT 1,version_code,version_name,changelog,sha256,published_at,apk_url
      FROM partner_releases WHERE app_id='show-plus' AND version_code=? AND published_at=? AND changes()>0
      ON CONFLICT(id) DO UPDATE SET version_code=excluded.version_code,version_name=excluded.version_name,
        changelog=excluded.changelog,sha256=excluded.sha256,updated_at=excluded.updated_at,apk_url=excluded.apk_url`,
          )
          .bind(value.versionCode, now),
      );
    const [written] = await db.batch(statements);
    if (!written?.meta.changes)
      throw new ApiError(
        409,
        "Une période active et un numéro de version supérieur à la version publiée sont nécessaires.",
      );
    return json({ ok: true }, 201);
  }
  const scope = appScope(value.app);
  const id = crypto.randomUUID();
  const common = `FROM codes c WHERE c.id=? AND ${scope.sql} AND c.enabled=1 AND (c.expires_at IS NULL OR c.expires_at>?)`;
  const target = [value.target, ...scope.bindings, now];
  const write =
    value.action === "message"
      ? db
          .prepare(
            `INSERT INTO messages(id,target_code_hash,sender,title,body,created_at,expires_at)
      SELECT ?,c.code_hash,(SELECT name FROM partner_apps WHERE id=?),?,?,?,?
      ${common} AND (SELECT count(*) FROM messages WHERE target_code_hash=c.code_hash AND created_at>?)<12`,
          )
          .bind(
            id,
            value.app,
            value.title,
            value.message,
            now,
            new Date(Date.now() + 30 * 86400000).toISOString(),
            ...target,
            new Date(Date.now() - 86400000).toISOString(),
          )
      : db
          .prepare(
            `INSERT INTO partner_commands(id,app_id,code_hash,kind,created_at,expires_at)
      SELECT ?,?,c.code_hash,?,?,? ${common}
      AND EXISTS(SELECT 1 FROM partner_client_capabilities caps WHERE caps.code_hash=c.code_hash)
      AND NOT EXISTS(SELECT 1 FROM partner_commands p WHERE p.code_hash=c.code_hash AND p.kind=? AND p.expires_at>? AND p.completed_at IS NULL)`,
          )
          .bind(
            id,
            value.app,
            value.kind,
            now,
            new Date(Date.now() + 7 * 86400000).toISOString(),
            ...target,
            value.kind,
            now,
          );
  const [written] = await db.batch([
    write,
    audit(db, value.app, user.id, value.action, value.target, now),
  ]);
  if (!written?.meta.changes)
    throw new ApiError(409, "Appareil indisponible, incompatible ou demande déjà en attente.");
  return json({ id }, 201);
});
