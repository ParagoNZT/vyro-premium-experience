import assert from "node:assert/strict";
import test from "node:test";
import { candidate, validateApkReport } from "./sync-vyro.mjs";

test("the official channel rejects a rebrand, debug build, wrong signer, and off-repo APK", () => {
  const signature = "a".repeat(64);
  const signer = `Signer #1 certificate SHA-256 digest: ${signature}\n`;
  const asset = "https://github.com/ParagoNZT/VYRO-Updates/releases/download/v0.24.50/VYRO.apk";
  const queued = candidate({
    versionCode: 205,
    versionName: "0.24.50",
    apkUrl: asset,
    sha256: "b".repeat(64),
    changelog: "",
  });
  const badging = "package: name='com.vyro.tv' versionCode='205' versionName='0.24.50'\n";
  assert.doesNotThrow(() => validateApkReport(badging, signer, queued, signature));
  assert.throws(
    () =>
      validateApkReport(
        badging.replace("com.vyro.tv", "com.vyro.tv.beta"),
        signer,
        queued,
        signature,
      ),
    /paquet/,
  );
  assert.throws(
    () => validateApkReport(badging + "application-debuggable\n", signer, queued, signature),
    /paquet/,
  );
  assert.throws(() => validateApkReport(badging, signer, queued, "c".repeat(64)), /certificat/);
  assert.throws(
    () => candidate({ ...queued, apkUrl: asset.replace("ParagoNZT", "outside") }),
    /invalide/,
  );
});
