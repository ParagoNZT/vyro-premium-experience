import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { listShowCustomers, showDirectoryRequest } from "../src/lib/show-directory.server.ts";

test("SHOW+ data stays limited to the verified reseller and excludes direct and other reseller records", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(
      readFileSync(
        new URL("../migrations/d1/0007_show_reseller_memberships.sql", import.meta.url),
        "utf8",
      ),
    );
    sqlite.exec(`
      CREATE TABLE codes (id TEXT, code_hash TEXT, name TEXT, reseller_id TEXT, enabled INT, expires_at TEXT, created_at TEXT DEFAULT '2026-11-09');
      CREATE TABLE licenses (beta_code_hash TEXT);
      CREATE TABLE show_installations (code_hash TEXT, device_hash TEXT, legacy_code_hash TEXT, created_at TEXT);
      CREATE TABLE show_management_installations (device_hash TEXT, account_id TEXT);
      CREATE TABLE show_management_accounts (id TEXT, support_id TEXT);
      CREATE TABLE device_profiles (device_hash TEXT, code_hash TEXT, last_seen TEXT);
      INSERT INTO show_reseller_memberships VALUES ('reseller-id', 'reseller@example.test', '2026-11-09', 1);
      INSERT INTO codes(id,code_hash,name,reseller_id,enabled,expires_at) VALUES
        ('show','s','SHOW+ Device',NULL,1,NULL),
        ('legacy','j','SHOW+ - Ancien appareil',NULL,1,NULL),
        ('spoof','x','SHOW+ Label alone',NULL,1,NULL),
        ('direct','d','VYRO Direct',NULL,1,NULL),
        ('linked','l','SHOW+ linked to VYRO',NULL,1,NULL),
        ('licensed','v','VYRO Legacy',NULL,1,NULL),
        ('other','o','SHOW+ other reseller','other-reseller',1,NULL);
      INSERT INTO licenses VALUES ('v');
      INSERT INTO show_installations VALUES
        ('s','device-s',NULL,'2026-11-09'),
        ('o','device-o',NULL,'2026-11-09'),
        ('l','device-l','v','2026-11-09');
      INSERT INTO show_management_installations VALUES ('device-s','account-s');
      INSERT INTO show_management_accounts VALUES ('account-s','SHP-FIXTURE');
    `);
    sqlite.exec(
      readFileSync(new URL("../migrations/d1/0008_partner_control.sql", import.meta.url), "utf8"),
    );
    const db = {
      prepare(sql) {
        const stmt = sqlite.prepare(sql);
        return {
          bind(...params) {
            return {
              async first() {
                return stmt.get(...params) ?? null;
              },
              async all() {
                return { results: stmt.all(...params) };
              },
            };
          },
        };
      },
    };
    const user = {
      id: "reseller-id",
      email: "reseller@example.test",
      email_confirmed_at: "2026-11-09",
    };
    const lookup = (query = "", principal = user) =>
      listShowCustomers(db, principal, new URLSearchParams(query));

    assert.equal(
      (await showDirectoryRequest(new Request("https://vyro-player.app/api/show-directory")))
        .status,
      401,
    );
    await assert.rejects(lookup("", { ...user, id: "other" }), { status: 403 });
    await assert.rejects(lookup("", { ...user, email: "other@example.test" }), { status: 403 });
    const allowed = await lookup("scope=all&reseller=other-reseller&q=SHP-FIXTURE");
    assert.deepEqual(
      allowed.devices.map((item) => item.id),
      ["show"],
    );
    assert.equal(allowed.devices[0].supportRef, "SHP-FIXTURE");
    assert.deepEqual(
      (await lookup()).devices.map((item) => item.id),
      ["legacy", "show"],
    );
    assert.equal((await lookup("q=VYRO")).total, 0);
    sqlite.exec("UPDATE show_reseller_memberships SET enabled=0");
    await assert.rejects(lookup(), { status: 403 });
  } finally {
    sqlite.close();
  }
});
