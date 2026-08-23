export async function onRequestGet(context) {
  const base = String(context.env.RENDER_BACKEND_URL || 'https://dreamledger.onrender.com').replace(/\/$/, '');
  try {
    const upstream = await fetch(`${base}/healthz`, { headers: { 'x-dreamledger-edge': 'cloudflare-pages' } });
    const headers = new Headers(upstream.headers);
    headers.set('x-dreamledger-edge', 'cloudflare-pages');
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (_) {
    return Response.json({ status: 'edge_ok', backend: 'unavailable' }, { status: 503 });
  }
}
