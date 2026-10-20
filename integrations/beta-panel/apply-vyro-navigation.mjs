// Apply to a freshly downloaded active worker source; never embed administration secrets.
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const [input,output]=process.argv.slice(2);
if(!input||!output||input===output)throw Error("Usage: node apply-vyro-navigation.mjs active-worker.mjs new-worker.mjs");
const source=readFileSync(input,"utf8");
assert.ok(source.includes("<h1>SHOW+ Studio</h1>"),"Expected original panel heading; inspect the active source before proceeding.");
const nav='<nav aria-label="Gestion VYRO" style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 24px"><a href="https://vyro-premium-experience.beta-worker.workers.dev/admin" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#c6b6f5;color:#17151c;text-decoration:none;font-weight:700">Clients, licences et paiements VYRO ↗</a><span style="align-self:center;color:#aaa;font-size:13px">Les licences du site et les accès TV utilisent la même base.</span></nav>';
const updated=source.replace('<title>SHOW+ Studio</title>','<title>VYRO Studio — Gestion</title>')
 .replace('<h1>SHOW+ Studio</h1>','<h1>VYRO Studio</h1>')
 .replace('<div class="mark">S+</div>','<div class="mark">V</div>')
 .replace('<div class="muted">Accès · Playlists · Messages</div>','<div class="muted">Bêtas · Accès TV · Gestion VYRO</div>')
 .replace('</header>','</header>'+nav);
const entry=source.indexOf('export default {');assert.ok(entry>=0,"Worker entry point missing.");
assert.equal(updated.slice(updated.indexOf('export default {')),source.slice(entry),"TV/API source must remain identical.");
writeFileSync(output,updated);
