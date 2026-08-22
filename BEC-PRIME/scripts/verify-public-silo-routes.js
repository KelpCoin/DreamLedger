'use strict';

const base = String(process.env.BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const expected = String(process.env.EXPECTED_SHA || '').trim();

const routes = [
  '/silos.html',
  '/mtg',
  '/dreammeez',
  '/media-music.html',
  '/digital-products.html',
  '/nz-secondhand.html',
  '/marketplace.html',
  '/electronics.html',
  '/home-garden.html',
  '/health-beauty.html',
  '/pet.html',
  '/books-stationery.html',
  '/sports-outdoors.html',
  '/baby-kids.html',
  '/automotive.html',
  '/food-pantry.html',
  '/education-courses.html',
  '/board',
  '/api/molt-beach-inventory'
];

async function probe(path) {
  const response = await fetch(base + path, { redirect: 'manual' });
  return { path, status: response.status };
}

(async () => {
  const version = await fetch(base + '/version', { cache: 'no-store' });
  if (!version.ok) throw new Error(`VERSION_HTTP_${version.status}`);
  const versionJson = await version.json();
  if (expected && versionJson.commit !== expected) {
    throw new Error(`SHA_MISMATCH live=${versionJson.commit} expected=${expected}`);
  }

  const results = [];
  for (const route of routes) results.push(await probe(route));
  const failed = results.filter(x => x.status !== 200);
  for (const item of results) console.log(`${item.status}\t${item.path}`);

  if (failed.length) throw new Error('PUBLIC_SILO_ROUTE_FAILURE: ' + failed.map(x => `${x.path}=${x.status}`).join(', '));
  console.log(`PASS: ${results.length} canonical public routes return HTTP 200.`);
})();
