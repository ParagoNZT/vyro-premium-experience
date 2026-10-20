import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { exportResellerConfig, resellerSchema, xcServerSchema } from "./reseller";

describe("Reseller XC configuration", () => {
  test("customer enters only username and password, server is preconfigured", () => {
    const result = exportResellerConfig({ name: "Pavel TV", package_name: "com.pavel.tv", servers: [{ name: "Principal", url: "https://xc.example.com:443" }] }, null);
    assert.deepEqual(result.loginFields, ["username", "password"]);
    assert.equal(result.servers[0]?.url, "https://xc.example.com:443");
    assert.equal(result.serverSelection, "preconfigured");
  });
  test("playlist credentials cannot be embedded in server URLs", () => {
    assert.equal(xcServerSchema.safeParse({ name: "XC", url: "https://xc.example.com/get.php?username=client&password=secret" }).success, false);
    assert.equal(xcServerSchema.safeParse({ name: "XC", url: "https://user:pass@xc.example.com" }).success, false);
  });
  test("name and logo reference are preserved", () => {
    const result = exportResellerConfig({ name: "Pavel TV", package_name: "com.pavel.tv", servers: [{ name: "XC", url: "https://xc.example.com" }] }, "owner/logo.png");
    assert.equal(result.name, "Pavel TV");
    assert.equal(result.logoPath, "owner/logo.png");
  });
  test("requires a server", () => {
    assert.equal(resellerSchema.safeParse({ name: "TV", package_name: "com.tv.app", servers: [] }).success, false);
  });
});