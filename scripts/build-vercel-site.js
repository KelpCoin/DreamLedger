"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const outputDir = path.join(root, "dist");

if (!fs.existsSync(path.join(root, "index.html"))) {
  throw new Error("Canonical homepage missing: root index.html");
}
if (!fs.existsSync(publicDir)) {
  throw new Error("Vercel asset source missing: public/");
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.cpSync(publicDir, outputDir, { recursive: true });

// Root-level pages are the canonical Render/source versions. Overlay them
// into Vercel's clean output so public/ is a source-asset directory, not a
// competing homepage or a second authority for these routes.
const canonicalFiles = [
  "index.html",
  "dreamledger.css",
  "marketplace.html",
  "truth-oracle.html",
  "privacy.html",
  "terms.html",
  "security.html",
  "about.html"
];
for (const relative of canonicalFiles) {
  const source = path.join(root, relative);
  if (fs.existsSync(source) && fs.statSync(source).isFile()) {
    const target = path.join(outputDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

const canonicalDirectories = ["mtg", "trust", "quote-comparison"];
for (const relative of canonicalDirectories) {
  const source = path.join(root, relative);
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    fs.cpSync(source, path.join(outputDir, relative), { recursive: true, force: true });
  }
}

for (const required of [
  "index.html",
  "dreamledger.css",
  "truth-oracle.html",
  "mtg/index.html",
  "quote-comparison/index.html"
]) {
  if (!fs.existsSync(path.join(outputDir, required))) {
    throw new Error("Built Vercel output is missing required route: " + required);
  }
}

const outputHomepage = fs.readFileSync(path.join(outputDir, "index.html"), "utf8");
const canonicalHomepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (outputHomepage !== canonicalHomepage) {
  throw new Error("Vercel output homepage does not match canonical root index.html");
}

console.log("VERCEL_STATIC_BUILD PASS");
console.log("Canonical homepage: root index.html -> dist/index.html");
console.log("Shared public assets retained: public/ -> dist/");
console.log("Canonical HTML routes overlaid from repository root: PASS");
