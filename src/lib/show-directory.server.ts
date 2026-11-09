import { ApiError, identity, api, json } from "./access.server.ts";
import type { ManagementDB } from "./db-types.ts";
import type { VerifiedIdentity } from "./admin-policy.ts";

// The SHOW+ registration records app provenance. A display name alone cannot
// grant access, and an explicit reseller assignment or VYRO license takes priority.
export const showRegistration = `c.reseller_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM licenses owned WHERE owned.beta_code_hash=c.code_hash)
  AND EXISTS (SELECT 1 FROM show_installations si WHERE si.code_hash=c.code_hash
    AND NOT EXISTS (SELECT 1 FROM licenses owned WHERE owned.beta_code_hash=si.legacy_code_hash)
    AND NOT EXISTS (SELECT 1 FROM codes legacy WHERE legacy.code_hash=si.legacy_code_hash
      AND legacy.reseller_id IS NOT NULL))`;
export const showLabel = "substr(upper(trim(c.name)),1,5)='SHOW+'";
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
  }[];
  total: number;
  page: number;
  hasMore: boolean;
};

export async function listShowCustomers(
  db: ManagementDB,
  user: VerifiedIdentity,
  query: URLSearchParams,
): Promise<ShowDirectoryPage> {
  const member = await db
    .prepare(
      "SELECT 1 AS allowed FROM show_reseller_memberships WHERE auth_user_id=? AND verified_email=? AND enabled=1",
    )
    .bind(user.id, user.email.trim().toLowerCase())
    .first();
  if (!member) throw new ApiError(403, "Cet espace est réservé aux revendeurs autorisés.");

  const page = Math.floor(Math.max(0, Math.min(100000, Number(query.get("page")) || 0)));
  const search = (query.get("q") ?? "").trim().slice(0, 80);
  const from = `FROM codes c JOIN show_installations s ON s.code_hash=c.code_hash
    LEFT JOIN show_management_installations m ON m.device_hash=s.device_hash
    LEFT JOIN show_management_accounts a ON a.id=m.account_id
    LEFT JOIN device_profiles d ON d.device_hash=s.device_hash AND d.code_hash=c.code_hash
    WHERE ${showRegistration} AND instr(lower(c.name||' '||coalesce(a.support_id,'')),lower(?))>0`;
  const [count, { results }] = await Promise.all([
    db.prepare(`SELECT count(*) AS total ${from}`).bind(search).first<{ total: number }>(),
    db
      .prepare(
        `SELECT c.id,c.name,a.support_id AS supportRef,
      (c.enabled=1 AND (c.expires_at IS NULL OR c.expires_at>?)) AS enabled,d.last_seen AS lastSeen
      ${from} ORDER BY coalesce(d.last_seen,s.created_at) DESC,c.id LIMIT 26 OFFSET ?`,
      )
      .bind(new Date().toISOString(), search, page * 25)
      .all<ShowDirectoryPage["devices"][number]>(),
  ]);
  return {
    devices: results.slice(0, 25),
    total: count?.total ?? 0,
    page,
    hasMore: results.length > 25,
  };
}

export const showDirectoryRequest = api(async (request) => {
  const user = await identity(request);
  const { database } = await import("./management.server");
  return json(await listShowCustomers(await database(), user, new URL(request.url).searchParams));
});
