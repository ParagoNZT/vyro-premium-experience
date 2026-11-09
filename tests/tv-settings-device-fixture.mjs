// Test-only local Worker for the Android TV instrumented workflow.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const origin = "http://127.0.0.1:4191";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const db = new DatabaseSync(":memory:");
for (const file of [
  "./fixtures/beta-schema.sql",
  "../migrations/d1/0001_management.sql",
  "../migrations/d1/0002_shared_beta_access.sql",
  "../migrations/d1/0004_tv_settings.sql",
  "../migrations/d1/0005_tv_profiles.sql",
  "../migrations/d1/0006_backup_device_kind.sql",
]) {
  db.exec(readFileSync(new URL(file, import.meta.url), "utf8"));
}
const user = { id: randomUUID(), email: "tv-test@example.test", email_confirmed_at: "2026-01-01" };
const owner = randomUUID();
const now = new Date().toISOString();
db.prepare("INSERT INTO clients(id,auth_user_id,email,created_at) VALUES(?,?,?,?)").run(
  owner,
  user.id,
  user.email,
  now,
);
db.prepare(
  `INSERT INTO licenses(id,client_id,license_key,plan_id,started_at,expires_at,device_limit,updated_at,beta_code_hash)
  VALUES(?,?,?,'3m',?,'9999-12-31T23:59:59.999Z',3,?,?)`,
).run(randomUUID(), owner, "synthetic-fixture", now, now, digest("fixture licence"));
for (const id of ["a", "b"]) {
  const codeHash = digest("show fixture " + id);
  db.prepare("INSERT INTO codes(id,code_hash,name,created_at) VALUES(?,?,?,?)").run(
    randomUUID(),
    codeHash,
    "Synthetic TV",
    now,
  );
  db.prepare(
    "INSERT INTO show_installations(device_hash,token_hash,code_hash,created_at) VALUES(?,?,?,?)",
  ).run(digest(id.repeat(64)), digest("SHOWP-" + id.toUpperCase().repeat(64)), codeHash, now);
}

const env = {
  VYRO_DB: {
    prepare(sql) {
      const stmt = db.prepare(sql);
      const indexes = [...new Set([...sql.matchAll(/\?(\d+)/g)].map((m) => m[1]))];
      return {
        bind(...values) {
          const args = indexes.length
            ? [Object.fromEntries(indexes.map((i) => ["?" + i, values[Number(i) - 1]]))]
            : values;
          const write = () => ({ meta: { changes: stmt.run(...args).changes } });
          return {
            first: async () => stmt.get(...args) ?? null,
            all: async () => ({ results: stmt.all(...args) }),
            run: async () => write(),
            write,
          };
        },
      };
    },
    async batch(list) {
      db.exec("BEGIN");
      try {
        const result = list.map((q) => q.write());
        db.exec("COMMIT");
        return result;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  },
};
globalThis.tvSettingsTestEnv = env;
registerHooks({
  resolve(spec, ctx, next) {
    return spec === "cloudflare:workers"
      ? {
          shortCircuit: true,
          url: "data:text/javascript,export const env=globalThis.tvSettingsTestEnv",
        }
      : next(spec, ctx);
  },
});
process.env.SUPABASE_URL = "https://auth.example.test";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tv_test";
process.env.VYRO_STRIPE_ENABLED = "false";
delete process.env.VYRO_SITE_ORIGIN;
globalThis.fetch = async (input, init) => {
  if (String(input) === "https://auth.example.test/auth/v1/user") {
    return new Headers(init?.headers).get("authorization") === "Bearer fixture-owner"
      ? Response.json(user)
      : Response.json({}, { status: 401 });
  }
  throw new Error("Unexpected external call in TV fixture");
};
const { default: worker } = await import("../.output/server/index.mjs");
const ctx = { waitUntil() {}, passThroughOnException() {} };
createServer(async (req, res) => {
  try {
    const path = new URL(req.url, origin).pathname;
    if (!["/api/tv-settings", "/api/settings-backups"].includes(path)) {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const headers = new Headers(req.headers);
    if (path === "/api/settings-backups" && req.method === "POST") headers.set("origin", origin);
    const reply = await worker.fetch(
      new Request(origin + req.url, {
        method: req.method,
        headers,
        ...(body ? { body } : {}),
      }),
      env,
      ctx,
    );
    res.writeHead(reply.status, Object.fromEntries(reply.headers)).end(await reply.text());
  } catch {
    res.writeHead(500).end();
  }
}).listen(4191, "127.0.0.1", () => process.stdout.write("Local TV test ready on 4191\n"));
