import { ApiError, identity, api, json } from "./access.server.ts";
import type { ManagementDB } from "./db-types.ts";
import type { VerifiedIdentity } from "./admin-policy.ts";
import { appScope, showLabel, showScope } from "./partner-scope.ts";

export const showRegistration = showScope;
export const showNeedsReview = `c.reseller_id IS NULL AND ${showLabel}
  AND NOT (${showRegistration})
  AND NOT EXISTS (SELECT 1 FROM licenses owned WHERE owned.beta_code_hash=c.code_hash)`;

export type ShowDirectoryPage = {
  devices: {
    id: string;
    name: string;
    supportRef: string | null;
    enabled: number;
    lastSeen: string | null;
    commandReady: boolean;
  }[];
  total: number;
  page: number;
  hasMore: boolean;
};

export async function listShowCustomers(
  db: ManagementDB,
  user: VerifiedIdentity,
  query: URLSearchParams,
  admin = false,
): Promise<ShowDirectoryPage> {
  const app = query.get("app") || "show-plus";
  await assertPartnerAccess(db, user, app, admin);

  const page = Math.floor(Math.max(0, Math.min(100000, Number(query.get("page")) || 0)));
  const search = (query.get("q") ?? "").trim().slice(0, 80);
  const scope = appScope(app);
  const from = `FROM codes c LEFT JOIN show_installations s ON s.code_hash=c.code_hash
    LEFT JOIN show_management_installations m ON m.device_hash=s.device_hash
    LEFT JOIN show_management_accounts a ON a.id=m.account_id
    WHERE ${scope.sql} AND instr(lower(c.name||' '||coalesce(a.support_id,'')),lower(?))>0`;
  const [count, { results }] = await Promise.all([
    db
      .prepare(`SELECT count(*) AS total ${from}`)
      .bind(...scope.bindings, search)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT c.id,c.name,a.support_id AS supportRef,
      (c.enabled=1 AND (c.expires_at IS NULL OR c.expires_at>?)) AS enabled,
      (SELECT max(d.last_seen) FROM device_profiles d WHERE d.code_hash=c.code_hash) AS lastSeen,
      EXISTS(SELECT 1 FROM partner_client_capabilities caps WHERE caps.code_hash=c.code_hash) AS commandReady
      ${from} ORDER BY coalesce(lastSeen,s.created_at,c.created_at) DESC,c.id LIMIT 26 OFFSET ?`,
      )
      .bind(new Date().toISOString(), ...scope.bindings, search, page * 25)
      .all<ShowDirectoryPage["devices"][number]>(),
  ]);
  return {
    devices: results.slice(0, 25),
    total: count?.total ?? 0,
    page,
    hasMore: results.length > 25,
  };
}

export async function assertPartnerAccess(
  db: ManagementDB,
  user: VerifiedIdentity,
  app: string,
  admin = false,
) {
  if (!/^(show-plus|[a-f0-9-]{36})$/.test(app)) throw new ApiError(400, "Application invalide.");
  if (admin) {
    const exists = await db.prepare("SELECT id FROM partner_apps WHERE id=?").bind(app).first();
    if (!exists) throw new ApiError(404, "Application introuvable.");
    return;
  }
  const member = await db
    .prepare(
      `SELECT id FROM partner_apps WHERE id=? AND enabled=1 AND
        ((id<>'show-plus' AND owner_id=?) OR (id='show-plus' AND EXISTS(
          SELECT 1 FROM show_reseller_memberships WHERE auth_user_id=? AND verified_email=? AND enabled=1)))`,
    )
    .bind(app, user.id, user.id, user.email.trim().toLowerCase())
    .first();
  if (!member) throw new ApiError(403, "Cet espace est réservé aux revendeurs autorisés.");
}

export const showDirectoryRequest = api(async (request) => {
  const query = new URL(request.url).searchParams;
  const admin = query.get("view") === "admin";
  const user = await identity(request, admin);
  const { database } = await import("./management.server");
  return json(await listShowCustomers(await database(), user, query, admin));
});
