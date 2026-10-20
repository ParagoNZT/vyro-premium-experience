import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { licenseUpsertSql } from "./license-sql.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";
import { actionSchema } from "./management-validation.ts";
function setup(){
 const db=new DatabaseSync(":memory:");
 db.exec(readFileSync(new URL("../../migrations/d1/0001_management.sql",import.meta.url),"utf8"));
 db.prepare("INSERT INTO clients(id,email,first_name,created_at) VALUES(?,?,?,?)").run("client","client@example.com","Client","2026-01-01T00:00:00.000Z");
 return db;
}
function grant(db:DatabaseSync, now:string, months:number, payment:string|null=null){
 return db.prepare(licenseUpsertSql).run("lic","client","VYRO-TEST","3m",now,now,months,3,payment,now,"client",payment,payment,months);
}
test("calendar duration clamps January 31 to April 30 and renewal extends the existing expiry",()=>{
 const db=setup(); grant(db,"2026-01-31T10:00:00.000Z",3);
 assert.equal(db.prepare("SELECT expires_at FROM licenses").get()!['expires_at'],"2026-04-30T10:00:00.000Z");
 grant(db,"2026-02-01T10:00:00.000Z",3);
 assert.equal(db.prepare("SELECT expires_at FROM licenses").get()!['expires_at'],"2026-07-30T10:00:00.000Z");
 db.close();
});
test("duplicate paid events do not extend the licence twice",()=>{
 const db=setup();
 db.prepare("INSERT INTO payments(id,client_id,plan_id,amount_cents,created_at,request_key) VALUES('pay','client','3m',2490,'2026-01-01','request')").run();
 db.exec("BEGIN"); grant(db,"2026-01-01T10:00:00.000Z",3,"pay"); db.exec("UPDATE payments SET status='paid' WHERE id='pay'; COMMIT");
 const before=db.prepare("SELECT expires_at FROM licenses").get()!['expires_at'];
 grant(db,"2026-01-02T10:00:00.000Z",3,"pay");
 assert.equal(db.prepare("SELECT expires_at FROM licenses").get()!['expires_at'],before);
 db.close();
});
test("unpaid unknown orders cannot provision access; revoked access starts anew",()=>{
 const db=setup();
 grant(db,"2026-01-01T10:00:00.000Z",3,"unknown");
 assert.equal(db.prepare("SELECT count(*) as n FROM licenses").get()!['n'],0);
 grant(db,"2026-01-01T10:00:00.000Z",12);
 db.exec("UPDATE licenses SET status='revoked'");
 grant(db,"2026-02-01T10:00:00.000Z",3);
 assert.equal(db.prepare("SELECT expires_at FROM licenses").get()!['expires_at'],"2026-05-01T10:00:00.000Z");
 db.close();
});
test("validation rejects arbitrary plans, limits, and missing reasons",()=>{
 assert.equal(actionSchema.safeParse({action:"grant-license",clientId:crypto.randomUUID(),planId:"free",deviceLimit:100,note:""}).success,false);
 assert.equal(actionSchema.safeParse({action:"client-status",clientId:crypto.randomUUID(),status:"admin",note:"spoof"}).success,false);
});
test("Stripe signature checks raw body, freshness, and rotated signatures",async()=>{
 const raw='{"id":"evt_test","type":"checkout.session.completed"}';
 const secret="fixture-secret"; const now=1792500000000; const t=String(now/1000);
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=Buffer.from(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(t+"."+raw))).toString("hex");
 assert.equal(await verifyStripeSignature(raw,"t="+t+",v1="+sig,secret,now),true);
 assert.equal(await verifyStripeSignature(raw+" ","t="+t+",v1="+sig,secret,now),false);
 assert.equal(await verifyStripeSignature(raw,"t="+t+",v1="+sig,secret,now+301000),false);
 assert.equal(await verifyStripeSignature(raw,"t="+t+",v1="+"0".repeat(64)+",v1="+sig,secret,now),true);
 assert.equal(await verifyStripeSignature(raw,null,secret,now),false);
});
