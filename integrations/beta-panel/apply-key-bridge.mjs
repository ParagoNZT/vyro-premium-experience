import {readFileSync,writeFileSync} from "node:fs";
import {dirname,relative,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const [input,output]=process.argv.slice(2);
if(!input||!output||input===output)throw Error("Usage: node apply-key-bridge.mjs active-worker.mjs updated-worker.mjs");
const source=readFileSync(input,"utf8");
if(source.includes('/v1/vyro/admin/key'))throw Error("Key bridge already present: inspect the current source.");
const anchor='      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });';
if(!source.includes(anchor))throw Error("Expected route anchor missing.");
let modulePath=relative(dirname(resolve(output)),fileURLToPath(new URL("./key-bridge.mjs",import.meta.url))).replaceAll('\\','/');
if(!modulePath.startsWith('.'))modulePath='./'+modulePath;
writeFileSync(output,'import { vyroKeyBridge } from '+JSON.stringify(modulePath)+';\n'+source.replace(anchor,
 '      if (url.pathname === "/v1/vyro/admin/key") return await vyroKeyBridge(request, env, { revealCode, createShareCode });\n'+anchor));
