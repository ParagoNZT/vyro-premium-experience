import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { licenseUpsertSql } from "./license-sql.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";
import { actionSchema } from "./management-validation.ts";
import { expiryAfterParisDay, parisDateInput } from "./license-dates.ts";
import {
  attachPaymentSql,
  suppressRefundedFulfillmentSql,
  recordGrantSql,
  finalizePaymentSql,
  recordRefundSql,
  revokeSoleGrantSql,
  finalizeRefundSql,
} from "./stripe-ledger-sql.ts";

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(new URL("../../migrations/d1/0001_management.sql", import.meta.url), "utf8"),
  );
  db.exec(readFileSync(new URL("../../tests/fixtures/beta-schema.sql", import.meta.url), "utf8"));
  db.exec(
    readFileSync(
      new URL("../../migrations/d1/0002_shared_beta_access.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    readFileSync(
      new URL("../../migrations/d1/0003_stripe_fulfillment.sql", import.meta.url),
      "utf8",
    ),
  );
  db.prepare(
    "INSERT INTO clients(id,auth_user_id,email,first_name,created_at) VALUES(?,?,?,?,?)",
  ).run("client", "auth-client", "client@example.com", "Client", "2026-01-01T00:00:00.000Z");
  db.exec(
    readFileSync(
      new URL("../../migrations/d1/0014_admin_delegation_and_license_expiry.sql", import.meta.url),
      "utf8",
    ),
  );
  return db;
}

test("a custom expiry includes the last day in Paris in winter, summer and after DST changes", () => {
  assert.equal(expiryAfterParisDay("2026-11-10"), "2026-11-10T23:00:00.000Z");
  assert.equal(expiryAfterParisDay("2026-08-02"), "2026-08-02T22:00:00.000Z");
  assert.equal(expiryAfterParisDay("2026-03-29"), "2026-03-29T22:00:00.000Z");
  assert.equal(expiryAfterParisDay("2026-10-25"), "2026-10-25T23:00:00.000Z");
  assert.equal(parisDateInput(Date.parse("2026-11-10T23:00:00.000Z")), "2026-11-11");
  assert.equal(
    actionSchema.safeParse({
      action: "grant-license-until",
      clientId: crypto.randomUUID(),
      through: "2026-02-29",
      deviceLimit: 3,
      note: "Essai",
    }).success,
    false,
  );
});
function grant(db: DatabaseSync, now: string, months: number, payment: string | null = null) {
  return db
    .prepare(licenseUpsertSql)
    .run(
      "lic",
      "client",
      "VYRO-" + "A".repeat(24),
      "3m",
      now,
      now,
      months,
      3,
      payment,
      now,
      "a".repeat(64),
      "client",
      payment,
      payment,
      payment,
      "client",
      payment && "cs_" + payment,
      payment && "pi_" + payment,
      months,
    );
}
test("calendar duration clamps January 31 to April 30 and renewal extends the existing expiry", () => {
  const db = setup();
  grant(db, "2026-01-31T10:00:00.000Z", 3);
  assert.equal(
    db.prepare("SELECT expires_at FROM licenses").get()!["expires_at"],
    "2026-04-30T10:00:00.000Z",
  );
  grant(db, "2026-02-01T10:00:00.000Z", 3);
  assert.equal(
    db.prepare("SELECT expires_at FROM licenses").get()!["expires_at"],
    "2026-07-30T10:00:00.000Z",
  );
  db.close();
});
test("duplicate paid events do not extend the licence twice", () => {
  const db = setup();
  db.prepare(
    "INSERT INTO payments(id,client_id,plan_id,amount_cents,created_at,request_key,livemode,stripe_session_id,stripe_payment_intent) VALUES('pay','client','3m',2490,'2026-01-01','request',1,'cs_pay','pi_pay')",
  ).run();
  db.exec("BEGIN");
  grant(db, "2026-01-01T10:00:00.000Z", 3, "pay");
  db.exec("UPDATE payments SET status='paid' WHERE id='pay'; COMMIT");
  const before = db.prepare("SELECT expires_at FROM licenses").get()!["expires_at"];
  grant(db, "2026-01-02T10:00:00.000Z", 3, "pay");
  assert.equal(db.prepare("SELECT expires_at FROM licenses").get()!["expires_at"], before);
  db.close();
});
test("unpaid unknown orders cannot provision access; revoked access starts anew", () => {
  const db = setup();
  grant(db, "2026-01-01T10:00:00.000Z", 3, "unknown");
  assert.equal(db.prepare("SELECT count(*) as n FROM licenses").get()!["n"], 0);
  grant(db, "2026-01-01T10:00:00.000Z", 12);
  db.exec("UPDATE licenses SET status='revoked'");
  grant(db, "2026-02-01T10:00:00.000Z", 3);
  assert.equal(
    db.prepare("SELECT expires_at FROM licenses").get()!["expires_at"],
    "2026-05-01T10:00:00.000Z",
  );
  db.close();
});
test("validation rejects arbitrary plans, limits, and missing reasons", () => {
  assert.equal(
    actionSchema.safeParse({
      action: "grant-license",
      clientId: crypto.randomUUID(),
      planId: "free",
      deviceLimit: 100,
      note: "",
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      action: "client-status",
      clientId: crypto.randomUUID(),
      status: "admin",
      note: "spoof",
    }).success,
    false,
  );
});
test("Stripe signature checks raw body, freshness, and rotated signatures", async () => {
  const raw = '{"id":"evt_test","type":"checkout.session.completed"}';
  const secret = "fixture-secret";
  const now = 1792500000000;
  const t = String(now / 1000);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + raw)),
  ).toString("hex");
  assert.equal(await verifyStripeSignature(raw, "t=" + t + ",v1=" + sig, secret, now), true);
  assert.equal(await verifyStripeSignature(raw + " ", "t=" + t + ",v1=" + sig, secret, now), false);
  assert.equal(
    await verifyStripeSignature(raw, "t=" + t + ",v1=" + sig, secret, now + 301000),
    false,
  );
  assert.equal(
    await verifyStripeSignature(
      raw,
      "t=" + t + ",v1=" + "0".repeat(64) + ",v1=" + sig,
      secret,
      now,
    ),
    true,
  );
  assert.equal(await verifyStripeSignature(raw, null, secret, now), false);
});

