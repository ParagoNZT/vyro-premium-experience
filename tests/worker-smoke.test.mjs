import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
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
  insertAccess.run(reviewFixture, "review-fixture", "SHOW+ · Unconfirmed label", fixtureDate, null);
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
    [showFixture],
  );
  for (const [scope, expected] of [
    ["all", [directFixture, reviewFixture, partnerFixture, showFixture]],
    ["direct", [directFixture]],
    ["show-plus", [showFixture]],
    ["review", [reviewFixture]],
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
  sqlite.prepare("UPDATE clients SET status='suspended' WHERE id=?").run(clientId);
  assert.equal((await call(backupPath, { token: "first" })).status, 403);
  assert.deepEqual((await tv(salon, "poll")).json, { linked: false, command: null });
});
