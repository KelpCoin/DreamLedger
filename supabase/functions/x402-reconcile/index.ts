import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TOKEN = Deno.env.get("X402_RECONCILE_TOKEN") || "";
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef";

function cleanHex(x: string) { return String(x || "").toLowerCase(); }
function addressFromTopic(x: string) { return "0x" + cleanHex(x).slice(-40); }
function amountFromHex(x: string) {
  try { return BigInt(x).toLowerCase().startsWith("0x") ? BigInt(x) : BigInt("0x" + x); } catch { return 0n; }
}
async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}) });
  if (!r.ok) throw new Error("RPC_HTTP_" + r.status);
  const j = await r.json();
  if (j.error) throw new Error("RPC_" + (j.error.message || "ERROR"));
  return j.result;
}
async function fxUsdNzd() {
  const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=NZD");
  if (!r.ok) throw new Error("FX_HTTP_" + r.status);
  const j = await r.json();
  const rate = Number(j?.rates?.NZD);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("FX_INVALID");
  return { rate, source: "ECB/Frankfurter", observed_at: new Date().toISOString() };
}
async function reconcile(row:any) {
  const testnet = row.network === "eip155:84532";
  const rpcUrl = testnet ? "https://sepolia.base.org" : "https://mainnet.base.org";
  const expectedAsset = cleanHex(row.asset);
  const expectedPayee = cleanHex(row.payee_address);
  const expectedPayer = cleanHex(row.payer_address);
  const expectedAmount = BigInt(String(row.amount_atomics || "0"));
  const tx = cleanHex(row.tx_hash);
  if (!/^0x[0-9a-f]{64}$/.test(tx)) throw new Error("BAD_TX_HASH");

  const [receipt, txObj, head] = await Promise.all([
    rpc(rpcUrl,"eth_getTransactionReceipt",[tx]),
    rpc(rpcUrl,"eth_getTransactionByHash",[tx]),
    rpc(rpcUrl,"eth_blockNumber",[])
  ]);
  if (!receipt) return {status:"WAITING",reason:"TX_NOT_MINED"};
  if (cleanHex(receipt.status) !== "0x1") return {status:"REJECTED",reason:"TX_REVERTED"};
  const block = Number(BigInt(receipt.blockNumber));
  const confirmations = Math.max(0, Number(BigInt(head)) - block + 1);
  const required = testnet ? 2 : 3;
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const match = logs.find((l:any) =>
    cleanHex(l.address) === expectedAsset &&
    Array.isArray(l.topics) && l.topics.length >= 3 &&
    cleanHex(l.topics[0]) === TRANSFER_TOPIC &&
    addressFromTopic(l.topics[1]) === expectedPayer &&
    addressFromTopic(l.topics[2]) === expectedPayee &&
    amountFromHex(l.data) === expectedAmount
  );
  if (!match) return {status:"REJECTED",reason:"TRANSFER_LOG_MISMATCH",confirmations};
  if (confirmations < required) return {status:"WAITING",reason:"CONFIRMATIONS",confirmations,required,block};
  if (cleanHex(txObj?.from) !== expectedPayer) return {status:"REJECTED",reason:"TX_SENDER_MISMATCH"};
  if (cleanHex(txObj?.to) !== expectedAsset) return {status:"REJECTED",reason:"TX_TARGET_MISMATCH"};

  const confirmedAt = new Date().toISOString();
  await db.from("x402_settlements").update({
    status:"CONFIRMED", block_number:block, confirmations, confirmed_at:confirmedAt
  }).eq("settlement_id", row.settlement_id);

  await db.from("agent_toll_calls").update({
    settlement_status:testnet ? "SETTLED_TESTNET_CONFIRMED" : "SETTLED_CONFIRMED",
    settled_at:confirmedAt, payment_tx:row.tx_hash, payer:row.payer_address
  }).eq("call_id", row.toll_call_id);

  if (testnet) return {status:"CONFIRMED_TESTNET",confirmations,block};

  const fx = await fxUsdNzd();
  const amountNzd = Number(row.amount_usdc) * fx.rate;
  const { data:event } = await db.from("economic_events").select("event_id,verification_status,evidence_ref,external_reference,payment_reference,metadata").eq("source_record_id",String(row.toll_call_id)).eq("source_system","x402").maybeSingle();
  if (!event) return {status:"CONFIRMED_NO_EVENT",confirmations,block};
  if (event.verification_status !== "VERIFIED") {
    const { error } = await db.from("economic_events").update({
      verification_status:"VERIFIED",
      verification_state:"VERIFIED",
      state_after:"VERIFIED",
      settlement_state:"SETTLED_CONFIRMED",
      payment_settled:true,
      amount_nzd:amountNzd,
      price_nzd:amountNzd,
      metadata:{
        ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}),
        reconciliation:"INDEPENDENT_CHAIN_VERIFIED",
        toll_call_id:String(row.toll_call_id),
        network:row.network, tx_hash:row.tx_hash, block_number:block,
        confirmations, fx_usd_nzd:fx.rate, fx_source:fx.source, fx_observed_at:fx.observed_at,
        scoreboard_eligible:true
      }
    }).eq("event_id",event.event_id);
    if (error) throw error;
  }
  return {status:"VERIFIED",confirmations,block,amount_nzd:amountNzd};
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({error:"POST_ONLY"}),{status:405,headers:{"content-type":"application/json"}});
  const auth = req.headers.get("authorization") || "";
  if (!((INTERNAL_TOKEN && auth === "Bearer " + INTERNAL_TOKEN) || auth === "Bearer " + KEY)) return new Response(JSON.stringify({error:"UNAUTHORIZED"}),{status:401,headers:{"content-type":"application/json"}});
  const { data: rows, error } = await db.from("x402_settlements").select("*").eq("status","PENDING").order("settled_at",{ascending:true}).limit(20);
  if (error) return new Response(JSON.stringify({error:"QUERY_FAILED",detail:error.message}),{status:500,headers:{"content-type":"application/json"}});
  const results=[];
  for (const row of rows || []) {
    try { results.push({settlement_id:row.settlement_id,...await reconcile(row)}); }
    catch(e) { results.push({settlement_id:row.settlement_id,status:"ERROR",reason:String(e?.message || e)}); }
  }
  return new Response(JSON.stringify({ok:true,checked:(rows||[]).length,results}),{headers:{"content-type":"application/json"}});
});