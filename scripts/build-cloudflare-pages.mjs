#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "cloudflare-pages");
const allowed = new Set([".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".txt", ".xml", ".webmanifest", ".woff", ".woff2", ".pdf", ".avif"]);
const excludedDirs = new Set([".git", "node_modules", "api", "test", "tests", "proof", "evidence", "private", "__pycache__"]);
const excludedFiles = new Set(["server.js", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

function verify(...args) {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "verify-mtg-catalogue-safety.mjs"), ...args], { cwd: root, encoding: "utf8" });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) throw new Error("MTG catalogue safety gate failed (" + r.status + ")");
}
async function copyStaticTree(source, destination, opts = {}) {
  let entries;
  try { entries = await fs.readdir(source, { withFileTypes: true }); }
  catch (e) { if (opts.required) throw e; return; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const src = path.join(source, entry.name);
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name.toLowerCase())) continue;
      if (opts.excludeMtg && source === opts.topSource && entry.name.toLowerCase() === "mtg") continue;
      await copyStaticTree(src, path.join(destination, entry.name), opts);
      continue;
    }
    if (!entry.isFile()) continue;
    if (excludedFiles.has(entry.name.toLowerCase())) continue;
    if (/(^|\/)\.env|\.map$|\.(ps1|sh|sql|md|test\.[cm]?js)$/i.test(entry.name)) continue;
    if (opts.excludeRootIndex && source === opts.topSource && entry.name === "index.html") continue;
    if (!allowed.has(path.extname(entry.name).toLowerCase())) continue;
    await fs.mkdir(destination, { recursive: true });
    await fs.copyFile(src, path.join(destination, entry.name));
  }
}
async function requireFile(p) {
  try { const s = await fs.stat(p); if (!s.isFile()) throw new Error("not a file"); }
  catch { throw new Error("Required release input missing: " + path.relative(root, p)); }
}
await requireFile(path.join(root, "BEC-PRIME", "compiled", "website", "index.html"));
await requireFile(path.join(root, "mtg", "index.html"));
await requireFile(path.join(root, "data", "mtg-catalog.json"));
await requireFile(path.join(root, "public", "catalog.json"));
verify();
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

// Public static pages first. The checked-in compiled website is the canonical home page.
const publicDir = path.join(root, "public");
await copyStaticTree(publicDir, out, { required: true, excludeRootIndex: true, excludeMtg: true, topSource: publicDir });
await copyStaticTree(path.join(root, "BEC-PRIME", "compiled", "website"), out, { required: true });
const mtgDir = path.join(root, "mtg");
await copyStaticTree(mtgDir, path.join(out, "mtg"), { required: true });
await fs.mkdir(path.join(out, "data"), { recursive: true });
await fs.copyFile(path.join(root, "data", "mtg-catalog.json"), path.join(out, "data", "mtg-catalog.json"));
// Explicitly overlay the verified public fallback instead of trusting a stale compiled copy.
await fs.copyFile(path.join(root, "public", "catalog.json"), path.join(out, "catalog.json"));
await fs.copyFile(path.join(root, "public", "_redirects"), path.join(out, "_redirects"));

const headersPath = path.join(out, "_headers");
let headers = "";
try { headers = await fs.readFile(headersPath, "utf8"); } catch {}
const additions = [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "",
  "/catalog.json",
  "  Cache-Control: no-store",
  "",
  "/data/mtg-catalog.json",
  "  Cache-Control: no-store"
].join("\n");
await fs.writeFile(headersPath, headers.trim() + (headers.trim() ? "\n" : "") + additions + "\n", "utf8");

for (const p of ["index.html", "mtg/index.html", "catalog.json", "data/mtg-catalog.json", "_redirects", "_headers"]) {
  await requireFile(path.join(out, p));
}
verify("--site-root", out);
const publicCat = JSON.parse(await fs.readFile(path.join(out, "catalog.json"), "utf8"));
const mtgCat = JSON.parse(await fs.readFile(path.join(out, "data", "mtg-catalog.json"), "utf8"));
if (!Array.isArray(publicCat.products) || !Array.isArray(mtgCat.products)) throw new Error("Deployed catalogue shape invalid");

const heldDiagnosticLink = "https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30";
const files = [];
async function gather(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await gather(p);
    else if (allowed.has(path.extname(e.name).toLowerCase())) files.push(p);
  }
}
await gather(out);
for (const f of files) {
  const c = await fs.readFile(f, "utf8").catch(() => "");
  if (c.includes(heldDiagnosticLink)) throw new Error("Held Commander Diagnostic Stripe URL remains in deployed asset: " + path.relative(out, f));
}
console.log(JSON.stringify({
  status: "PASS",
  output: path.relative(root, out).replaceAll(path.sep, "/"),
  static_files: files.length,
  checks: [
    "compiled home page present",
    "/mtg/ route present",
    "/catalog.json parses",
    "/data/mtg-catalog.json parses",
    "held-price safety checks pass",
    "held Commander Diagnostic URL absent"
  ]
}, null, 2));
