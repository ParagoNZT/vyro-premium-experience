import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { showScope } from "../src/lib/partner-scope.ts";

// Apply to the captured, reviewed production module. Every hook must match
// once: a later production baseline must be inspected before adapting it.
const [baseline, target] = process.argv.slice(2);
if (!baseline || !target) throw new Error("Pass the captured Worker and an output directory.");
let worker = readFileSync(baseline, "utf8").replaceAll("\r\n", "\n");
function replace(from, to) {
  if (worker.split(from).length !== 2)
    throw new Error("Unmatched production hook: " + from.slice(0, 100));
  worker = worker.replace(from, to);
}
worker = `import { createPartnerRuntime } from "./partner-runtime.mjs";\n` + worker;
replace(
  "export {\n  bindSql,\n",
  `const partnerRuntime = createPartnerRuntime(${JSON.stringify(showScope)},
  { json: json2, ApiError, installation: showInstallationIdentity, binding: requireBinding, readBody });
export {
  bindSql,
`,
);
replace(
  'if (request.method === "GET" && url.pathname === "/v1/beta/update") return await getBetaUpdate(env);',
  `if (request.method === "GET" && url.pathname === "/v1/beta/update") return await getBetaUpdate(env);
      if (request.method === "POST" && ["/v1/show/partner-control","/v1/show/partner-control/update"].includes(url.pathname))
        return await partnerRuntime.deviceRequest(request,env);`,
);
replace(
  "  let codeHash = existing?.codeHash;\n",
  `  const partnerApp = await partnerRuntime.requestedApp(env,body);
  let codeHash = existing?.codeHash;
`,
);
replace(
  "    let legacy = null;\n    const previous = String(body.previousCode",
  '    let legacy = null;\n    const previous = partnerApp ? "" : String(body.previousCode',
);
replace(
  "    const name = `SHOW+ \\xB7 ${legacy?.name",
  '    const name = `${partnerApp?.name || "SHOW+"} \\xB7 ${legacy?.name',
);
replace(
  "    if (legacy) statements.push(env.DB.prepare(`INSERT INTO remote_playlists",
  `    if (partnerApp) statements.push(env.DB.prepare("INSERT INTO partner_app_devices(code_hash,app_id) VALUES (?,?)").bind(codeHash,partnerApp.id));
    if (legacy) statements.push(env.DB.prepare(\`INSERT INTO remote_playlists`,
);
replace(
  '  await recordDevice2(env, codeHash, deviceHash, body.device, now);\n  const setting = await env.DB.prepare("SELECT server_url AS url FROM beta_settings WHERE id = 1").first();',
  `  await partnerRuntime.ensureIdentity(env,codeHash,partnerApp);
  await recordDevice2(env, codeHash, deviceHash, body.device, now);
  const setting = await partnerRuntime.managedServer(env,codeHash);`,
);
replace(
  '  const server = (publicInstallation ? !assigned : body.useLocalXtream === true || xtreamSession) ? await env.DB.prepare("SELECT server_url AS url, updated_at AS updatedAt FROM beta_settings WHERE id = 1").first() : null;',
  `  const scopedApp = await partnerRuntime.registeredApp(env,codeHash);
  const customApp = Boolean(scopedApp && scopedApp.id !== "show-plus");
  const server = (publicInstallation ? !assigned : body.useLocalXtream === true || xtreamSession)
    ? await partnerRuntime.managedServer(env,codeHash) : null;`,
);
replace(
  "WHERE h.message_id IS NULL AND (m.target_code_hash IS NULL OR m.target_code_hash = ? OR m.target_code_hash = ?)\n",
  `WHERE h.message_id IS NULL AND (m.target_code_hash IS NULL OR m.target_code_hash = ? OR m.target_code_hash = ?)
      AND (?=0 OR m.target_code_hash IS NOT NULL)
`,
);
replace(
  ".bind(deviceHash, deviceHash, deviceHash, codeHash, legacyCodeHash ?? null, codeHash, now, codeHash, deviceHash)",
  ".bind(deviceHash, deviceHash, deviceHash, codeHash, legacyCodeHash ?? null, Number(customApp), codeHash, now, codeHash, deviceHash)",
);
replace(
  "  if (publicInstallation) {\n    try {\n      targeted",
  "  if (publicInstallation && !customApp) {\n    try {\n      targeted",
);
replace(
  'playlist: server ? { type: "xtream", name: "SHOW+", url: server.url',
  'playlist: server ? { type: "xtream", name: scopedApp?.name || "SHOW+", url: server.url',
);
const dir = resolve(target);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "worker.mjs"), worker);
copyFileSync(new URL("./partner-runtime.mjs", import.meta.url), join(dir, "partner-runtime.mjs"));
