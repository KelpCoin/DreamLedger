/**
 * Cloudflare Pages Advanced Mode migration scaffold.
 *
 * Static routes fall through to ASSETS. Dynamic commerce/data routes remain
 * blocked until their real implementations are ported and acceptance-tested.
 * This intentionally does not fake health, product data, settlement or delivery.
 * It is a preview scaffold; DO NOT cut over dreamledger.org while it returns 503.
 */
const DYNAMIC_PATHS = [
  /^\/(healthz|version)\/?$/,
  /^\/api\/(products|offers)(\/|$)/,
  /^\/api\/toll(\/|$)/,
  /^\/api\/commercial(\/|$)/,
  /^\/api\/webhooks\/stripe\/?$/,
  /^\/toll(\/|$)/
];

function blocked(pathname) {
  return DYNAMIC_PATHS.some(pattern => pattern.test(pathname));
}
function unavailable(pathname) {
  return Response.json({
    schema: 'dreamledger/cloudflare-migration-preview/v1',
    status: 'BLOCKED_ROUTE_NOT_MIGRATED',
    route: pathname,
    message: 'This preview deliberately fails closed until the compatible runtime and acceptance contract are implemented.',
    production_ready: false,
    revenue_claimed_nzd: 0
  }, {
    status: 503,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-dreamledger-migration-state': 'blocked'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (blocked(url.pathname)) return unavailable(url.pathname);
    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Static asset binding unavailable', {
        status: 503,
        headers: { 'cache-control': 'no-store', 'x-dreamledger-migration-state': 'blocked' }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
