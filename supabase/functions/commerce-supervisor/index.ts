import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db: SupabaseClient | null = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function authorized(req: Request): boolean {
  // verify_jwt=true alone accepts any valid user JWT. This additional exact check
  // confines the privileged reconciliation path to the service-role caller
  // used by Postgres Cron. Never accept anon/authenticated user tokens here.
  return Boolean(serviceKey)
    && req.headers.get("authorization") === "Bearer " + serviceKey
    && req.headers.get("apikey") === serviceKey;
}

async function readAll(
  client: SupabaseClient,
  table: string,
  columns: string,
  orderColumn: string,
  maximumRows = 50000
): Promise<Record<string, any>[]> {
  const pageSize = 1000;
  const rows: Record<string, any>[] = [];
  for (let offset = 0; offset < maximumRows; offset += pageSize) {
    const { data, error } = await client.from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(offset, Math.min(offset + pageSize - 1, maximumRows - 1));
    if (error) throw new Error(`read_${table}_failed: ${error.message}`);
    const page = (data ?? []) as Record<string, any>[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error(`read_${table}_exceeded_bounded_scan_limit_${maximumRows}; move reconciliation to a bounded SQL workset before increasing the limit`);
}

async function checkedUpdateRun(
  client: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await client.from("commerce_supervisor_runs").update(patch).eq("run_id", runId);
  if (error) throw new Error("supervisor_run_update_failed: " + error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST_REQUIRED" }, 405);
  if (!db) return json({ error: "SUPERVISOR_CONFIGURATION_MISSING" }, 503);
  if (!authorized(req)) return json({ error: "SERVICE_AUTH_REQUIRED" }, 401);

  const { data: run, error: runError } = await db.from("commerce_supervisor_runs")
    .insert({ run_type: "CLOUD_TICK", status: "RUNNING", current_stage: "RECONCILE" })
    .select("run_id")
    .single();

  if (runError || !run?.run_id) {
    return json({ error: "SUPERVISOR_RUN_START_FAILED", detail: runError?.message ?? "missing_run_id" }, 500);
  }

  const runId = String(run.run_id);
  try {
    const [cells, paidOrders, fulfilledRequests] = await Promise.all([
      readAll(db, "commerce_cells", "*", "cell_id"),
      readAll(db, "revenue_orders", "id,sku_id,amount_nzd,currency,paid_at,status", "id")
        .then(rows => rows.filter(row => String(row.status).toLowerCase() === "paid")),
      readAll(db, "fulfillment_requests", "id,sku_id,status", "id")
        .then(rows => rows.filter(row => String(row.status).toLowerCase() === "fulfilled"))
    ]);

    const paidBySku = new Map<string, Record<string, any>[]>();
    for (const order of paidOrders) {
      const sku = String(order.sku_id ?? "");
      if (!sku) continue;
      const bucket = paidBySku.get(sku) ?? [];
      bucket.push(order);
      paidBySku.set(sku, bucket);
    }

    const fulfilledBySku = new Map<string, Record<string, any>[]>();
    for (const row of fulfilledRequests) {
      const sku = String(row.sku_id ?? "");
      if (!sku) continue;
      const bucket = fulfilledBySku.get(sku) ?? [];
      bucket.push(row);
      fulfilledBySku.set(sku, bucket);
    }

    let paidSeen = 0;
    let fulfilledSeen = 0;
    let cellsReady = 0;
    let transitionsApplied = 0;
    let concurrentChangesSkipped = 0;
    const actions: string[] = [];

    for (const cell of cells) {
      const sku = String(cell.sku ?? "");
      if (!sku) continue;
      const orders = paidBySku.get(sku) ?? [];
      const fulfilled = fulfilledBySku.get(sku) ?? [];
      paidSeen += orders.length;
      fulfilledSeen += fulfilled.length;

      // Fulfillment is the later, stronger state. Apply at most one transition
      // per cell per run so we never record SELLABLE -> PAID and SELLABLE -> FULFILLED
      // for the same order in the same tick.
      const targetState = fulfilled.length > 0 ? "FULFILLED" : orders.length > 0 ? "PAID" : null;
      if (targetState && String(cell.state) !== targetState) {
        const evidenceRef = fulfilled[0]?.id ?? orders[0]?.id ?? sku;
        const reason = targetState === "FULFILLED"
          ? "Fulfillment request evidence observed by commerce supervisor"
          : "Settled revenue_orders evidence observed by commerce supervisor";
        const { data: applied, error } = await db.rpc("apply_commerce_supervisor_transition", {
          p_cell_id: String(cell.cell_id),
          p_expected_state: String(cell.state ?? ""),
          p_to_state: targetState,
          p_reason: reason,
          p_evidence_ref: String(evidenceRef)
        });
        if (error) throw new Error("atomic_state_transition_failed: " + error.message);
        if (applied === true) {
          transitionsApplied += 1;
          actions.push(`${sku}:${String(cell.state)}->${targetState}`);
        } else {
          concurrentChangesSkipped += 1;
          actions.push(`${sku}:CONCURRENT_STATE_CHANGE_SKIPPED`);
        }
      }

      if (cell.verified_checkout && cell.verified_fulfillment && cell.verified_webhook && cell.state === "SELLABLE") {
        cellsReady += 1;
      }
    }

    const nextAction = paidSeen > 0
      ? "FULFILL_PAID_ORDERS"
      : cellsReady > 0
        ? "ACQUISITION_PREPARATION"
        : "REPAIR_SELLABILITY";

    const report = {
      run_id: runId,
      status: "PASS",
      cells_checked: cells.length,
      cells_ready: cellsReady,
      paid_orders_seen: paidSeen,
      fulfilled_orders_seen: fulfilledSeen,
      transitions_applied: transitionsApplied,
      concurrent_changes_skipped: concurrentChangesSkipped,
      next_action: nextAction,
      actions,
      contract: "dreamledger-commerce-supervisor/v2",
      bounded_scan_limit: 50000
    };

    await checkedUpdateRun(db, runId, {
      status: "PASS",
      current_stage: "COMPLETE",
      cells_checked: cells.length,
      cells_ready: cellsReady,
      paid_orders_seen: paidSeen,
      fulfilled_orders_seen: fulfilledSeen,
      next_action: nextAction,
      evidence: report
    });
    console.log(JSON.stringify(report));
    return json(report);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    try {
      await checkedUpdateRun(db, runId, {
        status: "FAIL",
        current_stage: "ERROR",
        next_action: "REVIEW_SUPERVISOR_ERROR",
        evidence: { error: message, contract: "dreamledger-commerce-supervisor/v2" }
      });
    } catch (recordError) {
      console.error(JSON.stringify({
        run_id: runId,
        status: "FAIL",
        error: message,
        run_record_update_error: String(recordError)
      }));
    }
    console.error(JSON.stringify({ run_id: runId, status: "FAIL", error: message }));
    return json({ run_id: runId, status: "FAIL", error: message }, 500);
  }
});
