import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const origin = "https://portal.example.test";
const authOrigin = "https://supabase.example.test";
const stripeOrigin = "https://api.stripe.com";
const fixtureSecret = "whsec_fixture";
const accounts = {
  admin: { id: randomUUID(), email: "admin@example.test" },
  first: { id: randomUUID(), email: "first@example.test" },
  second: { id: randomUUID(), email: "second@example.test" },
};

function sqliteBinding(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values) {
          return {
            first: async () => statement.get(...values) ?? null,
            all: async () => ({ results: statement.all(...values) }),
            run: async () => ({ meta: { changes: statement.run(...values).changes } }),
            execute: () => ({ meta: { changes: statement.run(...values).changes } }),
          };
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

test("compiled Worker: real API handlers with synthetic Supabase, D1 and Stripe", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const fixture of [
    "./fixtures/beta-schema.sql",
    "../migrations/d1/0001_management.sql",
    "../migrations/d1/0002_shared_beta_access.sql",
  ])
    sqlite.exec(readFileSync(new URL(fixture, import.meta.url), "utf8"));
  sqlite.exec("PRAGMA recursive_triggers=ON");

  const env = { VYRO_DB: sqliteBinding(sqlite) };
  const key = "__vyroWorkerFixture";
  globalThis[key] = env;
  const moduleHooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier !== "cloudflare:workers") return next(specifier, context);
      return {
        shortCircuit: true,
        url:
          "data:text/javascript," +
          encodeURIComponent("export const env = globalThis." + key + ";"),
      };
    },
  });
  t.after(() => {
    moduleHooks.deregister();
    delete globalThis[key];
  });
  Object.assign(process.env, {
    SUPABASE_URL: authOrigin,
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    VYRO_ADMIN_USER_ID: accounts.admin.id,
    VYRO_ADMIN_EMAIL: accounts.admin.email,
    VYRO_SITE_ORIGIN: origin,
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: fixtureSecret,
  });

  const sessions = new Map();
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    const headers = new Headers(init?.headers);
    if (url.href === authOrigin + "/auth/v1/user") {
      assert.equal(headers.get("apikey"), "sb_publishable_fixture");
      const account = accounts[headers.get("authorization")?.replace(/^Bearer /, "")];
      return account
        ? Response.json({ ...account, email_confirmed_at: "2026-01-01", user_metadata: {} })
        : Response.json({}, { status: 401 });
    }
    if (url.href === stripeOrigin + "/v1/checkout/sessions" && init?.method === "POST") {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("line_items[0][price_data][unit_amount]"), "2490");
      assert.equal(form.get("success_url")?.startsWith(origin + "/account?payment="), true);
      assert.match(headers.get("idempotency-key"), /^checkout-/);
      const id = "cs_fixture_" + (sessions.size + 1);
      const value = {
        id,
        url: "https://checkout.stripe.com/c/pay/" + id,
        payment_status: "unpaid",
        status: "open",
        amount_total: 2490,
        currency: "eur",
        livemode: headers.get("authorization").includes("_live_"),
        client_reference_id: form.get("client_reference_id"),
        payment_intent: "pi_fixture_" + (sessions.size + 1),
        metadata: {
          order_id: form.get("metadata[order_id]"),
          plan_id: form.get("metadata[plan_id]"),
          client_id: form.get("metadata[client_id]"),
        },
      };
      sessions.set(id, value);
      return Response.json(value);
    }
    if (url.origin === stripeOrigin && url.pathname.startsWith("/v1/checkout/sessions/")) {
      return Response.json(sessions.get(url.pathname.split("/").at(-1)));
    }
    throw new Error("Unexpected network request in isolated worker test: " + url.origin);
  });

  const { default: worker } = await import("../.output/server/index.mjs");
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  async function call(path, { token, body, signature } = {}) {
    const headers = new Headers();
    if (token) headers.set("authorization", "Bearer " + token);
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      if (!signature) headers.set("origin", origin);
    }
    if (signature) headers.set("stripe-signature", signature);
    const request = new Request(origin + path, {
      method: body === undefined ? "GET" : "POST",
      headers,
      ...(body !== undefined ? { body } : {}),
    });
    const response = await worker.fetch(request, env, ctx);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, path);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/, path);
    return { status: response.status, json: await response.json() };
  }
  const post = (path, token, payload) => call(path, { token, body: JSON.stringify(payload) });
  assert.equal((await call("/api/account")).status, 401);
  assert.equal((await call("/api/manage", { token: "first" })).status, 403);
  assert.equal((await call("/api/admin", { token: "admin" })).status, 200);
  assert.equal((await call("/api/account", { token: "first" })).json.email, accounts.first.email);
  assert.equal((await call("/api/account", { token: "second" })).json.email, accounts.second.email);

  assert.deepEqual((await call("/api/checkout")).json, { enabled: false, live: false });
  assert.equal(
    (await post("/api/checkout", "second", { planId: "3m", requestKey: randomUUID() })).status,
    503,
  );
  assert.equal(sessions.size, 0);
  process.env.VYRO_STRIPE_ENABLED = "true";
  assert.equal((await call("/api/checkout")).status, 503);
  assert.equal(
    (await post("/api/checkout", "second", { planId: "3m", requestKey: randomUUID() })).status,
    503,
  );
  assert.equal(sessions.size, 0);
  sqlite.exec(
    readFileSync(new URL("../migrations/d1/0003_stripe_fulfillment.sql", import.meta.url), "utf8"),
  );

  const legacyClient = sqlite
    .prepare("SELECT id FROM clients WHERE auth_user_id=?")
    .get(accounts.second.id).id;
  const legacy = randomUUID();
  sqlite
    .prepare(
      `INSERT INTO licenses(id,client_id,license_key,plan_id,started_at,expires_at,device_limit,updated_at)
    VALUES(?,?,'legacy-website-key','3m','2026-01-01','2099-01-01',3,'2026-01-01')`,
    )
    .run(legacy, legacyClient);
  assert.equal(
    (await post("/api/checkout", "second", { planId: "3m", requestKey: randomUUID() })).status,
    409,
  );
  assert.equal(sessions.size, 0);
  sqlite.prepare("DELETE FROM licenses WHERE id=?").run(legacy);

  const overview = (await call("/api/manage", { token: "admin" })).json;
  const clientId = overview.clients.find((row) => row.email === accounts.first.email).id;
  assert.equal(
    (
      await post("/api/manage", "admin", {
        action: "grant-license",
        clientId,
        planId: "3m",
        deviceLimit: 3,
        note: "Fixture d’intégration",
      })
    ).status,
    200,
  );
  const first = (await call("/api/account", { token: "first" })).json;
  assert.match(first.licenseKey, /^VYRO-[A-F0-9]{24}$/);
  assert.equal((await call("/api/account", { token: "second" })).json.licenseKey, "");
  assert.equal((await call("/api/download", { token: "second" })).status, 403);
  assert.deepEqual((await call("/api/download", { token: "first" })).json, { platforms: [] });
  assert.equal((await call("/api/download?platform=androidtv", { token: "first" })).status, 404);
  const fixtureBytes = new TextEncoder().encode("local APK fixture");
  env.VYRO_RELEASES = {
    head: async (key) =>
      key === "vyro-premium-androidtv.apk" ? { size: fixtureBytes.length } : null,
    get: async (key) =>
      key === "vyro-premium-androidtv.apk"
        ? { size: fixtureBytes.length, body: new Response(fixtureBytes).body }
        : null,
  };
  assert.deepEqual((await call("/api/download", { token: "first" })).json, {
    platforms: ["androidtv"],
  });
  assert.equal((await call("/api/download?platform=androidtv", { token: "second" })).status, 403);
  const apk = await worker.fetch(
    new Request(origin + "/api/download?platform=androidtv", {
      headers: { Authorization: "Bearer first" },
    }),
    env,
    ctx,
  );
  assert.equal(apk.status, 200);
  assert.match(apk.headers.get("content-disposition") ?? "", /attachment;.*androidtv\.apk/);
  assert.match(apk.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(new Uint8Array(await apk.arrayBuffer()), fixtureBytes);
  const granted = (await call("/api/manage", { token: "admin" })).json.licenses[0];
  assert.equal(Object.hasOwn(granted, "license_key"), false);
  const code = (await post("/api/beta-key", "admin", { id: granted.id, action: "reveal" })).json
    .code;
  assert.equal(code, first.licenseKey);

  const hash = sqlite.prepare("SELECT code_hash FROM codes WHERE id=?").get(granted.id).code_hash;
  const device = "a".repeat(64);
  sqlite
    .prepare("INSERT INTO bindings(code_hash,device_hash,created_at) VALUES(?,?,?)")
    .run(hash, device, "2026-01-01");
  sqlite
    .prepare(
      `INSERT INTO device_profiles(code_hash,device_hash,manufacturer,model,android_version,app_version,last_seen)
    VALUES(?,?,?,?,?,?,?)`,
    )
    .run(hash, device, "Fixture", "TV", "12", "1.2.3", "2026-01-02");
  assert.deepEqual((await call("/api/account", { token: "first" })).json.devices[0], {
    id: device,
    name: "Fixture TV",
    platform: "Android / TV",
    lastSeen: "2026-01-02",
    androidVersion: "12",
    appVersion: "1.2.3",
  });
  assert.deepEqual((await call("/api/account", { token: "second" })).json.devices, []);
  assert.equal(
    (await post("/api/account", "second", { action: "remove", id: device })).status,
    404,
  );
  assert.equal((await post("/api/account", "first", { action: "remove", id: device })).status, 200);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM bindings").get().n, 0);

  async function checkout(live) {
    process.env.STRIPE_SECRET_KEY = live ? "sk_live_fixture" : "sk_test_fixture";
    assert.deepEqual((await call("/api/checkout")).json, { enabled: true, live });
    const order = await post("/api/checkout", "second", {
      planId: "3m",
      requestKey: randomUUID(),
      amount: 1,
    });
    assert.equal(order.status, 200, JSON.stringify(order));
    const session = sessions.get(order.json.url.split("/").at(-1));
    Object.assign(session, { status: "complete", payment_status: "paid" });
    const raw = JSON.stringify({
      id: "evt_fixture_" + Number(live),
      type: "checkout.session.completed",
      livemode: live,
      data: { object: { id: session.id } },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const mac = createHmac("sha256", fixtureSecret)
      .update(timestamp + "." + raw)
      .digest("hex");
    assert.equal(
      (await call("/api/stripe-webhook", { body: raw, signature: "invalid" })).status,
      400,
    );
    const signed = { body: raw, signature: `t=${timestamp},v1=${mac}` };
    assert.equal((await call("/api/stripe-webhook", signed)).status, 200);
    assert.equal((await call("/api/stripe-webhook", signed)).status, 200);
    const account = (await call("/api/account", { token: "second" })).json;
    assert.equal(Boolean(account.licenseKey), live);
    assert.equal(account.orders.length, live ? 1 : 0);
  }
  await checkout(false);
  await checkout(true);
});
