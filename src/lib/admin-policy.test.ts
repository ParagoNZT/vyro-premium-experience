import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAdminIdentity } from "./admin-policy.ts";

const id = "7d749cd8-18a5-4cf6-9b57-64c92451f9a8";
const identity = {
  id,
  email: "verified@example.com",
  email_confirmed_at: "2026-10-20T00:00:00.000Z",
};

describe("admin authorization after Supabase identity verification", () => {
  it("requires the configured identity, even when another account has the same email", () => {
    assert.equal(isAdminIdentity(identity, id), true);
    assert.equal(isAdminIdentity(identity, id, " Verified@EXAMPLE.com "), true);
    assert.equal(isAdminIdentity({ ...identity, id: "different-user" }, id, identity.email), false);
    assert.equal(isAdminIdentity(identity, id, "other@example.com"), false);
  });
  it("denies unverified and anonymous identities and does not accept an email-only configuration", () => {
    assert.equal(isAdminIdentity({ ...identity, email_confirmed_at: "" }, id), false);
    assert.equal(isAdminIdentity({ ...identity, is_anonymous: true }, id), false);
    assert.equal(isAdminIdentity(identity, undefined, identity.email), false);
  });
  it("ignores roles in user-editable metadata", () => {
    assert.equal(
      isAdminIdentity({ ...identity, id: "other", user_metadata: { role: "admin" } }, id),
      false,
    );
  });
});
