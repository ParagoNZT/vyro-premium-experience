import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, body, identity, json, limitedBody } from "./access.server.ts";

test("the server validates a Supabase session before granting admin privileges", async (t) => {
  process.env["SUPABASE_URL"] = "https://auth.example.test";
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_fixture";
  process.env["VYRO_ADMIN_USER_ID"] = "immutable-admin";
  delete process.env["VYRO_ADMIN_EMAIL"];
  let user = {
    id: "different",
    email: "owner@example.test",
    email_confirmed_at: "2026-01-01",
    user_metadata: { role: "admin" },
  };
  const verify = t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://auth.example.test/auth/v1/user");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer fixture");
    assert.equal(new Headers(init.headers).get("apikey"), "sb_publishable_fixture");
    return Response.json(user);
  });
  await assert.rejects(identity(new Request("https://site.example.test/api/manage"), true), {
    status: 401,
  });
  assert.equal(verify.mock.callCount(), 0);
  const request = new Request("https://site.example.test/api/manage", {
    headers: { authorization: "Bearer fixture" },
  });
  await assert.rejects(identity(request, true), { status: 403 });
  user = { ...user, id: "immutable-admin", email_confirmed_at: "" };
  await assert.rejects(identity(request, true), { status: 401 });
  user = { ...user, email_confirmed_at: "2026-01-01" };
  assert.equal((await identity(request, true)).id, "immutable-admin");
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_secret_fixture";
  await assert.rejects(identity(request, true), { status: 503 });
  assert.equal(verify.mock.callCount(), 3);
});

test("portal writes require the configured origin and bounded JSON input", async () => {
  process.env["VYRO_SITE_ORIGIN"] = "https://site.example.test";
  const post = (origin: string, content: string, type = "application/json") =>
    new Request("https://proxy.example.test/api/manage", {
      method: "POST",
      headers: { origin, "content-type": type },
      body: content,
    });
  assert.deepEqual(await body(post("https://site.example.test", '{"action":"example"}')), {
    action: "example",
  });
  await assert.rejects(body(post("https://proxy.example.test", "{}")), { status: 403 });
  await assert.rejects(body(post("https://site.example.test", "{}", "application/jsonp")), {
    status: 415,
  });
  await assert.rejects(body(post("https://site.example.test", "é".repeat(9000))), { status: 413 });
  await assert.rejects(body(post("https://site.example.test", "{")), { status: 400 });
  await assert.rejects(limitedBody(post("https://site.example.test", "abcd"), 3), ApiError);
  assert.equal(json({}).headers.get("cache-control"), "private, no-store");
});
