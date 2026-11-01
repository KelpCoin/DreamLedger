// Shared silo auction API adapter. Requires the reviewed migration to be applied first.
// Uses the caller's Supabase JWT for bids; never uses a service-role key.
module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');

  const method = String(req.method || '').toUpperCase();
  if (!['GET', 'POST'].includes(method)) {
    res.setHeader('allow', 'GET, POST');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }

  const baseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'AUCTION_BACKEND_NOT_CONFIGURED' }));
  }

  try {
    if (method === 'GET') {
      const url = new URL('/rest/v1/marketplace_auctions', baseUrl);
      url.searchParams.set('select', 'id,silo_id,source_type,source_id,title,description,currency,start_price,min_increment,current_price,starts_at,ends_at,status');
      url.searchParams.set('status', 'eq.open');
      url.searchParams.set('publication_approved_at', 'not.is.null');
      url.searchParams.set('order', 'ends_at.asc');
      url.searchParams.set('limit', '100');
      const siloId = typeof req.query?.silo_id === 'string' ? req.query.silo_id : '';
      if (siloId && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(siloId)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'SILO_ID_INVALID' }));
      }
      if (siloId) url.searchParams.set('silo_id', 'eq.' + siloId);
      const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization : 'Bearer ' + anonKey;
      const response = await fetch(url, {
        headers: { apikey: anonKey, Authorization: auth },
        signal: AbortSignal.timeout(8000)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body)) {
        res.statusCode = response.status === 401 ? 401 : 502;
        return res.end(JSON.stringify({ error: 'AUCTION_DISCOVERY_UNAVAILABLE' }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ schema: 'DREAMLEDGER/SILO-AUCTIONS/V1', items: body }));
    }

    const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    if (!/^Bearer\s+\S+/i.test(auth)) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'AUTHENTICATION_REQUIRED' }));
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const auctionId = typeof body.auction_id === 'string' ? body.auction_id : '';
    const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
    const amount = typeof body.amount === 'number' ? body.amount : Number.NaN;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(auctionId)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'AUCTION_ID_INVALID' }));
    }
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'BID_AMOUNT_INVALID' }));
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'IDEMPOTENCY_KEY_INVALID' }));
    }

    const response = await fetch(new URL('/rest/v1/rpc/place_marketplace_auction_bid', baseUrl), {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: auth,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        p_auction_id: auctionId,
        p_amount: amount,
        p_idempotency_key: idempotencyKey
      }),
      signal: AbortSignal.timeout(8000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== 'object') {
      res.statusCode = response.status === 401 ? 401 : response.status === 403 ? 403 : 409;
      return res.end(JSON.stringify({
        error: 'BID_REJECTED_OR_BACKEND_UNAVAILABLE',
        code: typeof result?.code === 'string' ? result.code : null
      }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ schema: 'DREAMLEDGER/SILO-AUCTIONS/V1', result }));
  } catch (_) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: 'AUCTION_BACKEND_UNAVAILABLE' }));
  }
};
