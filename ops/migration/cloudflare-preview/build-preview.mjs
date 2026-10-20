#!/usr/bin/env node
/**
 * Creates a non-production Cloudflare Pages preview bundle.
 * This copies public content while excluding Node server/webhook handlers,
 * package metadata, preloads and internal work files. Dynamic commerce routes
 * are handled by the fail-closed _worker.js scaffold until ported and tested.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const source = path.join(repoRoot, 'public');
const output = path.join(here, 'dist');
const workerSource = path.join(here, '_worker.js');
const extAllow = new Set([
  '.html','.css','.js','.json','.xml','.txt','.svg','.webmanifest',
  '.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.otf','.pdf','.mp4','.webm'
]);
const excludedNames = new Set([
  'server.js','paidCheckoutWebhook.js','Sync-BECPrimeStorefront.js',
  'patch-dreammeez-brand.js','package.json','package-lock.json',
  'README.md','PUBLIC_MONETIZATION.md','WORKLOG-2026-09-27.md',
  'PRODUCTION-DEPLOY-TRIGGER-2026-09-27.txt'
]);
const excludedSuffixes = ['.test.js','.spec.js','.ps1','.sh','.mjs'];
const manifest = { schema:'dreamledger/cloudflare-preview-build/v1', created_at:new Date().toISOString(), included:[], excluded:[] };

function shouldExclude(rel, name) {
  if (rel.split(path.sep).some(part => part.startsWith('.'))) return true;
  if (excludedNames.has(name)) return true;
  if (excludedSuffixes.some(s => name.toLowerCase().endsWith(s))) return true;
  if (/^(?:.*Preload\.js|.*\.env(?:\..*)?)$/i.test(name)) return true;
  if (!extAllow.has(path.extname(name).toLowerCase())) return true;
  return false;
}
async function walk(dir, rel = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes:true })) {
    const abs = path.join(dir, entry.name);
    const childRel = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        manifest.excluded.push({ path:childRel, reason:'hidden_or_dependency_directory' });
        continue;
      }
      await walk(abs, childRel);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldExclude(childRel, entry.name)) {
      manifest.excluded.push({ path:childRel, reason:'extension_or_sensitive_filename_policy' });
      continue;
    }
    const target = path.join(output, childRel);
    await fs.mkdir(path.dirname(target), { recursive:true });
    await fs.copyFile(abs, target);
    const bytes = await fs.readFile(abs);
    manifest.included.push({
      path:childRel.split(path.sep).join('/'),
      bytes:bytes.length,
      sha256:crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
}
await fs.rm(output, { recursive:true, force:true });
await fs.mkdir(output, { recursive:true });
await walk(source);
await fs.copyFile(workerSource, path.join(output, '_worker.js'));
const missingPage = path.join(output, '404.html');
if (!(await fs.stat(missingPage).catch(() => null))?.isFile()) {
  throw new Error('ROOT_404_REQUIRED: missing public/404.html; Pages would enable its default SPA fallback.');
}
const worker = await fs.readFile(workerSource);
manifest.included.push({ path:'_worker.js', bytes:worker.length, sha256:crypto.createHash('sha256').update(worker).digest('hex') });
await fs.writeFile(path.join(here, 'build-proof.json'), JSON.stringify({
  ...manifest,
  status:'PREVIEW_BUNDLE_BUILT_NOT_PRODUCTION_READY',
  root_404_present:true,
  unknown_paths:'MUST_RETURN_404_NOT_ROOT_SPA_FALLBACK',
  static_only:false,
  dynamic_routes:'EXPLICITLY_BLOCKED_UNTIL_PORTED',
  production_mutation:false,
  dns_changed:false,
  revenue_claimed_nzd:0
}, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  status:'PREVIEW_BUNDLE_BUILT_NOT_PRODUCTION_READY',
  output_dir:path.relative(repoRoot, output).split(path.sep).join('/'),
  included_files:manifest.included.length,
  excluded_files:manifest.excluded.length,
  proof:path.relative(repoRoot, path.join(here,'build-proof.json')).split(path.sep).join('/'),
  dynamic_routes:'BLOCKED_UNTIL_PORTED',
  production_mutation:false
}, null, 2));
