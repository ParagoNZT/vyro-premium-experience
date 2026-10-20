import { describe, expect, test } from "bun:test";
import { exportResellerConfig, resellerSchema, xcServerSchema } from "./reseller";

describe("Reseller XC configuration", () => {
  test("customer enters only username and password, server is preconfigured", () => {
    const result = exportResellerConfig({ name: "Pavel TV", package_name: "com.pavel.tv", servers: [{ name: "Principal", url: "https://xc.example.com:443" }] }, null);
    expect(result.loginFields).toEqual(["username", "password"]);
    expect(result.servers[0].url).toBe("https://xc.example.com:443");
    expect(result.serverSelection).toBe("preconfigured");
  });
  test("playlist credentials cannot be embedded in server URLs", () => {
    expect(xcServerSchema.safeParse({ name: "XC", url: "https://xc.example.com/get.php?username=client&password=secret" }).success).toBe(false);
    expect(xcServerSchema.safeParse({ name: "XC", url: "https://user:pass@xc.example.com" }).success).toBe(false);
  });
  test("name and logo reference are preserved", () => {
    const result = exportResellerConfig({ name: "Pavel TV", package_name: "com.pavel.tv", servers: [{ name: "XC", url: "https://xc.example.com" }] }, "owner/logo.png");
    expect(result.name).toBe("Pavel TV");
    expect(result.logoPath).toBe("owner/logo.png");
  });
  test("requires a server", () => {
    expect(resellerSchema.safeParse({ name: "TV", package_name: "com.tv.app", servers: [] }).success).toBe(false);
  });
});