test("web licence provisions a TV code without changing existing beta testers", () => {
  const db = setup();
  db.prepare(
    "INSERT INTO codes(id,code_hash,name,max_devices,created_at) VALUES('legacy',?,'Existing beta',2,'2026-01-01')",
  ).run("b".repeat(64));
  db.prepare("INSERT INTO bindings(code_hash,device_hash,created_at) VALUES(?,?,'2026-01-01')").run(
    "b".repeat(64),
    "c".repeat(64),
  );
  grant(db, "2026-01-01T10:00:00.000Z", 3);
  const code = db.prepare("SELECT * FROM codes WHERE id='lic'").get()!;
  assert.equal(code["code_hash"], "a".repeat(64));
  assert.equal(code["enabled"], 1);
  assert.equal(code["max_devices"], 3);
  db.exec("UPDATE codes SET expires_at='2027-01-01T00:00:00.000Z',max_devices=5 WHERE id='lic'");
  const licence = db.prepare("SELECT * FROM licenses WHERE id='lic'").get()!;
  assert.equal(licence["expires_at"], "2027-01-01T00:00:00.000Z");
  assert.equal(licence["device_limit"], 5);
  assert.equal(db.prepare("SELECT enabled FROM codes WHERE id='legacy'").get()!["enabled"], 1);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM bindings WHERE code_hash=?").get("b".repeat(64))!["n"],
    1,
  );
  db.close();
});
test("suspension blocks TV and cannot be bypassed by re-enabling it in the beta panel", () => {
  const db = setup();
  db.exec("PRAGMA recursive_triggers=ON");
  grant(db, "2026-01-01T10:00:00.000Z", 3);
  db.exec("UPDATE clients SET status='suspended' WHERE id='client'");
  assert.equal(db.prepare("SELECT enabled FROM codes WHERE id='lic'").get()!["enabled"], 0);
  assert.equal(db.prepare("SELECT status FROM licenses WHERE id='lic'").get()!["status"], "active");
  db.exec("UPDATE codes SET enabled=1 WHERE id='lic'");
  assert.equal(db.prepare("SELECT enabled FROM codes WHERE id='lic'").get()!["enabled"], 0);
  db.exec("UPDATE clients SET status='active' WHERE id='client'");
  assert.equal(db.prepare("SELECT enabled FROM codes WHERE id='lic'").get()!["enabled"], 1);
  db.exec("UPDATE codes SET enabled=0 WHERE id='lic'");
  assert.equal(
    db.prepare("SELECT status FROM licenses WHERE id='lic'").get()!["status"],
    "revoked",
  );
  db.close();
});
test("renewal preserves the TV key and bound devices; deleting an access revokes its web licence", () => {
  const db = setup();
  grant(db, "2026-01-01T10:00:00.000Z", 3);
  db.prepare("INSERT INTO bindings(code_hash,device_hash,created_at) VALUES(?,?,'2026-01-01')").run(
    "a".repeat(64),
    "c".repeat(64),
  );
  grant(db, "2026-02-01T10:00:00.000Z", 3);
  assert.equal(db.prepare("SELECT count(*) AS n FROM codes").get()!["n"], 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM bindings").get()!["n"], 1);
  db.exec("DELETE FROM codes WHERE id='lic'");
  const licence = db.prepare("SELECT * FROM licenses").get()!;
  assert.equal(licence["status"], "revoked");
  assert.equal(licence["beta_code_hash"], null);
  db.close();
});
test("removing a TV expiry preserves unlimited access without a trigger loop", () => {
  const db = setup();
  db.exec("PRAGMA recursive_triggers=ON");
  grant(db, "2026-01-01T10:00:00.000Z", 3);
  db.exec("UPDATE codes SET expires_at=NULL WHERE id='lic'");
  assert.equal(
    db.prepare("SELECT expires_at FROM codes WHERE id='lic'").get()!["expires_at"],
    null,
  );
  assert.equal(
    db.prepare("SELECT expires_at FROM licenses WHERE id='lic'").get()!["expires_at"],
    "9999-12-31T23:59:59.999Z",
  );
  db.close();
});

function order(db: DatabaseSync, id: string, live = 1) {
  db.prepare(
    "INSERT INTO payments(id,client_id,plan_id,amount_cents,created_at,request_key,livemode) VALUES(?,'client','3m',2490,'2026-01-01',?,?)",
  ).run(id, id, live);
}
function fulfill(db: DatabaseSync, id: string, now: string, live = 1) {
  const session = "cs_" + id,
    intent = "pi_" + id;
  db.exec("BEGIN");
  db.prepare(attachPaymentSql).run(session, intent, id, session, intent);
  db.prepare(suppressRefundedFulfillmentSql).run(id);
  if (live) {
    db.prepare(recordGrantSql).run(now, now, id, session, intent);
    grant(db, now, 3, id);
  }
  db.prepare(finalizePaymentSql).run(now, id, session, intent);
  db.exec("COMMIT");
}
function refund(db: DatabaseSync, id: string, now: string, live = 1) {
  const intent = "pi_" + id;
  db.exec("BEGIN");
  db.prepare(recordRefundSql).run(intent, live, now);
  db.prepare(revokeSoleGrantSql).run(now, intent, live);
  db.prepare(finalizeRefundSql).run(intent, live);
  db.exec("COMMIT");
}

test("test payments cannot issue a licence even if the grant SQL is called directly", () => {
  const db = setup();
  order(db, "test", 0);
  fulfill(db, "test", "2026-02-02T00:00:00.000Z", 0);
  db.prepare("UPDATE payments SET status='pending' WHERE id='test'").run();
  assert.equal(grant(db, "2026-02-02T00:00:00.000Z", 3, "test").changes, 0);
  assert.equal(db.prepare("SELECT id FROM licenses").get(), undefined);
  assert.equal(db.prepare("SELECT id FROM codes").get(), undefined);
  db.close();
});

test("a full refund delivered before checkout success prevents any TV access", () => {
  const db = setup();
  order(db, "early");
  refund(db, "early", "2026-02-02T00:00:00.000Z");
  fulfill(db, "early", "2026-02-02T01:00:00.000Z");
  assert.equal(db.prepare("SELECT status FROM payments").get()?.["status"], "refunded");
  assert.equal(db.prepare("SELECT id FROM licenses").get(), undefined);
  assert.equal(db.prepare("SELECT id FROM codes").get(), undefined);
  db.close();
});

test("a refund revokes a sole paid term but preserves stacked renewals for review", () => {
  const db = setup();
  order(db, "sole");
  fulfill(db, "sole", "2026-01-02T00:00:00.000Z");
  assert.equal(db.prepare("SELECT enabled FROM codes").get()?.["enabled"], 1);
  refund(db, "sole", "2026-01-03T00:00:00.000Z");
  assert.equal(db.prepare("SELECT enabled FROM codes").get()?.["enabled"], 0);
  order(db, "new");
  fulfill(db, "new", "2026-01-04T00:00:00.000Z");
  order(db, "renewal");
  fulfill(db, "renewal", "2026-02-04T00:00:00.000Z");
  refund(db, "new", "2026-02-05T00:00:00.000Z");
  refund(db, "renewal", "2026-02-06T00:00:00.000Z");
  assert.equal(db.prepare("SELECT enabled FROM codes").get()?.["enabled"], 1);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM payments WHERE status='refunded'").get()?.["n"],
    3,
  );
  db.close();
});

