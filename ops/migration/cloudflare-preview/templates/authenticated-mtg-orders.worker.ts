/**
 * TRANSITION-ONLY Cloudflare Worker + Supabase PostgREST example.
 * This is NOT a Neon adapter. G17 exit requires replacement with an
 * authenticated Neon database role and PostgreSQL-enforced RLS.
 *
 * Requires: jose, @supabase/supabase-js
 * For database reads, RLS and tenant-isolation must be proven in PostgreSQL
 * before MTG_RLS_AUDITED=true. Never bind a service_role or sb_secret_* key.
 * Legacy HS256 JWTs intentionally fail closed (no shared signing secrets).
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  MTG_RLS_AUDITED?: string;
}
type UserClaims = {
  sub: string;
  iss: string;
  role: string;
  aud: string | string[];
  exp?: number;
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
} as const;
const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200, extras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extras },
  });
}

function safeSupabaseOrigin(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') ||
      url.username || url.password || url.port || url.pathname !== '/' ||
      url.search || url.hash) {
    throw new Error('Invalid trusted Supabase project URL');
  }
  return url;
}

async function verifyUser(request: Request, env: Env): Promise<{ token: string; claims: UserClaims }> {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)$/.exec(header);
  if (!match || match[1].length > 8192) throw new Error('UNAUTHENTICATED');
  const token = match[1];
  const origin = safeSupabaseOrigin(env.SUPABASE_URL);
  const issuer = origin.origin + '/auth/v1';
  let jwks = JWKS_CACHE.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'), {
      timeoutDuration: 2500,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    });
    JWKS_CACHE.set(issuer, jwks);
  }
  const result = await jwtVerify(token, jwks, {
    issuer,
    audience: 'authenticated',
    algorithms: ['RS256', 'ES256'],
    clockTolerance: '5s',
    requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud'],
  });
  const claims = result.payload;
  if (claims.role !== 'authenticated' ||
      typeof claims.sub !== 'string' || !UUID_RE.test(claims.sub)) {
    throw new Error('UNAUTHENTICATED');
  }
  return { token, claims: claims as UserClaims };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/api/mtg/orders') return json({ error: 'NOT_FOUND' }, 404);
    if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'GET' });

    let identity: { token: string; claims: UserClaims };
    try {
      identity = await verifyUser(request, env);
    } catch {
      return json({ error: 'UNAUTHORIZED' }, 401);
    }

    if (env.MTG_RLS_AUDITED !== 'true') {
      return json({ error: 'DATABASE_POLICY_NOT_VERIFIED' }, 503);
    }
    if (!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
      return json({ error: 'SAFE_DATABASE_CLIENT_NOT_CONFIGURED' }, 503);
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: 'Bearer ' + identity.token } },
    });

    // A broad, READ-ONLY query is safe ONLY if database RLS has been verified.
    // No elevated key, arbitrary SQL, write access, or user-supplied table name.
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select('id')
      .limit(20);

    if (error) return json({ error: 'DATABASE_QUERY_FAILED' }, 503);
    return json({ schema: 'dreamledger/mtg-user-orders/v1', orders: data ?? [] });
  },
};
