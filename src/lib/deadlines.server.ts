import { z } from "zod";
import { api, ApiError, identity, json } from "./access.server";
import { database } from "./management.server";
import { showScope } from "./partner-scope";

const filters = z.object({
  kind: z.enum(["all", "license", "access", "updates"]).default("all"),
  horizon: z.enum(["7", "30", "90", "expired"]).default("30"),
  owner: z.string().max(90).default(""),
  query: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(0).max(10000).default(0),
});
export type Deadline = {
  kind: "license" | "access" | "updates";
  id: string;
  name: string;
  contact: string | null;
  owner: string;
  expiresAt: string;
};
export type DeadlinePage = {
  rows: Deadline[];
  owners: { id: string; name: string }[];
  hasMore: boolean;
};

export const adminDeadlines = api(async (request) => {
  await identity(request, true);
  const input = filters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!input.success) throw new ApiError(400, "Filtres d’échéance invalides.");
  const { kind, horizon, owner, query, page } = input.data;
  const db = await database();
  const now = new Date();
  const upper = horizon === "expired" ? now : new Date(now.getTime() + Number(horizon) * 86400_000);
  const [result, resellers] = await Promise.all([
    db
      .prepare(
        `WITH expiry AS (
      SELECT 'license' AS kind,l.id,coalesce(nullif(u.first_name,''),u.email) AS name,
        u.email AS contact,'direct' AS scope,'Client direct' AS owner,l.expires_at AS expiresAt
      FROM licenses l JOIN clients u ON u.id=l.client_id
      WHERE l.status='active' AND u.status='active' AND l.expires_at<'9999'
      UNION ALL
      SELECT 'access',c.id,c.name,NULL,
        CASE WHEN r.id IS NOT NULL THEN 'r:'||r.id WHEN a.id IS NOT NULL THEN 'app:'||a.id
          WHEN ${showScope} THEN 'app:show-plus' ELSE 'direct' END,
        coalesce(r.name,a.name,CASE WHEN ${showScope} THEN 'SHOW+' END,'Client direct'),c.expires_at
      FROM codes c LEFT JOIN resellers r ON r.id=c.reseller_id
      LEFT JOIN partner_app_devices d ON d.code_hash=c.code_hash
      LEFT JOIN partner_apps a ON a.id=d.app_id
      WHERE c.enabled=1 AND c.expires_at IS NOT NULL AND coalesce(r.enabled,1)=1
      AND NOT EXISTS(SELECT 1 FROM licenses l WHERE l.beta_code_hash=c.code_hash)
      UNION ALL
      SELECT 'updates',a.id,a.name,(SELECT o.email FROM partner_orders o WHERE o.app_id=a.id
        AND o.status='paid' ORDER BY o.created_at DESC,o.id LIMIT 1),
        'partners','Marque blanche',max(p.ends_at)
      FROM partner_apps a JOIN partner_update_periods p ON p.app_id=a.id
      WHERE a.enabled=1 AND a.id<>'show-plus' GROUP BY a.id
    )
    SELECT kind,id,name,contact,owner,expiresAt FROM expiry
    WHERE (?1='all' OR kind=?1) AND (?2='' OR scope=?2)
    AND (instr(lower(name),lower(?3))>0 OR instr(lower(coalesce(contact,'')),lower(?3))>0
         OR instr(lower(owner),lower(?3))>0)
    AND ((?4=1 AND expiresAt<=?5) OR (?4=0 AND expiresAt>?5 AND expiresAt<=?6))
    ORDER BY CASE WHEN ?4=0 THEN expiresAt END,CASE WHEN ?4=1 THEN expiresAt END DESC,kind,id
    LIMIT 51 OFFSET ?7`,
      )
      .bind(
        kind,
        owner,
        query,
        horizon === "expired" ? 1 : 0,
        now.toISOString(),
        upper.toISOString(),
        page * 50,
      )
      .all<Deadline>(),
    db
      .prepare(
        `SELECT id,name FROM (
          SELECT 'r:'||id AS id,name FROM resellers WHERE enabled=1
          UNION ALL SELECT 'app:'||id,name FROM partner_apps WHERE enabled=1
        ) ORDER BY name COLLATE NOCASE LIMIT 250`,
      )
      .all<{ id: string; name: string }>(),
  ]);
  return json({
    rows: result.results.slice(0, 50),
    owners: [
      { id: "direct", name: "Clients directs" },
      { id: "partners", name: "Marque blanche" },
      ...resellers.results,
    ],
    hasMore: result.results.length > 50,
  });
});
