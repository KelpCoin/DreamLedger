#!/usr/bin/env node
const base = (process.env.BASE_URL || "https://dreamledger.org").replace(/\/$/, "");
const count = Number(process.env.CUBE_PROOF_COUNT || 500);
const concurrency = Number(process.env.CUBE_PROOF_CONCURRENCY || 20);

async function get(url) {
  const started = Date.now();
  try {
    const r = await fetch(url, { redirect: "manual", headers: { "user-agent": "DreamLedger-CUBE-500-Proof/1.1" } });
    const body = await r.text();
    return { url, status: r.status, location: r.headers.get("location"), ms: Date.now() - started, bytes: Buffer.byteLength(body), body };
  } catch (error) {
    return { url, status: 0, error: String(error), ms: Date.now() - started };
  }
}

const catalogUrl = `${base}/api/cube/catalog?limit=${count}&offset=0`;
const catalog = await get(catalogUrl);
if (catalog.status !== 200) throw new Error(`CATALOG_HTTP_${catalog.status}: ${catalog.error || catalog.body.slice(0, 300)}`);

let catalogJson;
try { catalogJson = JSON.parse(catalog.body); } catch { throw new Error("CATALOG_NOT_JSON"); }
if (catalogJson.count !== count || !Array.isArray(catalogJson.items) || catalogJson.items.length !== count) {
  throw new Error(`CATALOG_COUNT_MISMATCH expected=${count} count=${catalogJson.count} items=${catalogJson.items?.length}`);
}

const expected = Array.from({length: count}, (_, i) => String(i + 1).padStart(4, "0"));
const catalogRoutes = catalogJson.items.map(x => x.public_route);
for (let i = 0; i < count; i++) {
  const want = `/cube/auto/${expected[i]}`;
  if (catalogRoutes[i] !== want) throw new Error(`CATALOG_ROUTE_MISMATCH index=${i} expected=${want} got=${catalogRoutes[i]}`);
}

const results = new Array(count);
let next = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= count) return;
    const id = expected[i];
    const url = `${base}/cube/auto/${id}`;
    const r = await get(url);
    results[i] = { index: i + 1, id, ...r };
  }
}
await Promise.all(Array.from({length: Math.min(concurrency, count)}, worker));

const failures = results.filter(r =>
  r.status !== 200 ||
  !r.body ||
  !r.body.includes(`CUBE-AUTO-${r.id}`) ||
  !r.body.includes(`/cube/auto/${r.id}`)
);

const proof = {
  schema: "dreamledger/cube-http-proof/v1",
  checked_at: new Date().toISOString(),
  base_url: base,
  requested_count: count,
  catalog_http_status: catalog.status,
  catalog_count: catalogJson.count,
  catalog_items: catalogJson.items.length,
  route_first: catalogRoutes[0],
  route_last: catalogRoutes.at(-1),
  http_success_count: results.filter(r => r.status === 200).length,
  http_failure_count: failures.length,
  dns_and_http_environment: "GitHub Actions public runner",
  user_agent: "DreamLedger-CUBE-500-Proof/1.1",
  failures,
  samples: [results[0], results[Math.floor(count / 2)], results[count - 1]].map(({body, ...r}) => r)
};

console.log(JSON.stringify(proof, null, 2));
require("node:fs").writeFileSync("cube-http-proof.json", JSON.stringify(proof, null, 2) + "\n");

if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 20), null, 2));
  process.exit(1);
}
