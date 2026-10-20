import { z } from "zod";
import { api, identity, json, body, ApiError } from "./access.server";
import { database, logStatement } from "./management.server";
const change=z.object({id:z.string().uuid(),enabled:z.boolean(),maxDevices:z.number().int().min(1).max(10),expiresAt:z.string().datetime().nullable(),note:z.string().trim().min(1).max(300)});
export const betaRequest=api(async request=>{
 const user=await identity(request,true); const db=await database();
 if(request.method==="POST"){
  const parsed=change.safeParse(await body(request)); if(!parsed.success)throw new ApiError(400,"Vérifiez l’accès, la date et le motif.");
  const d=parsed.data;
  if(d.enabled && d.expiresAt && d.expiresAt<=new Date().toISOString())throw new ApiError(400,"Choisissez une date future ou désactivez l’accès.");
  const code=await db.prepare("SELECT id FROM codes WHERE id=?").bind(d.id).first();
  if(!code)throw new ApiError(404,"Accès introuvable.");
  const client=await db.prepare("SELECT c.status FROM clients c JOIN licenses l ON l.client_id=c.id JOIN codes b ON b.code_hash=l.beta_code_hash WHERE b.id=?").bind(d.id).first<{status:string}>();
  if(d.enabled && client?.status==="suspended")throw new ApiError(409,"Réactivez d’abord la fiche client VYRO.");
  const expiry=d.expiresAt;
  await db.batch([
   db.prepare(`UPDATE codes SET enabled=?,max_devices=?,expires_at=? WHERE id=?
    AND (SELECT count(*) FROM bindings WHERE code_hash=codes.code_hash)<=?`).bind(Number(d.enabled),d.maxDevices,expiry,d.id,d.maxDevices),
   logStatement(db,user.id,"beta-access-change-requested",d.id,d.note),
  ]);
  const result=await db.prepare("SELECT enabled,max_devices,expires_at FROM codes WHERE id=?").bind(d.id).first<{enabled:number;max_devices:number;expires_at:string|null}>();
  if(result?.enabled!==Number(d.enabled)||result?.max_devices!==d.maxDevices||result?.expires_at!==expiry)throw new ApiError(409,"La limite est inférieure au nombre d’appareils liés. Retirez d’abord les appareils nécessaires dans le panel.");
  return json({ok:true});
 }
 const url=new URL(request.url); const search=(url.searchParams.get("q")||"").trim().slice(0,80);
 const page=Math.max(0,Math.min(100000,Math.floor(Number(url.searchParams.get("page"))||0)));
 const [codes,stats]=await Promise.all([
  db.prepare(`SELECT c.id,c.name,c.enabled,c.max_devices AS maxDevices,c.expires_at AS expiresAt,
   r.name AS resellerName,u.email AS clientEmail,
   (SELECT count(*) FROM bindings WHERE code_hash=c.code_hash) AS deviceCount,
   (SELECT max(last_seen) FROM device_profiles WHERE code_hash=c.code_hash) AS lastSeen
   FROM codes c LEFT JOIN resellers r ON r.id=c.reseller_id LEFT JOIN licenses l ON l.beta_code_hash=c.code_hash
   LEFT JOIN clients u ON u.id=l.client_id
   WHERE instr(lower(c.name||' '||coalesce(u.email,'')),lower(?))>0 ORDER BY c.created_at DESC,c.id LIMIT 51 OFFSET ?`).bind(search,page*50).all(),
  db.prepare(`SELECT (SELECT count(*) FROM codes) AS accesses,
   (SELECT count(*) FROM codes c WHERE enabled=1 AND (expires_at IS NULL OR expires_at>?)
   AND (reseller_id IS NULL OR EXISTS(SELECT 1 FROM resellers WHERE id=c.reseller_id AND enabled=1))) AS activeAccesses,
   (SELECT count(*) FROM bindings) AS devices`).bind(new Date().toISOString()).first(),
 ]);
 return json({codes:codes.results.slice(0,50),hasMore:codes.results.length>50,page,stats});
});
