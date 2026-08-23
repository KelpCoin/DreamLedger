const DEFAULT_BACKEND = 'https://dreamledger.onrender.com';

export async function onRequest(context) {
  const { request, env } = context;
  const base = String(env.RENDER_BACKEND_URL || DEFAULT_BACKEND).replace(/\/$/, '');
  const incoming = new URL(request.url);
  const target = `${base}${incoming.pathname}${incoming.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.set('x-dreamledger-edge', 'cloudflare-pages');

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('x-dreamledger-edge', 'cloudflare-pages');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return Response.json({
      error: 'backend_unavailable',
      service: 'dreamledger-cloudflare-edge',
      detail: 'The static storefront is deployed independently; the API backend is currently unavailable.'
    }, { status: 503 });
  }
}
