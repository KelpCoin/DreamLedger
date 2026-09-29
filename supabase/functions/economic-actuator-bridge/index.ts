import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supplied = String(
    req.headers.get("x-dreamledger-agent-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    ""
  ).trim();
  if (!supplied) return json({ error: "bridge token required" }, 401);

  const projectUrl = Deno.env.get("SUPABASE_URL") || "";
  let secretMap: Record<string, string> = {};
  try { secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); } catch {}
  const adminKey = secretMap.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!projectUrl || !adminKey) return json({ error: "admin configuration unavailable" }, 503);

  const hash = await sha256Hex(supplied);
  const c = await fetch(
    `${projectUrl}/rest/v1/bridge_credentials?select=credential_id,model_family,active&token_sha256=eq.${encodeURIComponent(hash)}&active=eq.true&limit=1`,
    { headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}` } }
  );
  if (!c.ok) return json({ error: "bridge credential store unavailable" }, 503);
  const rows = await c.json();
  if (!Array.isArray(rows) || rows.length !== 1) return json({ error: "bridge authentication failed" }, 401);

  let input: any;
  try { input = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const op = String(input?.op || "").trim();
  const rpcMap: Record<string, string> = {
    heartbeat: "economic_actuator_heartbeat",
    claim_external_action_job: "claim_external_action_job",
    complete_job: "complete_job",
    fail_job: "fail_job",
  };
  const rpc = rpcMap[op];
  if (!rpc) return json({ error: "operation not allowed" }, 403);

  const body = input?.args && typeof input.args === "object" ? input.args : {};
  const response = await fetch(`${projectUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: adminKey,
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text || "null"); } catch { data = { raw: text }; }
  return json(data, response.status);
});
