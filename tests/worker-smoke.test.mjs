import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { sealPlaylistUrl } from "../src/lib/remote-seal.ts";
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
  collaborator: { id: randomUUID(), email: "collaborator@example.test" },
};

function sqliteBinding(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const numbered = [...new Set([...sql.matchAll(/\?(\d+)/g)].map((match) => match[1]))];
      return {
        all: async () => ({ results: statement.all() }),
        bind(...values) {
          const args = numbered.length
            ? [Object.fromEntries(numbered.map((n) => ["?" + n, values[Number(n) - 1]]))]
            : values;
          return {
            first: async () => statement.get(...args) ?? null,
            all: async () => ({ results: statement.all(...args) }),
            run: async () => ({ meta: { changes: statement.run(...args).changes } }),
            execute: () => ({ meta: { changes: statement.run(...args).changes } }),
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
    "../migrations/d1/0004_tv_settings.sql",
    "../migrations/d1/0005_tv_profiles.sql",
    "../migrations/d1/0006_backup_device_kind.sql",
    "../migrations/d1/0007_show_reseller_memberships.sql",
    "../migrations/d1/0008_partner_control.sql",
    "../migrations/d1/0009_support_tickets.sql",
    "../migrations/d1/0010_support_processing.sql",
    "../migrations/d1/0011_vyro_app_console.sql",
    "../migrations/d1/0012_remote_workspace.sql",
    "../migrations/d1/0013_vyro_private_messages.sql",
    "../migrations/d1/0014_admin_delegation_and_license_expiry.sql",
    "../migrations/d1/0015_admin_license_packs.sql",
    "../migrations/d1/0017_partner_order_logos.sql",
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
  let hasReleasePin = false;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    const headers = new Headers(init?.headers);
    if (url.href === "https://raw.githubusercontent.com/ParagoNZT/VYRO-Updates/main/latest.json") {
      assert.equal(init.redirect, "manual");
      return Response.json({
        versionCode: 154,
        versionName: "0.23.8",
        apkUrl: "https://github.com/ParagoNZT/VYRO-Updates/releases/download/v0.23.8/VYRO.apk",
        changelog: "",
      });
    }
    if (
      url.href ===
      "https://raw.githubusercontent.com/ParagoNZT/VYRO-Updates/main/trusted-signer.sha256"
    ) {
      return new Response(hasReleasePin ? "a".repeat(64) : "", {
        status: hasReleasePin ? 200 : 404,
      });
    }
    if (url.href === authOrigin + "/auth/v1/user") {
      assert.equal(headers.get("apikey"), "sb_publishable_fixture");
      const account = accounts[headers.get("authorization")?.replace(/^Bearer /, "")];
      return account
        ? Response.json({
            ...account,
            email_confirmed_at: "2026-01-01",
            user_metadata: account.id === accounts.admin.id ? { first_name: "VYRO QA" } : {},
          })
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
  await t.test("French and English pages have reciprocal crawlable URLs", async () => {
    const render = (path) =>
      worker.fetch(new Request(origin + path, { headers: { accept: "text/html" } }), env, ctx);
    const [fr, en, signIn, unknown] = await Promise.all([
      render("/"),
      render("/en/pricing"),
      render("/en/login"),
      render("/en/api/account"),
    ]);
    assert.equal(fr.status, 200);
    assert.equal(en.status, 200);
    assert.equal(signIn.status, 200);
    assert.equal(unknown.status, 404);
    const [frenchPage, englishPage, signInPage] = await Promise.all([
      fr.text(),
      en.text(),
      signIn.text(),
    ]);
    assert.match(frenchPage, /<html lang="fr"/);
    assert.match(frenchPage, /href="\/vyro-icon\.png"/);
    assert.match(frenchPage, /hrefLang="en" href="https:\/\/vyro-player\.app\/en"/i);
    assert.match(englishPage, /<html lang="en"/);
    assert.match(englishPage, /Choose your VYRO plan/);
    assert.match(englishPage, /hrefLang="fr" href="https:\/\/vyro-player\.app\/tarifs"/i);
    assert.match(englishPage, /rel="canonical" href="https:\/\/vyro-player\.app\/en\/pricing"/);
    assert.match(signInPage, /<h1[^>]*>Sign in<\/h1>/);
    assert.match(signInPage, /href="\/en\/register"/);
  });
  await t.test("the public pairing page cannot be framed", async () => {
    const page = await worker.fetch(new Request(origin + "/associer"), env, ctx);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /^text\/html\b/);
    assert.match(page.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(page.headers.get("x-frame-options"), "DENY");
  });
  await t.test("reseller pages send visitors to the order flow in both languages", async () => {
    const render = async (path) => {
      const page = await worker.fetch(
        new Request(origin + path, { headers: { accept: "text/html" } }),
        env,
        ctx,
      );
      assert.equal(page.status, 200);
      return page.text();
    };
    const [fr, en, login] = await Promise.all([
      render("/revendeurs"),
      render("/en/resellers"),
      render("/en/login?redirect=%2Faccount%2Freseller"),
    ]);
    assert.match(fr, /Votre application Android,/);
    assert.match(fr, /href="\/login\?redirect=%2Faccount%2Freseller"/i);
    assert.match(fr, /hrefLang="en" href="https:\/\/vyro-player\.app\/en\/resellers"/i);
    assert.match(en, /<html lang="en"/);
    assert.match(en, /Request my app/);
    assert.match(en, /€100/);
    assert.match(en, /€20/);
    assert.match(en, /href="\/en\/login\?redirect=%2Faccount%2Freseller"/i);
    assert.match(login, /href="\/en\/register\?redirect=%2Faccount%2Freseller"/i);
  });
  async function call(path, { token, body, signature, native } = {}) {
    const headers = new Headers();
    if (token) headers.set("authorization", "Bearer " + token);
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      if (!signature && !native) headers.set("origin", origin);
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

  // Run the entire delegation and licence path against the Worker using disposable accounts.
  const manage = "/api/manage";
  const portal = "/api/account";
  const adminEndpoint = "/api/admin";
  assert.equal((await call(portal, { token: "admin" })).status, 200);
  assert.equal((await call(portal, { token: "collaborator" })).status, 200);
  assert.equal((await call(portal, { token: "second" })).status, 200);
  const roleSearch = await call(manage + "?client=COLLABORATOR", { token: "admin" });
  assert.equal(roleSearch.status, 200);
  assert.equal(roleSearch.json.clients.length, 1);
  const collaborator = roleSearch.json.clients[0];
  assert.equal(collaborator.admin_role, null);
  const owner = sqlite
    .prepare("SELECT id FROM clients WHERE auth_user_id=?")
    .get(accounts.admin.id);
  const roleChange = {
    action: "client-admin-role",
    clientId: collaborator.id,
    grant: true,
    note: "Test delegation",
  };
  assert.equal((await call(adminEndpoint, { token: "admin" })).json.role, "owner");
  assert.equal((await call(adminEndpoint, { token: "collaborator" })).status, 403);
  assert.equal((await post(manage, "collaborator", roleChange)).status, 403);
  assert.equal((await post(manage, "admin", { ...roleChange, clientId: owner.id })).status, 409);
  assert.equal((await post(manage, "admin", roleChange)).status, 200);
  assert.equal((await call(adminEndpoint, { token: "collaborator" })).json.role, "admin");
  assert.equal((await call("/api/beta", { token: "collaborator" })).status, 200);
  assert.equal((await post(manage, "collaborator", { ...roleChange, grant: false })).status, 403);
  assert.equal(
    (
      await post(manage, "collaborator", {
        action: "client-status",
        clientId: owner.id,
        status: "suspended",
        note: "Test owner protection",
      })
    ).status,
    409,
  );
  const secondClient = sqlite
    .prepare("SELECT id FROM clients WHERE auth_user_id=?")
    .get(accounts.second.id);
  const exactGrant = {
    action: "grant-license-until",
    clientId: secondClient.id,
    through: "2090-08-08",
    deviceLimit: 5,
    note: "Test exact expiry",
  };
  assert.equal((await post(manage, "second", exactGrant)).status, 403);
  assert.equal(
    (await post(manage, "collaborator", { ...exactGrant, through: "2001-08-08" })).status,
    400,
  );
  assert.equal((await post(manage, "collaborator", exactGrant)).status, 200);
  const beforeEdit = (await call(portal, { token: "second" })).json;
  assert.match(beforeEdit.licenseKey, /^VYRO-/);
  assert.equal(beforeEdit.subscription.expiresOn, exactGrant.through);
  assert.equal(beforeEdit.subscription.devicesAllowed, 5);
  const initial = sqlite
    .prepare("SELECT id,beta_code_hash FROM licenses WHERE client_id=?")
    .get(secondClient.id);
  const tvCode = () =>
    sqlite.prepare("SELECT expires_at,max_devices FROM codes WHERE id=?").get(initial.id);
  assert.equal(tvCode().expires_at, "2090-08-08T22:00:00.000Z");
  const modify = {
    ...exactGrant,
    through: "2090-12-20",
    expectedLicenseId: initial.id,
    deviceLimit: 1,
  };
  sqlite
    .prepare("INSERT INTO bindings(code_hash,device_hash,created_at) VALUES(?,?,?)")
    .run(initial.beta_code_hash, "fixture-one", "2026-01-01");
  sqlite
    .prepare("INSERT INTO bindings(code_hash,device_hash,created_at) VALUES(?,?,?)")
    .run(initial.beta_code_hash, "fixture-two", "2026-01-01");
  assert.equal((await post(manage, "collaborator", modify)).status, 409);
  assert.equal(tvCode().max_devices, 5);
  assert.equal((await post(manage, "collaborator", { ...modify, deviceLimit: 3 })).status, 200);
  const afterEdit = (await call(portal, { token: "second" })).json;
  assert.equal(afterEdit.licenseKey, beforeEdit.licenseKey);
  assert.equal(afterEdit.subscription.expiresOn, modify.through);
  assert.equal(tvCode().expires_at, "2090-12-20T23:00:00.000Z");
  assert.equal(tvCode().max_devices, 3);
  const log = (await call(manage, { token: "admin" })).json.audit;
  assert.ok(
    log.some(
      (row) =>
        row.action === "license-expiry-set" && row.actor_label === accounts.collaborator.email,
    ),
  );
  assert.equal((await post(manage, "admin", { ...roleChange, grant: false })).status, 200);
  assert.equal((await call(adminEndpoint, { token: "collaborator" })).status, 403);
  assert.equal((await call("/api/beta", { token: "collaborator" })).status, 403);
  assert.equal((await call(portal, { token: "collaborator" })).status, 200);
  sqlite.prepare("DELETE FROM codes WHERE id=?").run(initial.id);
  sqlite.prepare("DELETE FROM licenses WHERE id=?").run(initial.id);

  await t.test("assign annual, lifetime and custom packs without any payment", async () => {
    const catalogue = () =>
      call(manage + "?packs=1", { token: "admin" }).then(({ json }) => json.packs);
    const save = {
      action: "save-pack",
      name: "Essai intégration",
      months: 6,
      devices: 4,
      priceCents: 1234,
    };
    assert.equal((await post(manage, "second", save)).status, 403);
    assert.equal((await post(manage, "admin", { ...save, name: "SOLO" })).status, 409);
    assert.equal((await post(manage, "admin", save)).status, 200);
    const customPack = (await catalogue()).find((pack) => pack.name === save.name);
    assert.ok(customPack?.id);
    const payload = (packId, version = null) => ({
      action: "grant-pack",
      clientId: secondClient.id,
      packId,
      version,
      note: "Intégration catalogue",
    });
    const actual = () =>
      sqlite
        .prepare(
          `SELECT l.id,l.license_key,l.beta_code_hash,l.expires_at,b.expires_at AS tvExpiry,b.max_devices AS quota
      FROM licenses l JOIN codes b ON l.beta_code_hash=b.code_hash WHERE l.client_id=?`,
        )
        .get(secondClient.id);
    assert.equal(
      (await post(manage, "admin", { ...payload("solo"), deviceLimit: 10 })).status,
      400,
    );
    const expected = [
      ["solo", "Solo", 1, 999],
      ["maison", "Maison", 3, 1999],
      ["famille", "Famille", 5, 2999],
    ];
    const all = await catalogue();
    let key;
    let priorEnd;
    for (const [id, name, quota, cents] of expected) {
      const pack = all.find((row) => row.id === id);
      assert.deepEqual(
        [pack.name, pack.devices, pack.months, pack.priceCents],
        [name, quota, 12, cents],
      );
      assert.equal((await post(manage, "admin", payload(id))).status, 200);
      const subscription = (await call(portal, { token: "second" })).json.subscription;
      const row = actual();
      assert.equal(subscription.planName, name);
      assert.equal(subscription.devicesAllowed, quota);
      assert.equal(row.quota, quota);
      assert.equal(row.tvExpiry, subscription.expiresAt);
      if (priorEnd) assert.ok(row.expires_at > priorEnd);
      else assert.ok(Date.parse(row.expires_at) > Date.now() + 364 * 86400000);
      priorEnd = row.expires_at;
      key ??= row.license_key;
      assert.equal(row.license_key, key);
    }
    assert.equal(
      (await post(manage, "admin", payload(customPack.id, customPack.updatedAt))).status,
      200,
    );
    assert.equal(actual().quota, 4);
    assert.equal((await call(portal, { token: "second" })).json.subscription.planName, save.name);
    const editedName = "Offre interne modifiée";
    assert.equal(
      (
        await post(manage, "admin", {
          ...save,
          id: customPack.id,
          name: editedName,
          devices: 2,
          months: null,
        })
      ).status,
      200,
    );
    assert.equal((await call(portal, { token: "second" })).json.subscription.planName, save.name);
    assert.equal(actual().quota, 4);
    assert.equal(
      (await post(manage, "admin", payload(customPack.id, customPack.updatedAt))).status,
      409,
    );
    const edited = (await catalogue()).find((pack) => pack.id === customPack.id);
    assert.equal(edited.months, null);
    assert.equal((await post(manage, "admin", payload(edited.id, edited.updatedAt))).status, 200);
    assert.equal(actual().quota, 2);
    assert.equal(actual().tvExpiry, null);
    assert.equal(
      (
        await post(manage, "admin", {
          action: "pack-availability",
          id: customPack.id,
          enabled: false,
        })
      ).status,
      200,
    );
    const archived = (await catalogue()).find((pack) => pack.id === customPack.id);
    assert.equal(archived.enabled, 0);
    assert.equal(
      (await post(manage, "admin", payload(archived.id, archived.updatedAt))).status,
      409,
    );
    assert.equal((await call(portal, { token: "second" })).json.subscription.planName, editedName);

    const lifetime = all.find((pack) => pack.id === "a-vie");
    assert.deepEqual([lifetime.devices, lifetime.months, lifetime.priceCents], [5, null, 4999]);
    assert.equal((await post(manage, "admin", payload("a-vie"))).status, 200);
    const unlimited = (await call(portal, { token: "second" })).json;
    assert.equal(unlimited.licenseKey, key);
    assert.equal(unlimited.subscription.planName, "À vie");
    assert.equal(unlimited.subscription.status, "active");
    assert.equal(unlimited.subscription.expiresAt, null);
    assert.equal(unlimited.subscription.devicesAllowed, 5);
    assert.equal(actual().tvExpiry, null);
    assert.equal(actual().quota, 5);
    assert.equal((await post(manage, "admin", payload("solo"))).status, 409);
    assert.equal(
      (
        await post("/api/beta", "admin", {
          id: actual().id,
          enabled: true,
          maxDevices: 1,
          expiresAt: null,
          note: "Test verrou quota",
        })
      ).status,
      409,
    );
    assert.equal((await post(manage, "admin", { ...exactGrant, deviceLimit: 5 })).status, 409);
    assert.equal(
      sqlite.prepare("SELECT count(*) AS n FROM payments WHERE client_id=?").get(secondClient.id).n,
      0,
    );

    const row = actual();
    sqlite
      .prepare("INSERT INTO bindings(code_hash,device_hash,created_at) VALUES(?,?,?)")
      .run(row.beta_code_hash, "test-device-a", "2026-01-01");
    sqlite
      .prepare("INSERT INTO bindings(code_hash,device_hash,created_at) VALUES(?,?,?)")
      .run(row.beta_code_hash, "test-device-b", "2026-01-01");
    assert.equal(
      (
        await post(manage, "admin", {
          action: "revoke-license",
          licenseId: row.id,
          note: "Test quota",
        })
      ).status,
      200,
    );
    assert.match((await post(manage, "admin", payload("solo"))).json.error, /2 appareils liés/);
    assert.equal((await post(manage, "admin", payload("maison"))).status, 200);
    assert.equal(actual().quota, 3);
    assert.notEqual(actual().tvExpiry, null);
    sqlite.prepare("DELETE FROM codes WHERE id=?").run(row.id);
    sqlite.prepare("DELETE FROM licenses WHERE id=?").run(row.id);
  });

  await t.test(
    "native account sign-in activates one licence seat without exposing a key",
    async () => {
      const endpoint = "/api/account-device";
      const activate = (deviceId, token = "second", action = "activate") =>
        call(endpoint, {
          token,
          native: true,
          body: JSON.stringify({
            action,
            deviceId,
            name: "Amazon AFTKRT",
            android: "11",
            version: "0.24.57",
          }),
        });
      const a = randomBytes(32).toString("hex");
      const b = randomBytes(32).toString("hex");
      assert.equal((await activate(a, "not-a-session")).status, 401);
      assert.deepEqual((await activate(a)).json, { status: "inactive" });
      assert.equal(
        (
          await post(manage, "admin", {
            action: "grant-pack",
            clientId: secondClient.id,
            packId: "solo",
            version: null,
            note: "Native activation test",
          })
        ).status,
        200,
      );
      assert.deepEqual((await activate(a, "second", "check")).json, { status: "unregistered" });
      const statuses = (await Promise.all([activate(a), activate(b)])).map((r) => r.json.status);
      assert.deepEqual([...statuses].sort(), ["active", "quota-full"]);
      const winningId = statuses[0] === "active" ? a : b;
      const hash = createHash("sha256").update(winningId).digest("hex");
      assert.deepEqual((await activate(winningId)).json, { status: "active" });
      assert.deepEqual((await activate(winningId, "first")).json, { status: "inactive" });
      const signedIn = (await call(portal, { token: "second" })).json;
      assert.equal(signedIn.subscription.devicesUsed, 1);
      assert.deepEqual(
        signedIn.devices.map((device) => [device.id, device.name]),
        [[hash, "Amazon AFTKRT"]],
      );
      assert.equal((await post(portal, "second", { action: "remove", id: hash })).status, 200);
      assert.deepEqual((await activate(winningId, "second", "check")).json, {
        status: "unregistered",
      });
      assert.equal((await call(portal, { token: "second" })).json.subscription.devicesUsed, 0);
      const licence = sqlite
        .prepare("SELECT id FROM licenses WHERE client_id=?")
        .get(secondClient.id);
      assert.equal(
        (
          await post(manage, "admin", {
            action: "revoke-license",
            licenseId: licence.id,
            note: "Native activation test",
          })
        ).status,
        200,
      );
      assert.deepEqual((await activate(a)).json, { status: "inactive" });
      sqlite.prepare("DELETE FROM codes WHERE id=?").run(licence.id);
      sqlite.prepare("DELETE FROM licenses WHERE id=?").run(licence.id);
    },
  );

  const resellerCode = randomUUID();
  const showFixture = randomUUID();
  const directFixture = randomUUID();
  const reviewFixture = randomUUID();
  const partnerFixture = randomUUID();
  const fixtureDate = "2026-11-09T12:00:00Z";
  sqlite
    .prepare(
      "INSERT INTO resellers VALUES (?, 'Other reseller', 'fixture-hash', 'fixture-token', 1, ?)",
    )
    .run(resellerCode, fixtureDate);
  const insertAccess = sqlite.prepare(
    "INSERT INTO codes (id,code_hash,name,created_at,reseller_id) VALUES (?,?,?,?,?)",
  );
  insertAccess.run(showFixture, "show-fixture", "SHOW+ · Native installation", fixtureDate, null);
  insertAccess.run(directFixture, "direct-fixture", "Direct client", fixtureDate, null);
  insertAccess.run(
    reviewFixture,
    "review-fixture",
    "SHOW+ - Legacy installation",
    fixtureDate,
    null,
  );
  insertAccess.run(
    partnerFixture,
    "partner-fixture",
    "Other reseller client",
    fixtureDate,
    resellerCode,
  );
  sqlite
    .prepare(
      "INSERT INTO show_installations VALUES ('show-device','show-token','show-fixture',NULL,?)",
    )
    .run(fixtureDate);
  sqlite
    .prepare("INSERT INTO show_reseller_memberships VALUES (?,?,?,1)")
    .run(accounts.first.id, accounts.first.email, fixtureDate);

  assert.equal((await call("/api/show-directory")).status, 401);
  assert.equal((await call("/api/show-directory", { token: "second" })).status, 403);
  assert.equal((await call("/api/beta?scope=show-plus", { token: "first" })).status, 403);
  const resellerDirectory = await call("/api/show-directory?scope=all&reseller=other", {
    token: "first",
  });
  assert.equal(resellerDirectory.status, 200);
  assert.deepEqual(
    resellerDirectory.json.devices.map((device) => device.id),
    [reviewFixture, showFixture].sort(),
  );
  for (const [scope, expected] of [
    ["all", [directFixture, partnerFixture, reviewFixture, showFixture]],
    ["direct", [directFixture]],
    ["show-plus", [reviewFixture, showFixture]],
    ["review", []],
    ["reseller:" + resellerCode, [partnerFixture]],
  ]) {
    const beta = await call("/api/beta?sort=reseller&scope=" + encodeURIComponent(scope), {
      token: "admin",
    });
    assert.equal(beta.status, 200);
    assert.deepEqual(
      beta.json.codes.map((code) => code.id),
      expected,
    );
  }
  await t.test(
    "access filters are exclusive across direct, SHOW+ and reseller origins",
    async () => {
      const secondReseller = randomUUID();
      const secondAccess = randomUUID();
      const app = randomUUID();
      const assigned = randomUUID();
      const ambiguous = randomUUID();
      const legacyShow = randomUUID();
      sqlite
        .prepare(
          "INSERT INTO resellers VALUES (?, 'Revendeur 2', 'second-hash', 'second-token', 1, ?)",
        )
        .run(secondReseller, fixtureDate);
      insertAccess.run(
        secondAccess,
        "reseller-two-fixture",
        "SHOW+ - Client attribué",
        fixtureDate,
        secondReseller,
      );
      insertAccess.run(assigned, "assigned-fixture", "Application client", fixtureDate, null);
      insertAccess.run(ambiguous, "ambiguous-fixture", "SHOW+ - À examiner", fixtureDate, null);
      insertAccess.run(legacyShow, "legacy-show-fixture", "SHOW+", fixtureDate, null);
      sqlite
        .prepare(
          "INSERT INTO show_installations VALUES ('conflict-device','conflict-token','ambiguous-fixture','partner-fixture',?)",
        )
        .run(fixtureDate);
      sqlite
        .prepare(
          "INSERT INTO partner_apps(id,name,package_name) VALUES(?,'App distincte','com.demo.partner')",
        )
        .run(app);
      const assign = sqlite.prepare("INSERT INTO partner_app_devices VALUES(?,?)");
      assign.run("reseller-two-fixture", app);
      assign.run("assigned-fixture", app);
      try {
        const list = async (scope, q = "") => {
          const response = await call("/api/beta?" + new URLSearchParams({ scope, q }), {
            token: "admin",
          });
          assert.equal(response.status, 200, JSON.stringify(response));
          assert.equal(response.json.stats.accesses, response.json.codes.length);
          return response.json.codes;
        };
        assert.deepEqual(
          (await list("direct")).map((c) => c.id),
          [directFixture],
        );
        assert.deepEqual(
          new Set((await list("show-plus")).map((c) => c.id)),
          new Set([showFixture, reviewFixture, ambiguous, legacyShow]),
        );
        assert.deepEqual(
          (await list("review")).map((c) => c.id),
          [ambiguous],
        );
        assert.deepEqual(
          (await list("reseller:" + secondReseller, "Revendeur 2")).map((c) => c.id),
          [secondAccess],
        );
        assert.deepEqual(
          new Set((await list("resellers")).map((c) => c.id)),
          new Set([
            showFixture,
            reviewFixture,
            ambiguous,
            legacyShow,
            partnerFixture,
            secondAccess,
          ]),
        );
        assert.deepEqual(
          (await list("partner:" + app)).map((c) => c.id),
          [assigned],
        );
        assert.deepEqual(
          (await list("show-plus", "Client attribué")).map((c) => c.id),
          [],
        );
      } finally {
        sqlite.exec(
          "DELETE FROM codes WHERE code_hash IN ('reseller-two-fixture','assigned-fixture','ambiguous-fixture','legacy-show-fixture')",
        );
        sqlite.prepare("DELETE FROM partner_apps WHERE id=?").run(app);
        sqlite.prepare("DELETE FROM resellers WHERE id=?").run(secondReseller);
      }
    },
  );
  const partnerApi = "/api/partner-control";
  assert.equal(
    (
      await post(partnerApi, "first", {
        action: "message",
        app: "show-plus",
        target: directFixture,
        title: "Bonjour",
        message: "Essai local",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(partnerApi, "first", {
        action: "message",
        app: "show-plus",
        target: reviewFixture,
        title: "Bonjour",
        message: "Essai local",
      })
    ).status,
    201,
  );
  assert.equal(
    sqlite.prepare("SELECT target_code_hash FROM messages").get().target_code_hash,
    "review-fixture",
  );
  assert.equal(
    (
      await post(partnerApi, "first", {
        action: "refresh",
        app: "show-plus",
        target: showFixture,
        kind: "epg",
      })
    ).status,
    409,
  );
  sqlite.exec("INSERT INTO partner_client_capabilities VALUES ('show-fixture','2026-11-09')");
  assert.equal(
    (
      await post(partnerApi, "first", {
        action: "refresh",
        app: "show-plus",
        target: showFixture,
        kind: "epg",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await post(partnerApi, "first", {
        action: "refresh",
        app: "show-plus",
        target: showFixture,
        kind: "epg",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(partnerApi, "first", {
        action: "server",
        app: "show-plus",
        url: "http://not-secure.example.com",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(partnerApi, "first", {
        action: "server",
        app: "show-plus",
        url: "https://stream.example.com",
        confirmed: true,
      })
    ).status,
    200,
  );
  const firstOrder = await post(partnerApi, "second", {
    action: "order",
    name: "Fixture Partner",
    packageName: "fr.fixture.player",
  });
  assert.equal(firstOrder.status, 201);
  const adminPartner = partnerApi + "?view=admin";
  const decision = {
    action: "decision",
    id: firstOrder.json.id,
    paid: true,
    receipt: "Fixture virement",
  };
  assert.equal((await post(adminPartner, "first", decision)).status, 403);
  assert.equal((await post(adminPartner, "admin", decision)).status, 200);
  assert.equal((await post(adminPartner, "admin", decision)).status, 409);
  const partnerApp = (await call(partnerApi, { token: "second" })).json.apps[0];
  assert.equal(partnerApp.name, "Fixture Partner");
  assert.equal(
    (await call("/api/show-directory?app=" + partnerApp.id, { token: "first" })).status,
    403,
  );
  const release = {
    action: "release",
    app: partnerApp.id,
    versionName: "1.0",
    versionCode: 1,
    url: "https://releases.example.com/app.apk",
    sha256: "a".repeat(64),
    changelog: "",
    initial: true,
  };
  assert.equal((await post(adminPartner, "admin", release)).status, 201);
  assert.equal(
    (await post(partnerApi, "second", { ...release, versionCode: 2, initial: false })).status,
    409,
  );
  const renewal = await post(partnerApi, "second", { action: "renew", app: partnerApp.id });
  assert.equal(renewal.status, 201);
  assert.equal(
    (await post(adminPartner, "admin", { ...decision, id: renewal.json.id })).status,
    200,
  );
  assert.equal(
    (await post(partnerApi, "second", { ...release, versionCode: 2, initial: false })).status,
    201,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) AS total FROM partner_update_periods").get().total,
    1,
  );
  const support = "/api/support-tickets";
  const ticket = await post(support, "second", {
    action: "create",
    subject: "Question de test",
    category: "application",
    message: "Message de test local",
  });
  assert.equal(ticket.status, 201);
  assert.equal((await call(support + "?id=" + ticket.json.id, { token: "first" })).status, 404);
  assert.equal(
    (await post(support, "first", { action: "status", id: ticket.json.id, status: "closed" }))
      .status,
    404,
  );
  assert.equal(
    (await post(support, "second", { action: "status", id: ticket.json.id, status: "processing" }))
      .status,
    403,
  );
  assert.equal(
    (
      await post(support + "?view=admin", "admin", {
        action: "status",
        id: ticket.json.id,
        status: "processing",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(support + "?status=processing", { token: "second" })).json.tickets[0].status,
    "processing",
  );
  assert.equal(
    (
      await post(support + "?view=admin", "admin", {
        action: "reply",
        id: ticket.json.id,
        message: "Réponse de test",
      })
    ).status,
    200,
  );
  const thread = await call(support + "?id=" + ticket.json.id, { token: "second" });
  assert.equal(thread.json.ticket.status, "waiting");
  assert.deepEqual(
    thread.json.replies.map((reply) => reply.author),
    ["customer", "support"],
  );

  const official = "/api/vyro-console";
  const releaseRequest = {
    action: "release",
    versionCode: 155,
    versionName: "0.23.9",
    sha256: "b".repeat(64),
    confirmed: true,
    apkUrl: "https://github.com/ParagoNZT/VYRO-Updates/releases/download/v0.23.9/VYRO.apk",
    changelog: "QA locale",
  };
  assert.equal((await call(official)).status, 401);
  assert.equal((await post(official, "first", releaseRequest)).status, 403);
  assert.equal((await post(official, "admin", releaseRequest)).status, 503);
  assert.equal((await call("/api/vyro-release-queue")).json.release, null);
  hasReleasePin = true;
  assert.equal(
    (await post(official, "admin", { ...releaseRequest, versionCode: 154 })).status,
    409,
  );
  assert.equal(
    (
      await post(official, "admin", {
        ...releaseRequest,
        apkUrl: "https://other.example.test/test.apk",
      })
    ).status,
    400,
  );
  assert.equal((await post(official, "admin", releaseRequest)).status, 202);
  assert.equal((await call("/api/vyro-release-queue")).json.release.versionCode, 155);
  assert.equal(
    (await post(official, "admin", { action: "withdraw", versionCode: 155 })).status,
    200,
  );
  assert.equal((await call("/api/vyro-release-queue")).json.release, null);
  assert.equal(
    (
      await post(official, "admin", {
        action: "announce",
        title: "Test privé",
        body: "Annonce de fixture isolée",
        days: 7,
        confirmed: true,
      })
    ).status,
    201,
  );
  const feed = (await call("/api/vyro-announcements")).json.announcements;
  assert.equal(feed[0].title, "Test privé");
  assert.equal(Object.hasOwn(feed[0], "actorId"), false);
  assert.equal((await post(official, "admin", { action: "revoke", id: feed[0].id })).status, 200);
  assert.deepEqual((await call("/api/vyro-announcements")).json.announcements, []);
  assert.equal(
    (
      await post(support + "?view=admin", "admin", {
        action: "status",
        id: ticket.json.id,
        status: "closed",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(support, "second", {
        action: "reply",
        id: ticket.json.id,
        message: "Tentative sur ticket fermé",
      })
    ).status,
    409,
  );
  sqlite.exec(
    "DELETE FROM show_installations WHERE code_hash='show-fixture'; DELETE FROM codes WHERE code_hash IN ('show-fixture','direct-fixture','review-fixture','partner-fixture');",
  );
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
  assert.deepEqual((await call("/api/download", { token: "first" })).json, {
    platforms: [],
  });
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
  assert.equal(
    (await call("/api/download?platform=androidmobile", { token: "first" })).status,
    404,
  );
  assert.equal(
    (await call("/api/download?platform=androidmobile", { token: "second" })).status,
    403,
  );
  const tvRelease = env.VYRO_RELEASES;
  env.VYRO_RELEASES = {
    head: async (key) =>
      key === "vyro-premium-androidmobile.apk"
        ? { size: fixtureBytes.length }
        : tvRelease.head(key),
    get: async (key) =>
      key === "vyro-premium-androidmobile.apk"
        ? { size: fixtureBytes.length, body: new Response(fixtureBytes).body }
        : tvRelease.get(key),
  };
  assert.deepEqual((await call("/api/download", { token: "first" })).json.platforms.sort(), [
    "androidmobile",
    "androidtv",
  ]);
  const mobileApk = await worker.fetch(
    new Request(origin + "/api/download?platform=androidmobile", {
      headers: { Authorization: "Bearer first" },
    }),
    env,
    ctx,
  );
  assert.equal(mobileApk.status, 200);
  assert.match(mobileApk.headers.get("content-disposition"), /androidmobile\.apk/);
  assert.deepEqual(new Uint8Array(await mobileApk.arrayBuffer()), fixtureBytes);
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

  const backupPath = "/api/settings-backups";
  const nativePath = "/api/tv-settings";
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const firstPage = () => call(backupPath, { token: "first" }).then(({ json }) => json);
  function installation(digit) {
    const id = digit.repeat(64);
    const token = "SHOWP-" + digit.toUpperCase().repeat(64);
    const deviceHash = digest(id);
    const codeHash = digest("synthetic-" + digit);
    sqlite
      .prepare("INSERT INTO codes(id,code_hash,name,created_at) VALUES(?,?,?,?)")
      .run(randomUUID(), codeHash, "Fixture SHOW+", "2026-01-01");
    sqlite
      .prepare(
        "INSERT INTO show_installations(device_hash,token_hash,code_hash,created_at) VALUES(?,?,?,?)",
      )
      .run(deviceHash, digest(token), codeHash, "2026-01-01");
    return { deviceHash, id, token, codeHash };
  }
  const tv = (install, action, fields = {}, native = true) =>
    call(nativePath, {
      native,
      body: JSON.stringify({
        version: 1,
        token: install.token,
        deviceId: install.id,
        action,
        ...fields,
      }),
    });
  const salon = installation("a");
  const chambre = installation("b");
  const other = installation("c");
  assert.equal((await call(backupPath)).status, 401);
  assert.deepEqual((await tv(salon, "poll")).json, { linked: false, command: null });
  assert.equal((await tv(salon, "poll", { token: chambre.token })).status, 403);
  assert.equal((await tv(salon, "poll", {}, false)).status, 403);
  for (const [install, owner, name, kind] of [
    [salon, "first", "Salon", "tv"],
    [chambre, "first", "Téléphone", "mobile"],
    [other, "second", "Autre", undefined],
  ]) {
    const pair = await tv(install, "pair", { name: "Fixture", kind });
    assert.equal(pair.status, 200, JSON.stringify(pair));
    assert.match(pair.json.pairingCode, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
    assert.equal(
      (await post(backupPath, owner, { action: "pair", pairingCode: pair.json.pairingCode, name }))
        .status,
      200,
    );
    assert.equal(
      (await post(backupPath, "second", { action: "pair", pairingCode: pair.json.pairingCode }))
        .status,
      409,
    );
  }
  assert.equal((await tv(salon, "pair", { name: "Fixture" })).status, 409);
  assert.equal((await firstPage()).devices.length, 2);
  assert.deepEqual((await firstPage()).devices.map((d) => d.kind).sort(), ["mobile", "tv"]);
  await tv(other, "poll", { kind: "mobile", version: 2 });
  await tv(other, "poll");
  assert.equal((await call(backupPath, { token: "second" })).json.devices[0].kind, "mobile");
  assert.equal(
    (
      await post(backupPath, "second", {
        action: "backup",
        sourceId: salon.deviceHash,
        name: "Vol",
      })
    ).status,
    409,
  );

  const settings = {
    version: 1,
    theme: "OCEAN",
    appearanceMode: "DARK",
    customAccentHex: "#A820CE",
    vodPlayerStyle: "MODERN",
    audioLanguage: "FRENCH",
    subtitlePreference: "FORCED",
    subtitleSize: "LARGE",
    subtitleTextColor: "CYAN",
    subtitleFont: "SERIF",
    subtitleBackground: "BLACK",
    interfaceScale: "STANDARD",
    animationLevel: "REDUCED",
    sidebarStyle: "SIMPLE",
    metadataLanguage: "SYSTEM",
    posterSource: "PROVIDER",
    vodPosterColumns: 8,
    showLivePreview: true,
    showNextProgramme: true,
    resumePlayback: true,
    autoplayNextEpisode: false,
    vodFullscreen: true,
    hideWatched: false,
    favoritesFirst: true,
    oledMode: false,
    categoriesVisible: true,
    compactLandscape: true,
    homeContinueWatching: true,
    homeNewMovies: true,
    homeNewSeries: true,
    homeSeriesUpdates: true,
    homeTopTmdb: true,
    tmdbLogos: true,
    tmdbBackdrops: false,
    tmdbSynopsis: true,
  };
  async function queue(payload) {
    const response = await post(backupPath, "first", payload);
    assert.equal(response.status, 202, JSON.stringify(response));
  }
  await queue({ action: "backup", sourceId: salon.deviceHash, name: "Avant changement" });
  assert.equal((await firstPage()).backups.length, 0);
  assert.equal((await tv(chambre, "poll")).json.command, null);
  const capture = (await tv(salon, "poll")).json.command;
  assert.equal(capture.phase, "capture");
  const ackCapture = { jobId: capture.id, phase: capture.phase, ok: true, settings };
  assert.equal(
    (
      await tv(salon, "complete", {
        ...ackCapture,
        settings: { ...settings, playlistUrl: "private" },
      })
    ).status,
    400,
  );
  assert.equal((await tv(salon, "complete", ackCapture)).status, 200);
  assert.equal((await tv(salon, "complete", ackCapture)).status, 200);
  const saved = (await firstPage()).backups;
  assert.equal(saved.length, 1);
  assert.deepEqual(Object.keys(saved[0]).sort(), [
    "createdAt",
    "fullProfile",
    "id",
    "name",
    "sourceName",
  ]);
  assert.equal(
    (
      await post(backupPath, "second", {
        action: "restore",
        backupId: saved[0].id,
        targetId: other.deviceHash,
      })
    ).status,
    409,
  );

  await queue({ action: "copy", sourceId: salon.deviceHash, targetId: chambre.deviceHash });
  assert.equal(
    (
      await post(backupPath, "first", {
        action: "backup",
        sourceId: chambre.deviceHash,
        name: "En parallèle",
      })
    ).status,
    409,
  );
  assert.equal((await tv(chambre, "poll")).json.command, null);
  const fresh = { ...settings, theme: "ROSE" };
  const copy = (await tv(salon, "poll")).json.command;
  assert.equal(
    (await tv(salon, "complete", { jobId: copy.id, phase: "capture", ok: true, settings: fresh }))
      .status,
    200,
  );
  assert.equal((await firstPage()).jobs.find((j) => j.id === copy.id).status, "waiting_target");
  const apply = (await tv(chambre, "poll")).json.command;
  assert.deepEqual(apply, { id: copy.id, phase: "apply", settings: fresh });
  const ackApply = { jobId: copy.id, phase: "apply", ok: true };
  assert.equal((await tv(salon, "complete", ackApply)).status, 404);
  assert.equal((await tv(chambre, "complete", ackApply)).status, 200);
  assert.equal((await tv(chambre, "complete", ackApply)).status, 200);
  assert.equal((await firstPage()).jobs.find((j) => j.id === copy.id).status, "done");
  assert.equal((await firstPage()).backups.length, 1);

  await queue({ action: "restore", backupId: saved[0].id, targetId: chambre.deviceHash });
  const restore = (await tv(chambre, "poll")).json.command;
  assert.deepEqual(restore.settings, settings);
  assert.equal(
    (await tv(chambre, "complete", { jobId: restore.id, phase: "apply", ok: true })).status,
    200,
  );
  assert.equal((await firstPage()).jobs.find((j) => j.id === restore.id).status, "done");

  const playlist = digest("synthetic playlist");
  const v2 = (install, action, fields = {}) => tv(install, action, { version: 2, ...fields });
  const viewer = (install) => digest("viewer:" + install.id);
  const poll2 = (install, ref = playlist, localViewer = viewer(install)) =>
    v2(install, "poll", { playlist: ref, viewer: localViewer });
  const bundle = {
    version: 1,
    playlist,
    visible: ["LIVE:1"],
    favorites: ["live:10"],
    watchlist: ["movie:1"],
    groups: [
      {
        id: "group-" + randomUUID(),
        name: "Chaînes du salon",
        channels: ["live:10"],
        pinned: false,
      },
    ],
    history: [
      {
        id: "episode:123",
        position: 21000,
        duration: 90000,
        updated: 120000,
        series: "series:10",
        season: 1,
        episode: 2,
      },
    ],
  };
  await poll2(salon);
  await poll2(chambre, digest("different playlist"));
  assert.equal(
    (
      await post(backupPath, "first", {
        action: "copy",
        sourceId: salon.deviceHash,
        targetId: chambre.deviceHash,
        scope: "profile",
      })
    ).status,
    409,
  );
  await poll2(chambre);
  await queue({
    action: "backup",
    sourceId: salon.deviceHash,
    name: "Profil du salon",
    scope: "profile",
  });
  const full = (await poll2(salon)).json.command;
  assert.deepEqual(full, {
    id: full.id,
    phase: "capture",
    scope: "profile",
    playlist,
    viewer: viewer(salon),
  });
  assert.equal(
    (await v2(salon, "complete", { jobId: full.id, phase: "capture", ok: true, settings })).status,
    409,
  );
  assert.equal(
    (
      await v2(salon, "complete", {
        jobId: full.id,
        phase: "capture",
        ok: true,
        settings,
        profile: { ...bundle, favorites: ["http://private"] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await v2(salon, "complete", {
        jobId: full.id,
        phase: "capture",
        ok: true,
        settings,
        profile: bundle,
      })
    ).status,
    200,
  );
  const savedProfile = (await firstPage()).backups.find((b) => b.id === full.id);
  assert.equal(savedProfile.fullProfile, 1);
  const readProfile = (token) => call(backupPath + "?backup=" + full.id, { token });
  assert.equal((await readProfile("second")).status, 404);
  const file = (await readProfile("first")).json;
  assert.deepEqual(file.profile, bundle);
  const edited = [{ id: bundle.groups[0].id, name: "Mes chaînes", pinned: true }];
  assert.equal(
    (await post(backupPath, "second", { action: "edit-groups", backupId: full.id, groups: edited }))
      .status,
    404,
  );
  assert.equal(
    (await post(backupPath, "first", { action: "edit-groups", backupId: full.id, groups: edited }))
      .status,
    200,
  );
  assert.deepEqual((await readProfile("first")).json.profile.groups[0], {
    ...bundle.groups[0],
    ...edited[0],
  });
  assert.equal(
    (await post(backupPath, "first", { action: "import", name: "Import", file })).status,
    200,
  );
  const imported = (await firstPage()).backups.find((b) => b.name === "Import");
  assert.equal(imported.fullProfile, 1);
  await queue({ action: "restore", backupId: full.id, targetId: chambre.deviceHash });
  assert.equal((await tv(chambre, "poll")).json.command, null);
  assert.equal((await poll2(chambre, digest("different playlist"))).json.command, null);
  assert.equal((await poll2(chambre, playlist, digest("different profile"))).json.command, null);
  const restoreFull = (await poll2(chambre)).json.command;
  assert.deepEqual(restoreFull.profile.groups[0], { ...bundle.groups[0], ...edited[0] });
  assert.equal(
    (await v2(chambre, "complete", { jobId: restoreFull.id, phase: "apply", ok: true })).status,
    200,
  );

  // The phone can be the source, not just the recipient of a TV backup.
  await queue({
    action: "copy",
    scope: "profile",
    sourceId: chambre.deviceHash,
    targetId: salon.deviceHash,
  });
  const phoneCapture = (await poll2(chambre)).json.command;
  const phoneProfile = { ...bundle, favorites: ["live:77"] };
  assert.equal(
    (
      await v2(chambre, "complete", {
        jobId: phoneCapture.id,
        phase: "capture",
        ok: true,
        settings,
        profile: phoneProfile,
      })
    ).status,
    200,
  );
  const tvRestore = (await poll2(salon)).json.command;
  assert.equal(tvRestore.id, phoneCapture.id);
  assert.deepEqual(tvRestore.profile, phoneProfile);
  assert.equal(
    (await v2(salon, "complete", { jobId: tvRestore.id, phase: "apply", ok: true })).status,
    200,
  );
  assert.equal((await firstPage()).jobs.find((job) => job.id === tvRestore.id).status, "done");

  const sync = await post(backupPath, "first", {
    action: "sync-on",
    sourceId: salon.deviceHash,
    targetId: chambre.deviceHash,
  });
  assert.equal(sync.status, 200, JSON.stringify(sync));
  assert.equal((await firstPage()).sync.sourceId, salon.deviceHash);
  const syncCapture = (await poll2(salon)).json.command;
  assert.equal(syncCapture.scope, "profile");
  assert.equal(
    (
      await v2(salon, "complete", {
        jobId: syncCapture.id,
        phase: "capture",
        ok: true,
        settings,
        profile: bundle,
      })
    ).status,
    200,
  );
  assert.equal((await poll2(chambre)).json.command.id, syncCapture.id);
  assert.equal(
    (await v2(chambre, "complete", { jobId: syncCapture.id, phase: "apply", ok: true })).status,
    200,
  );
  sqlite.prepare("UPDATE tv_settings_sync SET next_at='2020-01-01'").run();
  assert.equal(
    (await poll2(salon, playlist, digest("different source profile"))).json.command,
    null,
  );
  assert.equal((await firstPage()).sync.paused, 1);
  const unchanged = (await poll2(salon)).json.command;
  assert.equal(
    (
      await v2(salon, "complete", {
        jobId: unchanged.id,
        phase: "capture",
        ok: true,
        settings,
        profile: bundle,
      })
    ).status,
    200,
  );
  assert.equal(
    (await poll2(chambre)).json.command,
    null,
    "An unchanged snapshot must not be reapplied",
  );
  assert.equal((await firstPage()).jobs.find((j) => j.id === unchanged.id).unchanged, 1);
  sqlite.prepare("UPDATE tv_settings_sync SET next_at='2020-01-01'").run();
  const pendingSync = (await poll2(salon)).json.command;
  assert.ok(pendingSync);
  assert.equal((await post(backupPath, "first", { action: "sync-off" })).status, 200);
  assert.equal((await poll2(salon)).json.command, null);
  assert.equal((await firstPage()).sync, null);
  for (const backupId of [full.id, imported.id]) {
    assert.equal((await post(backupPath, "first", { action: "delete", backupId })).status, 200);
  }

  await queue({ action: "restore", backupId: saved[0].id, targetId: chambre.deviceHash });
  assert.equal(
    (await post(backupPath, "second", { action: "unlink", deviceId: chambre.deviceHash })).status,
    404,
  );
  assert.equal(
    (await post(backupPath, "first", { action: "unlink", deviceId: chambre.deviceHash })).status,
    200,
  );
  assert.deepEqual((await tv(chambre, "poll")).json, { linked: false, command: null });
  assert.equal((await firstPage()).backups.length, 1);

  await t.test("QR, encrypted playlists, layouts and private backups", async (t) => {
    const endpoint = "/api/remote-workspace";
    const native = "/api/remote-device";
    const pairKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicKey = pairKey.publicKey.export({ type: "spki", format: "der" }).toString("base64");
    function device() {
      const id = randomUUID(),
        token = randomBytes(32).toString("hex");
      return {
        id,
        send: (payload) =>
          call(native, { native: true, body: JSON.stringify({ id, token, ...payload }) }),
      };
    }
    const tvDevice = device(),
      phone = device(),
      other = device();
    const browser = (payload, token = "first") => post(endpoint, token, payload);
    async function pair(inst, kind, owner = "first", edition = "vyro") {
      const result = await inst.send({ action: "pair", edition, kind, name: kind, publicKey });
      assert.equal(result.status, 200, JSON.stringify(result));
      const { proof } = result.json;
      assert.equal((await browser({ action: "preview", proof }, owner)).json.edition, edition);
      assert.equal((await browser({ action: "claim", proof }, owner)).status, 200);
      assert.equal((await browser({ action: "claim", proof }, "admin")).status, 409);
    }
    await pair(tvDevice, "tv");
    await pair(phone, "mobile");
    await pair(other, "tv", "second", "show-plus");
    const myDevices = (await call("/api/account", { token: "first" })).json;
    assert.deepEqual(
      myDevices.remoteDevices.map((d) => d.id).sort(),
      [tvDevice.id, phone.id].sort(),
    );
    assert.deepEqual(Object.keys(myDevices.remoteDevices[0]).sort(), [
      "edition",
      "id",
      "kind",
      "lastSeen",
      "name",
    ]);
    assert.equal(myDevices.subscription.devicesUsed, myDevices.devices.length);
    assert.ok(
      myDevices.devices.every((device) => device.id !== tvDevice.id && device.id !== phone.id),
    );
    const otherDevices = (await call("/api/account", { token: "second" })).json;
    assert.deepEqual(
      otherDevices.remoteDevices.map((d) => d.id),
      [other.id],
    );
    const playlist = bundle.playlist;
    const context = "a".repeat(64);
    const groups = bundle.groups;
    const manifest = {
      context,
      active: playlist,
      playlists: [{ id: playlist, name: "Démo", kind: "m3u", editable: true }],
      categories: [{ id: "LIVE:1", name: "Infos" }],
      channels: [{ id: "live:123", name: "Démo" }],
      layout: { visible: null, groups },
      layoutComplete: true,
    };
    assert.equal((await tvDevice.send({ action: "poll", catalog: manifest })).status, 200);
    assert.equal((await phone.send({ action: "poll", catalog: manifest })).status, 200);
    assert.equal((await other.send({ action: "poll", catalog: manifest })).status, 200);
    const inbox = "/api/vyro-inbox";
    const inboxAdmin = inbox + "?view=admin";
    sqlite.prepare("UPDATE clients SET first_name='Test Salon' WHERE id=?").run(clientId);
    const recipients = await call(inboxAdmin + "&q=Test%20Salon", { token: "admin" });
    assert.equal(recipients.status, 200);
    assert.equal(recipients.json.recipients[0].id, clientId);
    assert.equal(recipients.json.recipients[0].devices, 2);
    assert.equal((await call(inboxAdmin + "&q=Test%20Salon", { token: "second" })).status, 403);
    assert.equal(
      (
        await post(inboxAdmin, "second", {
          action: "send",
          client: clientId,
          title: "Pas autorisé",
          body: "Test privé",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post(inboxAdmin, "admin", {
          action: "send",
          client: clientId,
          title: "Test privé",
          body: "Uniquement sur le compte Salon",
        })
      ).status,
      201,
    );
    const privateFeed = (await call(inbox, { token: "first" })).json.messages;
    assert.equal(privateFeed.length, 1);
    const privateMessage = privateFeed[0];
    assert.equal(privateMessage.sender, "VYRO QA");
    assert.deepEqual((await call(inbox, { token: "second" })).json.messages, []);
    assert.ok(
      !(await call("/api/vyro-announcements")).json.announcements.some(
        (m) => m.id === privateMessage.id,
      ),
    );
    assert.deepEqual(
      (await tvDevice.send({ action: "poll", catalog: manifest, inbox: true })).json.messages,
      privateFeed,
    );
    assert.equal(
      (await other.send({ action: "poll", catalog: manifest, inbox: true })).json.messages,
      undefined,
    );
    assert.equal(
      (
        await other.send({
          action: "message-receipt",
          messageId: privateMessage.id,
          receipt: "read",
        })
      ).status,
      403,
    );
    assert.equal(
      (await post(inbox, "second", { action: "read", id: privateMessage.id })).status,
      200,
    );
    assert.equal((await call(inbox, { token: "first" })).json.messages[0].read, false);
    assert.equal(
      (
        await phone.send({
          action: "message-receipt",
          messageId: privateMessage.id,
          receipt: "read",
        })
      ).status,
      200,
    );
    assert.equal((await call(inbox, { token: "first" })).json.messages[0].read, true);
    assert.equal(
      (await post(inbox, "first", { action: "dismiss", id: privateMessage.id })).status,
      200,
    );
    assert.deepEqual(
      (await tvDevice.send({ action: "poll", catalog: manifest, inbox: true })).json.messages,
      [],
    );
    assert.equal((await call(endpoint, { token: "first" })).json.devices.length, 2);
    assert.equal((await call(endpoint, { token: "admin" })).json.devices.length, 0);
    assert.equal(
      (await browser({ action: "backup", device: other.id, name: "Privé", full: true })).status,
      404,
    );
    assert.equal(
      (
        await browser(
          { action: "playlist", device: other.id, context, playlist, name: "Autre" },
          "second",
        )
      ).status,
      400,
    );
    const layout = {
      visible: ["LIVE:1"],
      groups: [
        { id: "group-" + randomUUID(), name: "Infos", pinned: true, channels: ["live:123"] },
      ],
    };
    assert.equal(
      (
        await browser({
          action: "layout",
          device: tvDevice.id,
          context: "e".repeat(64),
          playlist,
          layout,
        })
      ).status,
      409,
    );
    assert.equal(
      (await browser({ action: "layout", device: tvDevice.id, context, playlist, layout })).status,
      202,
    );
    const action = (await tvDevice.send({ action: "poll", catalog: manifest })).json.job;
    assert.deepEqual(action.payload.layout, layout);
    assert.equal((await browser({ action: "cancel", job: action.id })).status, 409);
    await phone.send({ action: "complete", jobId: action.id, ok: true });
    assert.equal(
      (await tvDevice.send({ action: "poll", catalog: manifest })).json.job.id,
      action.id,
    );
    await tvDevice.send({ action: "complete", jobId: action.id, ok: true });
    assert.equal((await tvDevice.send({ action: "poll", catalog: manifest })).json.job, null);

    const url = "https://playlist.example.test/list.m3u?password=fixture-secret";
    const sealed = await sealPlaylistUrl(publicKey, url, tvDevice.id);
    assert.equal(
      (
        await browser({
          action: "playlist",
          device: tvDevice.id,
          context,
          playlist,
          name: "Démo M3U",
          sealed,
        })
      ).status,
      202,
    );
    const queued = (await tvDevice.send({ action: "poll", catalog: manifest })).json.job;
    assert.deepEqual(queued.payload.sealed, sealed);
    assert.doesNotMatch(
      sqlite.prepare("SELECT payload FROM remote_jobs WHERE id=?").get(queued.id).payload,
      /fixture-secret/,
    );
    await tvDevice.send({ action: "complete", jobId: queued.id, ok: true });
    assert.equal(
      sqlite.prepare("SELECT payload FROM remote_jobs WHERE id=?").get(queued.id).payload,
      null,
    );

    assert.equal(
      (await browser({ action: "backup", device: tvDevice.id, name: "Salon", full: true })).status,
      202,
    );
    const capture = (await tvDevice.send({ action: "poll", catalog: manifest })).json.job;
    assert.equal(capture.kind, "backup");
    assert.equal(
      (
        await tvDevice.send({
          action: "complete",
          jobId: capture.id,
          ok: true,
          settings,
          profile: bundle,
        })
      ).status,
      200,
    );
    const file = await call(endpoint + "?backup=" + capture.id, { token: "first" });
    assert.deepEqual(file.json.profile, bundle);
    assert.equal((await call(endpoint + "?backup=" + capture.id, { token: "second" })).status, 404);
    assert.equal((await call(endpoint + "?backup=" + capture.id, { token: "admin" })).status, 404);
    await t.test("suspension stops paired devices and remote workspace access", async () => {
      const backup = (device) => ({ action: "backup", device, name: "Suspension", full: false });
      assert.equal((await browser(backup(tvDevice.id))).status, 202);
      assert.equal((await browser(backup(phone.id))).status, 202);
      const delivered = (await phone.send({ action: "poll", catalog: manifest })).json.job;
      assert.equal(delivered.kind, "backup");
      const changeStatus = (status) =>
        post(manage, "admin", {
          action: "client-status",
          clientId,
          status,
          note: "Vérification de la suspension",
        });
      assert.equal((await changeStatus("suspended")).status, 200);
      try {
        assert.equal((await call(portal, { token: "first" })).status, 403);
        assert.equal((await call(endpoint, { token: "first" })).status, 403);
        assert.equal(
          (await call(endpoint + "?backup=" + capture.id, { token: "first" })).status,
          403,
        );
        assert.equal((await browser(backup(tvDevice.id))).status, 403);
        assert.deepEqual((await tvDevice.send({ action: "poll", catalog: manifest })).json, {
          linked: false,
        });
        assert.equal(
          (
            await phone.send({
              action: "complete",
              jobId: delivered.id,
              ok: true,
              settings,
            })
          ).status,
          403,
        );
        assert.equal((await other.send({ action: "poll", catalog: manifest })).json.linked, true);
      } finally {
        assert.equal((await changeStatus("active")).status, 200);
      }
      assert.equal((await call(endpoint, { token: "first" })).json.devices.length, 2);
      const pending = (await tvDevice.send({ action: "poll", catalog: manifest })).json.job;
      assert.equal(pending.kind, "backup");
      assert.equal(
        (await tvDevice.send({ action: "complete", jobId: pending.id, ok: false })).status,
        200,
      );
      assert.equal(
        (await phone.send({ action: "complete", jobId: delivered.id, ok: false })).status,
        200,
      );
    });
    const imported = await browser({ action: "import", name: "Import JSON", file: file.json });
    assert.equal(imported.status, 200);
    await phone.send({ action: "poll", catalog: { ...manifest, active: "b".repeat(64) } });
    assert.equal(
      (await browser({ action: "restore", device: phone.id, backup: capture.id })).status,
      409,
    );
    await phone.send({ action: "poll", catalog: manifest });
    assert.equal(
      (await browser({ action: "restore", device: phone.id, backup: capture.id })).status,
      202,
    );
    const restore = (await phone.send({ action: "poll", catalog: manifest })).json.job;
    assert.deepEqual(restore.payload.profile, bundle);
    await phone.send({ action: "complete", jobId: restore.id, ok: true });
    assert.equal((await browser({ action: "unlink", device: tvDevice.id }, "second")).status, 404);
    assert.equal((await browser({ action: "unlink", device: tvDevice.id })).status, 200);
    assert.equal((await tvDevice.send({ action: "poll", catalog: manifest })).json.linked, false);
    assert.deepEqual(
      (await call("/api/account", { token: "first" })).json.remoteDevices.map((d) => d.id),
      [phone.id],
    );
  });

  await t.test("white label order, separate coverage and admin deadlines", async () => {
    const logoPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=";
    assert.equal(
      (
        await post(partnerApi, "second", {
          action: "order",
          name: "Bad logo",
          packageName: "fr.studio.badlogo",
          logoPng: "not-base64",
        })
      ).status,
      400,
    );
    const ordered = await post(partnerApi, "second", {
      action: "order",
      name: "Studio Démo",
      packageName: "fr.studio.demo",
      accent: "#4455aa",
      brief: "Version TV et téléphone",
      logoPng,
      updates: true,
    });
    assert.equal(ordered.status, 201, JSON.stringify(ordered));
    const pending = (await call(partnerApi, { token: "second" })).json.orders.find(
      (order) => order.id === ordered.json.id,
    );
    assert.equal(pending.status, "pending");
    assert.equal(pending.cents, 10000);
    assert.equal(pending.hasLogo, 1);
    assert.equal(pending.logoPng, undefined);
    const logoPath = partnerApi + "?orderLogo=" + ordered.json.id;
    assert.equal((await call(logoPath, { token: "first" })).status, 404);
    assert.equal((await call(logoPath + "&view=admin", { token: "first" })).status, 403);
    assert.deepEqual((await call(logoPath, { token: "second" })).json, { logoPng });
    assert.deepEqual((await call(logoPath + "&view=admin", { token: "admin" })).json, { logoPng });
    const adminPath = partnerApi + "?view=admin";
    const decide = (id) =>
      post(adminPath, "admin", { action: "decision", id, paid: true, receipt: "REG TEST" });
    assert.equal((await decide(ordered.json.id)).status, 200);
    const orderPage = (await call(partnerApi, { token: "second" })).json;
    assert.equal(orderPage.orders.find((o) => o.id === ordered.json.id).stage, "preparing");
    const renewal = orderPage.orders.find((o) => o.name === "Studio Démo" && o.kind === "updates");
    assert.equal(renewal.status, "pending");
    assert.equal(renewal.cents, 2000);
    const app = orderPage.apps.find((a) => a.name === "Studio Démo");
    assert.equal(app.coveredUntil, null);
    assert.equal((await decide(renewal.id)).status, 200);
    assert.equal((await decide(renewal.id)).status, 409);
    assert.equal(
      sqlite.prepare("SELECT count(*) AS n FROM partner_update_periods WHERE app_id=?").get(app.id)
        .n,
      1,
    );
    const upcoming = randomUUID();
    sqlite
      .prepare(
        "INSERT INTO codes(id,code_hash,name,created_at,expires_at,reseller_id) VALUES(?,?,?,?,?,?)",
      )
      .run(
        upcoming,
        "upcoming-fixture",
        "Accès démo",
        new Date().toISOString(),
        new Date(Date.now() + 5 * 86400_000).toISOString(),
        resellerCode,
      );
    const deadlines = "/api/admin-deadlines?kind=access&horizon=7";
    assert.equal((await call(deadlines, { token: "second" })).status, 403);
    const result = await call(deadlines + "&owner=r:" + resellerCode, { token: "admin" });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.ok(result.json.rows.some((row) => row.id === upcoming));
    assert.ok(result.json.rows.every((row) => row.owner === "Other reseller"));
  });

  sqlite.prepare("UPDATE clients SET status='suspended' WHERE id=?").run(clientId);
  assert.equal((await call(backupPath, { token: "first" })).status, 403);
  assert.deepEqual((await tv(salon, "poll")).json, { linked: false, command: null });
});
