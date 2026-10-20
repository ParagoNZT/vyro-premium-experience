import type { User } from "@supabase/supabase-js";
import type { ManagementDB } from "./db-types";
import type { ClientRow, LicenseRow, PaymentRow, AuditRow, AdminOverview } from "./management-types";
import { ApiError, api, body, identity, json } from "./access.server";
import { actionSchema, deviceSchema } from "./management-validation";
import { licenseUpsertSql } from "./license-sql";
import { getPlan, formatPrice } from "@/config/site";

export async function database(): Promise<ManagementDB> {
 const { env } = await import("cloudflare:workers");
 const db = env['VYRO_DB'] as ManagementDB | undefined;
 if (!db) throw new ApiError(503, "La base de gestion n’est pas encore reliée.");
 return db;
}
export async function trackClient(db: ManagementDB, user: User) {
 const now = new Date().toISOString();
 const email = user.email!.trim().toLowerCase();
 const name = typeof user.user_metadata['first_name'] === "string" ? user.user_metadata['first_name'].slice(0,80) : email.split("@")[0]!;
 await db.prepare("UPDATE clients SET email=?,first_name=?,last_seen_at=? WHERE auth_user_id=?").bind(email,name,now,user.id).run();
 await db.prepare(`INSERT INTO clients(id,auth_user_id,email,first_name,created_at,last_seen_at) VALUES(?,?,?,?,?,?)
 ON CONFLICT(email) DO UPDATE SET auth_user_id=excluded.auth_user_id,first_name=excluded.first_name,last_seen_at=excluded.last_seen_at
 WHERE clients.auth_user_id IS NULL OR clients.auth_user_id=excluded.auth_user_id`).bind(crypto.randomUUID(),user.id,email,name,now,now).run();
 const client = await db.prepare("SELECT * FROM clients WHERE auth_user_id=?").bind(user.id).first<ClientRow>();
 if (!client) throw new ApiError(403,"Cette adresse est déjà rattachée à un autre compte.");
 return client;
}
export const logStatement = (db: ManagementDB, actor: string, action: string, target: string, note: string) =>
 db.prepare("INSERT INTO audit_log(id,actor_id,action,target_id,note,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),actor,action,target,note,new Date().toISOString());

export function grantStatement(db: ManagementDB, clientId: string, planId: string, deviceLimit: number, paymentId: string | null) {
 const plan = getPlan(planId)!;
 const now = new Date().toISOString();
 return db.prepare(licenseUpsertSql).bind(crypto.randomUUID(),clientId,"VYRO-"+crypto.randomUUID().replaceAll("-","").toUpperCase(),planId,now,now,plan.months,deviceLimit,paymentId,now,clientId,paymentId,paymentId,plan.months);
}
export const manageRequest = api(async request => {
 const user = await identity(request,true);
 const db = await database();
 await trackClient(db,user);
 if (request.method === "GET") {
 const page = Math.max(0,Math.min(100000,Number(new URL(request.url).searchParams.get("page"))||0));
 const offset = Math.floor(page)*50;
 const [clients,licenses,payments,audit,totals] = await Promise.all([
 db.prepare("SELECT * FROM clients ORDER BY created_at DESC,id LIMIT 51 OFFSET ?").bind(offset).all<ClientRow>(),
 db.prepare("SELECT l.*,c.email FROM licenses l JOIN clients c ON c.id=l.client_id ORDER BY l.updated_at DESC,l.id LIMIT 51 OFFSET ?").bind(offset).all<LicenseRow>(),
 db.prepare("SELECT p.*,c.email FROM payments p JOIN clients c ON c.id=p.client_id ORDER BY p.created_at DESC,p.id LIMIT 51 OFFSET ?").bind(offset).all<PaymentRow>(),
 db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC,id LIMIT 51 OFFSET ?").bind(offset).all<AuditRow>(),
 db.prepare(`SELECT (SELECT count(*) FROM clients) as clients,
 (SELECT count(*) FROM licenses l JOIN clients c ON c.id=l.client_id WHERE l.status='active' AND c.status='active' AND l.expires_at>?) as activeLicenses,
 (SELECT coalesce(sum(amount_cents),0) FROM payments WHERE status='paid' AND livemode=1) as paidCents,
 (SELECT coalesce(sum(amount_cents),0) FROM payments WHERE status='paid' AND livemode=0) as testPaidCents`).bind(new Date().toISOString()).first<AdminOverview['stats']>(),
 ]);
 return json({clients:clients.results.slice(0,50),licenses:licenses.results.slice(0,50),payments:payments.results.slice(0,50),audit:audit.results.slice(0,50),stats:totals,
 stripe:{configured:Boolean(process.env['STRIPE_SECRET_KEY'] && process.env['STRIPE_WEBHOOK_SECRET']),live:process.env['STRIPE_SECRET_KEY']?.startsWith("sk_live_")??false},
 page:Math.floor(page),hasMore:[clients,licenses,payments,audit].some(v=>v.results.length>50)});
 }
 const parsed = actionSchema.safeParse(await body(request));
 if (!parsed.success) throw new ApiError(400,parsed.error.issues[0]?.message||"Vérifiez les champs.");
 const data=parsed.data;
 if (data.action==="create-client") {
 const existing=await db.prepare("SELECT id FROM clients WHERE email=?").bind(data.email).first();
 if (existing) throw new ApiError(409,"Cette fiche client existe déjà.");
 const id=crypto.randomUUID();
 await db.batch([db.prepare("INSERT INTO clients(id,email,first_name,created_at) VALUES(?,?,?,?)").bind(id,data.email,data.firstName,new Date().toISOString()),logStatement(db,user.id,"client-created",id,"Fiche client créée")]);
 } else if (data.action==="grant-license") {
 const client=await db.prepare("SELECT * FROM clients WHERE id=?").bind(data.clientId).first<ClientRow>();
 if (!client || client.status!=="active") throw new ApiError(409,"Client absent ou suspendu.");
 await db.batch([grantStatement(db,data.clientId,data.planId,data.deviceLimit,null),logStatement(db,user.id,"license-granted",data.clientId,data.note)]);
 } else if (data.action==="revoke-license") {
 const license=await db.prepare("SELECT id FROM licenses WHERE id=?").bind(data.licenseId).first();
 if (!license) throw new ApiError(404,"Licence introuvable.");
 await db.batch([db.prepare("UPDATE licenses SET status='revoked',updated_at=? WHERE id=?").bind(new Date().toISOString(),data.licenseId),logStatement(db,user.id,"license-revoked",data.licenseId,data.note)]);
 } else {
 const client=await db.prepare("SELECT * FROM clients WHERE id=?").bind(data.clientId).first<ClientRow>();
 if (!client) throw new ApiError(404,"Client introuvable.");
 if (client.auth_user_id===user.id) throw new ApiError(400,"Vous ne pouvez pas suspendre votre propre accès.");
 await db.batch([db.prepare("UPDATE clients SET status=? WHERE id=?").bind(data.status,data.clientId),logStatement(db,user.id,"client-"+data.status,data.clientId,data.note)]);
 }
 return json({ok:true});
});

export async function accountData(db: ManagementDB, client: ClientRow, user: User) {
 const [license,devices,orders] = await Promise.all([
 db.prepare("SELECT * FROM licenses WHERE client_id=?").bind(client.id).first<LicenseRow>(),
 db.prepare("SELECT id,name,platform,last_seen_at as lastSeen FROM devices WHERE client_id=? ORDER BY last_seen_at DESC").bind(client.id).all(),
 db.prepare("SELECT * FROM payments WHERE client_id=? AND status='paid' ORDER BY paid_at DESC LIMIT 100").bind(client.id).all<PaymentRow>(),
 ]);
 const active=client.status==="active" && license?.status==="active" && license.expires_at>new Date().toISOString();
 const plan=license ? getPlan(license.plan_id) : undefined;
 return {id:user.id,email:client.email,firstName:client.first_name,licenseKey:license?.license_key??"",
 subscription:license ? {planId:license.plan_id,planName:plan?.name??license.plan_id,status:active?"active":"expired",startedAt:license.started_at,expiresAt:license.expires_at,devicesUsed:devices.results.length,devicesAllowed:license.device_limit}:null,
 devices:devices.results,orders:orders.results.map(p=>({id:p.id,date:p.paid_at,planName:getPlan(p.plan_id)?.name??p.plan_id,amount:formatPrice(p.amount_cents/100),status:"paid"}))};
}
export const accountRequest=api(async request=>{
 const user=await identity(request);
 const db=await database();
 const client=await trackClient(db,user);
 if (client.status!=="active") throw new ApiError(403,"Votre accès au site est suspendu. Contactez le support.");
 if (request.method==="POST") {
 const parsed=deviceSchema.safeParse(await body(request));
 if (!parsed.success) throw new ApiError(400,"Vérifiez les informations de l’appareil.");
 const d=parsed.data;
 if (d.action==="remove") {
 await db.prepare("DELETE FROM devices WHERE id=? AND client_id=?").bind(d.id,client.id).run();
 } else {
 const result=await db.prepare(`INSERT INTO devices(id,client_id,name,platform,last_seen_at)
 SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM licenses l JOIN clients c ON c.id=l.client_id
 WHERE l.client_id=? AND l.status='active' AND c.status='active' AND l.expires_at>?
 AND (SELECT count(*) FROM devices WHERE client_id=?)<l.device_limit)
 ON CONFLICT(client_id,name) DO NOTHING`).bind(crypto.randomUUID(),client.id,d.name,d.platform,new Date().toISOString(),client.id,new Date().toISOString(),client.id).run();
 if (!result.meta.changes) throw new ApiError(409,"Licence inactive, appareil déjà enregistré ou limite d’appareils atteinte.");
 }
 }
 return json(await accountData(db,client,user));
});