test("an already associated Stripe session cannot be replaced to issue a term", () => {
  const db = setup();
  order(db, "other");
  db.prepare(attachPaymentSql).run(
    "cs_original",
    "pi_original",
    "other",
    "cs_original",
    "pi_original",
  );
  fulfill(db, "other", "2026-01-02T00:00:00.000Z");
  assert.equal(db.prepare("SELECT status FROM payments").get()?.["status"], "pending");
  assert.equal(db.prepare("SELECT id FROM licenses").get(), undefined);
  db.close();
});

test("a manual grant requires a linked active account and renewals keep an unlimited TV expiry", () => {
  const db = setup();
  db.exec("UPDATE clients SET auth_user_id=NULL WHERE id='client'");
  assert.equal(grant(db, "2026-01-02T00:00:00.000Z", 3).changes, 0);
  db.exec("UPDATE clients SET auth_user_id='auth-client' WHERE id='client'");
  grant(db, "2026-01-02T00:00:00.000Z", 3);
  db.exec("UPDATE codes SET expires_at=NULL,max_devices=5 WHERE id='lic'");
  grant(db, "2026-02-02T00:00:00.000Z", 3);
  assert.equal(db.prepare("SELECT expires_at FROM codes").get()?.["expires_at"], null);
  assert.equal(db.prepare("SELECT max_devices FROM codes").get()?.["max_devices"], 5);
  db.close();
});
