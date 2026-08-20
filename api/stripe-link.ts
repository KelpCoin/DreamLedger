const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';
const SKU = 'EDH_0001';
const PRICE_NZD_CENTS = 40000;
const SUCCESS_URL = 'https://dreamledger.org/success?session_id={CHECKOUT_SESSION_ID}';
const CANCEL_URL = 'https://dreamledger.org/cancel';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'STRIPE_SECRET_KEY is not configured' }, 503);

  let body: { sku?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (body.sku !== SKU) {
    return json({ error: 'Unknown SKU', allowed_sku: SKU }, 400);
  }

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('line_items[0][price_data][currency]', 'nzd');
  form.set('line_items[0][price_data][product_data][name]', 'EDH_0001');
  form.set('line_items[0][price_data][product_data][metadata][sku]', SKU);
  form.set('line_items[0][price_data][unit_amount]', String(PRICE_NZD_CENTS));
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', SUCCESS_URL);
  form.set('cancel_url', CANCEL_URL);
  form.set('metadata[sku]', SKU);

  const response = await fetch(STRIPE_API, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  const result = await response.json();
  if (!response.ok) {
    console.error('STRIPE_CHECKOUT_CREATE_FAILED', result);
    return json({ error: 'Stripe checkout creation failed' }, 502);
  }

  return json({
    sku: SKU,
    amount_nzd: PRICE_NZD_CENTS / 100,
    session_id: result.id,
    url: result.url,
  });
}
