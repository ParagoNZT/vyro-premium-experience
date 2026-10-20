import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAdminIdentity } from "./admin-policy.ts";

const verified = { id: "verified-user", email: "owner@example.com", email_confirmed_at: "2026-10-20T10:00:00Z" };
describe("admin authorization after Supabase identity verification", () => {
  it("allows only the configured verified email", () => {
    assert.equal(isAdminIdentity(verified, " OWNER@example.com "), true);
    assert.equal(isAdminIdentity({ ...verified, email: "other@example.com" }, "owner@example.com"), false);
  });
  it("denies unverified and anonymous identities", () => {
    assert.equal(isAdminIdentity({ ...verified, email_confirmed_at: undefined }, "owner@example.com"), false);
    assert.equal(isAdminIdentity({ ...verified, is_anonymous: true }, "owner@example.com"), false);
  });
  it("fails closed without server configuration or identity", () => {
    assert.equal(isAdminIdentity(verified, undefined), false);
    assert.equal(isAdminIdentity(verified, "  "), false);
    assert.equal(isAdminIdentity({ ...verified, id: "" }, "owner@example.com"), false);
  });
  it("does not grant roles supplied in user-editable metadata", () => {
    const forged = { ...verified, email: "other@example.com", user_metadata: { role: "admin", is_admin: true } };
    assert.equal(isAdminIdentity(forged, "owner@example.com"), false);
  });
});
