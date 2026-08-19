const TOLERANCE_SECONDS = 300;
const PROOF_TABLE = 'first_payment_proofs';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',');
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestampPart || signatures.length === 0) return false;

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some((candidate) => constantTimeEqual(candidate, expected));
}

async function persistProof(event: any): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');

  const session = event.data.object;
  const proof = {
    event_id: event.id,
    event_type: event.type,
    checkout_session_id: session.id,
    payment_status: session.payment_status ?? null,
    amount_total: session.amount_total ?? null,
    currency: session.currency ?? null,
    sku: session.metadata?.sku ?? session.line_items?.data?.[0]?.price?.product ?? 'COMMANDER-DECK-DIAGNOSTIC-001',
    created_at: new Date().toISOString(),
    proof_type: 'FIRST_PAYMENT_PROOF',
  };

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${PROOF_TABLE}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(proof),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase proof write failed: ${response.status} ${text}`);
  }

  console.log('FIRST_PAYMENT_PROOF', JSON.stringify(proof));
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) return json({ error: 'Stripe webhook configuration missing' }, 400);

  const body = await request.text();
  if (!(await verifyStripeSignature(body, signature, secret))) {
    return json({ error: 'Invalid Stripe signature' }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return json({ error: 'Invalid Stripe event JSON' }, 400);
  }

  if (event.type === 'checkout.session.completed') {
    try {
      await persistProof(event);
    } catch (error) {
      console.error('FIRST_PAYMENT_PROOF_FAILED', error);
      return json({ error: 'Payment received but proof persistence failed' }, 500);
    }
  }

  return json({ received: true });
}
