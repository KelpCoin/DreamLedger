/** Canonical Vercel API dispatcher. Original handlers live unchanged in /handlers.
 * One function on Hobby. Routes are exact allowlisted paths; no arbitrary import.
 * Raw Stripe bytes must survive unmodified; public/payment gates remain in original code. */
export const config = { api: { bodyParser: false } };

type Kind = "node" | "web";
type Route = { kind: Kind; load: () => Promise<any> };
const routes: Record<string, Route> = {
  "/api/discovery/catalog": { kind: "node", load: () => import("../handlers/discovery.js") },
  "/api/discovery/silos": { kind: "node", load: () => import("../handlers/discovery.js") },
  "/api/billboard-checkout": { kind: "web", load: () => import("../handlers/billboard-checkout.ts") },
  "/api/billboard-inventory": { kind: "web", load: () => import("../handlers/billboard-inventory.ts") },
  "/api/billboard/public": { kind: "web", load: () => import("../handlers/billboard-public.js") },
  "/api/billboard-public": { kind: "web", load: () => import("../handlers/billboard-public.js") },
  "/api/billboard-webhook": { kind: "web", load: () => import("../handlers/billboard-webhook.ts") },
  "/api/billboard/claim": { kind: "web", load: () => import("../handlers/billboard/claim.ts") },
  "/api/billboard/submit": { kind: "web", load: () => import("../handlers/billboard/submit.ts") },
  "/api/cube/marketplace": { kind: "node", load: () => import("../handlers/cube/marketplace.js") },
  "/api/cube/silos": { kind: "node", load: () => import("../handlers/cube/silos.js") },
  "/api/dreammeez/checkin": { kind: "node", load: () => import("../handlers/dreammeez/checkin.js") },
  "/api/stripe-link": { kind: "web", load: () => import("../handlers/stripe-link.ts") },
  "/api/offer-checkout/create": { kind: "web", load: () => import("../handlers/stripe-link.ts") },
  "/api/commercial/input": { kind: "web", load: () => import("../handlers/commercial-diagnostic-input.ts") },
  "/api/molt-beach-checkout": { kind: "web", load: () => import("../handlers/billboard-checkout.ts") },
  "/api/molt-beach-inventory": { kind: "web", load: () => import("../handlers/billboard-inventory.ts") },
  "/api/molt-beach-webhook": { kind: "web", load: () => import("../handlers/billboard-webhook.ts") },
  "/api/version": { kind: "node", load: () => import("../handlers/version.js") },
};
const ACCOUNT: Route = { kind: "node", load: () => import("../handlers/account/[...route].js") };

async function rawBody(req: any): Promise<Buffer> {
  const parts: Buffer[] = []; let bytes = 0;
  for await (const piece of req) {
    const b = Buffer.isBuffer(piece) ? piece : Buffer.from(piece); bytes += b.length;
    if (bytes > 1_048_576) { const e: any = new Error("PAYLOAD_TOO_LARGE"); e.status = 413; throw e; }
    parts.push(b);
  }
  return Buffer.concat(parts);
}
function fail(res: any, status: number, code: string) {
  if (res.writableEnded) return;
  res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store"); res.end(JSON.stringify({error: code}));
}
export default async function handler(req: any, res: any) {
  try {
    const root = new URL(String(req.url || "/"), "https://dreamledger.org");
    const pathname = decodeURIComponent(root.pathname).replace(/\/$/, "") || "/";
    const target: Route | undefined = routes[pathname] || (/^\/api\/account(?:\/|$)/.test(pathname) ? ACCOUNT : undefined);
    if (!target) return fail(res, 404, "API_ROUTE_NOT_FOUND");
    if (!req.query || typeof req.query !== "object") req.query = {};
    for (const [k,v] of root.searchParams) if (!(k in req.query)) req.query[k] = v;
    const body = req.method === "GET" || req.method === "HEAD" ? Buffer.alloc(0) : await rawBody(req);
    const mod: any = await target.load();
    const fn = mod.default || mod;
    if (typeof fn !== "function") return fail(res, 503, "HANDLER_NOT_AVAILABLE");
    if (target.kind === "node") {
      const ct = String(req.headers["content-type"] || "").toLowerCase();
      if (body.length && ct.includes("application/json")) {
        try { req.body = JSON.parse(body.toString("utf8")); } catch { return fail(res, 400, "INVALID_JSON"); }
      } else if (body.length && ct.includes("application/x-www-form-urlencoded")) {
        req.body = Object.fromEntries(new URLSearchParams(body.toString("utf8")));
      } else { req.body = body.length ? body : {}; }
      await fn(req, res); return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers || {})) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
    }
    const host = String(req.headers.host || "dreamledger.org");
    const url = new URL(String(req.url || "/"), `https://${host}`);
    const input: any = { method: req.method, headers };
    if (body.length && req.method !== "GET" && req.method !== "HEAD") { input.body = body; input.duplex = "half"; }
    const output: Response = await fn(new Request(url.toString(), input));
    if (!(output instanceof Response)) return fail(res, 500, "INVALID_HANDLER_RESPONSE");
    res.statusCode = output.status;
    output.headers.forEach((value: string, key: string) => {
      if (!["transfer-encoding", "connection", "content-length"].includes(key.toLowerCase())) res.setHeader(key, value);
    });
    if (req.method === "HEAD") return res.end();
    return res.end(Buffer.from(await output.arrayBuffer()));
  } catch (error: any) {
    console.error("API_DISPATCH_FAILURE", error?.message || "unknown");
    return fail(res, error?.status === 413 ? 413 : 500, error?.status === 413 ? "PAYLOAD_TOO_LARGE" : "INTERNAL_API_ERROR");
  }
}
