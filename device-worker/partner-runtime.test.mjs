import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createPartnerRuntime } from "./partner-runtime.mjs";
import { showScope } from "../src/lib/partner-scope.ts";

test("an installation receives only its commands, server and entitled APKs", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const path of [
    "../tests/fixtures/beta-schema.sql",
    "../migrations/d1/0001_management.sql",
    "../migrations/d1/0002_shared_beta_access.sql",
    "../migrations/d1/0008_partner_control.sql",
  ])
    sqlite.exec(readFileSync(new URL(path, import.meta.url), "utf8"));
  const env = {
    DB: {
      prepare(sql) {
        const stmt = sqlite.prepare(sql);
        return {
          async first() {
            return stmt.get() ?? null;
          },
          bind(...values) {
            return {
              async first() {
                return stmt.get(...values) ?? null;
              },
              async all() {
                return { results: stmt.all(...values) };
              },
              async run() {
                return stmt.run(...values);
              },
            };
          },
        };
      },
    },
  };
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  const app = randomUUID(),
    command = randomUUID(),
    otherCommand = randomUUID();
  const runtime = createPartnerRuntime(showScope, {
    json: (value) => Response.json(value),
    ApiError,
    readBody: (request) => request.json(),
    installation: async ({ code, deviceId }) =>
      code === deviceId && ["show", "custom"].includes(code)
        ? { codeHash: code, deviceHash: deviceId }
        : null,
    binding: async (_env, code, device) => assert.equal(code, device),
  });
  const time = "2026-01-01T00:00:00.000Z",
    expiry = "2099-01-01T00:00:00.000Z";
  const insert = sqlite.prepare("INSERT INTO codes(id,code_hash,name,created_at) VALUES (?,?,?,?)");
  insert.run("id-show", "show", "SHOW+ - Box", time);
  insert.run("id-custom", "custom", "Another brand · TV", time);
  insert.run("id-direct", "direct", "Direct", time);
  sqlite
    .prepare(
      "INSERT INTO partner_apps(id,name,package_name,server_url) VALUES (?,'Custom','fr.example.player','https://custom.example.com')",
    )
    .run(app);
  sqlite.prepare("INSERT INTO partner_app_devices VALUES ('custom',?)").run(app);
  sqlite.exec("UPDATE partner_apps SET server_url='https://show.example.com' WHERE id='show-plus'");
  sqlite.exec("INSERT INTO beta_settings VALUES (1,'https://original.example.com','2026-01-01')");
  const stmt = sqlite.prepare(
    "INSERT INTO partner_commands(id,app_id,code_hash,kind,created_at,expires_at) VALUES (?,?,?,?,?,?)",
  );
  stmt.run(command, "show-plus", "show", "playlist", time, expiry);
  stmt.run(otherCommand, app, "custom", "epg", time, expiry);
  const post = async (code, data = {}, path = "") =>
    (
      await runtime.deviceRequest(
        new Request("https://devices.example.com/v1/show/partner-control" + path, {
          method: "POST",
          body: JSON.stringify({ code, deviceId: code, ...data }),
        }),
        env,
      )
    ).json();
  assert.deepEqual((await post("show")).commands, [{ id: command, kind: "playlist" }]);
  assert.deepEqual((await post("custom")).commands, [{ id: otherCommand, kind: "epg" }]);
  await assert.rejects(post("show", { ack: { id: otherCommand, outcome: "applied" } }), {
    status: 404,
  });
  assert.equal((await post("show", { ack: { id: command, outcome: "applied" } })).ok, true);
  assert.equal((await post("show")).commands.length, 0);
  assert.equal((await runtime.managedServer(env, "show")).url, "https://show.example.com");
  assert.equal((await runtime.managedServer(env, "custom")).url, "https://custom.example.com");
  assert.equal((await runtime.managedServer(env, "direct")).url, "https://original.example.com");
  const release = sqlite.prepare("INSERT INTO partner_releases VALUES (?,?,?,?,?,?,?,?)");
  release.run(app, 1, "1.0", "https://files.example.com/1.apk", "a".repeat(64), "", time, 1);
  release.run(
    app,
    2,
    "2.0",
    "https://files.example.com/2.apk",
    "a".repeat(64),
    "",
    "2026-08-01T00:00:00.000Z",
    0,
  );
  release.run(
    app,
    3,
    "3.0",
    "https://files.example.com/3.apk",
    "a".repeat(64),
    "",
    "2027-02-01T00:00:00.000Z",
    0,
  );
  sqlite
    .prepare(
      "INSERT INTO partner_orders(id,owner_id,email,kind,app_id,cents,created_at) VALUES ('paid','owner','owner@example.com','updates',?,2000,?)",
    )
    .run(app, time);
  sqlite
    .prepare("INSERT INTO partner_update_periods VALUES ('paid',?,?,'2027-01-01T00:00:00.000Z')")
    .run(app, time);
  assert.equal((await post("custom", {}, "/update")).versionCode, 2);
  await assert.rejects(post("show", {}, "/update"), { status: 400 });
});
