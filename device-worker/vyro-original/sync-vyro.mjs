import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const site = "https://vyro-player.app/api/vyro-release-queue";
const packageId = "com.vyro.tv";
const allowedAsset =
  /^https:\/\/github\.com\/ParagoNZT\/VYRO-Updates\/releases\/download\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.apk$/;
const hash = /^[a-f0-9]{64}$/;

export function candidate(value) {
  if (value === null) return null;
  if (
    !value ||
    !Number.isSafeInteger(value.versionCode) ||
    value.versionCode < 1 ||
    value.versionCode > 10_000_000 ||
    typeof value.versionName !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(value.versionName) ||
    typeof value.apkUrl !== "string" ||
    value.apkUrl.length > 512 ||
    !allowedAsset.test(value.apkUrl) ||
    typeof value.sha256 !== "string" ||
    !hash.test(value.sha256) ||
    typeof value.changelog !== "string" ||
    value.changelog.length > 1200
  )
    throw Error("Demande VYRO invalide.");
  const url = new URL(value.apkUrl);
  if (url.href !== value.apkUrl) throw Error("Lien APK non canonique.");
  return {
    versionCode: value.versionCode,
    versionName: value.versionName,
    apkUrl: value.apkUrl,
    changelog: value.changelog,
    sha256: value.sha256,
  };
}

async function currentRequest() {
  const response = await fetch(site, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error("Le panneau VYRO ne répond pas.");
  const bytes = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 8192) throw Error("Réponse VYRO trop grande.");
    bytes.push(Buffer.from(chunk));
  }
  return candidate(JSON.parse(Buffer.concat(bytes).toString("utf8")).release);
}

async function sdkTools() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw Error("Le SDK Android n’est pas installé.");
  const directory = join(sdk, "build-tools");
  const builds = (await readdir(directory))
    .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (!builds[0]) throw Error("Les outils de vérification Android sont indisponibles.");
  return {
    apksigner: join(directory, builds[0], "apksigner"),
    aapt: join(directory, builds[0], "aapt"),
  };
}

export function validateApkReport(badging, certificate, requested, trustedSigner) {
  const metadata = /^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m.exec(
    badging,
  );
  if (
    !metadata ||
    metadata[1] !== packageId ||
    Number(metadata[2]) !== requested.versionCode ||
    metadata[3] !== requested.versionName ||
    /^application-debuggable$/m.test(badging)
  )
    throw Error("L’APK ne correspond pas au paquet et à la version VYRO annoncés.");
  const signers = [
    ...certificate.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})\s*$/gim),
  ];
  if (signers.length !== 1 || signers[0][1].toLowerCase() !== trustedSigner)
    throw Error("Le certificat de signature ne correspond pas à VYRO.");
}

async function sync() {
  const selected = await currentRequest();
  if (!selected) return console.log("Aucune demande de publication.");
  const baseline = JSON.parse(await readFile("latest.json", "utf8"));
  if (!Number.isSafeInteger(baseline.versionCode))
    throw Error("Le manifeste officiel est illisible.");
  if (selected.versionCode <= baseline.versionCode)
    return console.log("La demande ne dépasse pas la version diffusée.");
  const pin = (await readFile("trusted-signer.sha256", "utf8")).trim();
  if (!hash.test(pin)) throw Error("Le certificat officiel VYRO n’est pas configuré.");
  const tools = await sdkTools();
  const directory = await mkdtemp(join(tmpdir(), "vyro-apk-"));
  try {
    const apk = join(directory, "release.apk");
    execFileSync(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--max-redirs",
        "5",
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--max-filesize",
        "104857600",
        "--max-time",
        "120",
        "--output",
        apk,
        "--",
        selected.apkUrl,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    const digest = createHash("sha256");
    for await (const bytes of createReadStream(apk)) digest.update(bytes);
    if (digest.digest("hex") !== selected.sha256) throw Error("Empreinte APK incorrecte.");
    const certificate = execFileSync(tools.apksigner, ["verify", "--print-certs", apk], {
      encoding: "utf8",
    });
    const badging = execFileSync(tools.aapt, ["dump", "badging", apk], { encoding: "utf8" });
    validateApkReport(badging, certificate, selected, pin);
    if (JSON.stringify(await currentRequest()) !== JSON.stringify(selected)) {
      console.log("La demande a été modifiée pendant la vérification.");
      return;
    }
    await writeFile("latest.json", JSON.stringify(selected, null, 2) + "\n");
    console.log(`APK VYRO vérifié : build ${selected.versionCode}.`);
  } finally {
    // Both names are created in this invocation, never derived from input.
    await rm(join(directory, "release.apk"), { force: true });
    await rmdir(directory);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await sync();
