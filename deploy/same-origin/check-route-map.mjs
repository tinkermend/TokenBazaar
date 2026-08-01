#!/usr/bin/env node
/**
 * Fail CI when route-map.json drifts from production proxy samples.
 * See docs/PRODUCTION_HUB_DEPLOY.md §2.1 / § CI
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(readFileSync(resolve(here, "route-map.json"), "utf8"));
const caddy = readFileSync(resolve(here, "Caddyfile"), "utf8");
const caddyLocal = readFileSync(resolve(here, "Caddyfile.local"), "utf8");
const nginx = readFileSync(resolve(here, "nginx.conf"), "utf8");

const fail = (msg) => {
  console.error(`route-map-gate: ${msg}`);
  process.exit(1);
};

const tbExact = map.tokenbazaar?.exact || [];
const tbPrefixes = map.tokenbazaar?.prefixes || [];
if (!tbExact.length || !tbPrefixes.length) fail("tokenbazaar.exact/prefixes empty");

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** nginx uses grouped regex like ~^/(login|register|...)(/|$) */
function nginxCoversPrefix(prefix) {
  if (nginx.includes(prefix) || nginx.includes(`${prefix}/`)) return true;
  const seg = prefix.replace(/^\//, "");
  if (!seg) return true;
  // segment as alternation member or solo path
  // e.g. ~^/(login|affiliate|home)(/|$)
  const re = new RegExp(`(?:[|(]|/)${escapeRe(seg)}(?:[|)/]|$)`);
  return re.test(nginx);
}

function caddyCovers(body, prefix) {
  if (body.includes(prefix)) return true;
  // path list may use "/login /login/*"
  const seg = prefix.replace(/^\//, "");
  return body.includes(`/${seg}`) || body.includes(`/${seg}/`);
}

for (const path of tbExact) {
  for (const [name, body] of [
    ["Caddyfile", caddy],
    ["Caddyfile.local", caddyLocal],
    ["nginx.conf", nginx],
  ]) {
    if (!body.includes(path)) fail(`${name} missing tokenbazaar exact path ${path}`);
  }
}

for (const path of tbPrefixes) {
  if (!caddyCovers(caddy, path)) fail(`Caddyfile missing prefix ${path}`);
  if (!caddyCovers(caddyLocal, path)) fail(`Caddyfile.local missing prefix ${path}`);
  if (!nginxCoversPrefix(path)) fail(`nginx.conf missing prefix ${path}`);
}

if (map.default !== "priceai") fail('route-map.default must be "priceai"');
if (map.priceai?.prefixes?.includes("/admin")) {
  fail("route-map priceai.prefixes must not include /admin (use /pa-admin)");
}
if (!map.priceai?.prefixes?.includes("/pa-admin")) {
  fail("route-map priceai.prefixes must include /pa-admin");
}
if (!map.priceai?.prefixes?.includes("/auth/tokenbazaar")) {
  fail("route-map priceai.prefixes must include /auth/tokenbazaar");
}
for (const req of ["/api/v1", "/login", "/console", "/admin", "/keys"]) {
  if (!tbPrefixes.includes(req)) fail(`tokenbazaar.prefixes must include ${req}`);
}

// Constraint A: must not blanket /auth to PA in samples (heuristic)
if (/@\w+\s+path\s+\/auth\s+\/auth\/\*/.test(caddy) || /location\s+\^~?\s*\/auth\/\s*\{/.test(nginx)) {
  fail("proxy samples must not route all of /auth/* to a single upstream");
}

console.log("route-map-gate: OK");
console.log(`  exact=${tbExact.length} prefixes=${tbPrefixes.length}`);
console.log("  checked: Caddyfile, Caddyfile.local, nginx.conf + constitution checks");
