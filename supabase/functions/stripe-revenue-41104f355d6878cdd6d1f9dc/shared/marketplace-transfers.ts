import type Stripe from "npm:stripe@22";

type SupabaseClientLike = {
  from: (table: string) => any;
};

type TransferResult = {
  order_id: string;
  transfer_group: string;
  rows: Array<{
    seller_id: string;
    seller_account_id: string | null;
    amount_minor: number;
    status: string;
    stripe_transfer_id?: string;
    reason?: string;
  }>;
};

export async function createMarketplaceSellerTransfers(args: {
  stripe: Stripe;
  supabase: SupabaseClientLike;
  orderId: string;
  stripeChargeId: string | null;
  transferGroup?: string;
}): Promise<TransferResult> {
  const { stripe, supabase, orderId, stripeChargeId } = args;
  const transferGroup = args.transferGroup || `order_${orderId}`;

  const { data: order, error: orderError } = await supabase
    .from("marketplace_orders")
    .select("id,amount_nzd,platform_fee_nzd,seller_amount_nzd,payment_status,checkout_session_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error("marketplace order not found");
  if (order.payment_status !== "paid") throw new Error("marketplace order is not paid");

  const { data: items, error: itemsError } = await supabase
    .from("marketplace_order_items")
    .select("seller_id,quantity,unit_price_nzd,sku_snapshot,title_snapshot")
    .eq("order_id", orderId);

  if (itemsError) throw new Error("marketplace order items lookup failed");
  if (!items?.length) throw new Error("marketplace order has no items");

  const sellerGross = new Map<string, number>();
  for (const item of items) {
    const gross = Math.round(Number(item.unit_price_nzd) * Number(item.quantity) * 100);
    sellerGross.set(item.seller_id, (sellerGross.get(item.seller_id) || 0) + gross);
  }

  const totalGross = [...sellerGross.values()].reduce((a, b) => a + b, 0);
  const orderAmount = Math.round(Number(order.amount_nzd) * 100);
  const platformFee = Math.round(Number(order.platform_fee_nzd || 0) * 100);

  if (totalGross !== orderAmount) {
    throw new Error("transfer reconciliation blocked: item gross does not equal order amount");
  }
  if (platformFee < 0 || platformFee > orderAmount) {
    throw new Error("transfer reconciliation blocked: invalid platform fee");
  }

  const sellerEntries = [...sellerGross.entries()].sort(([a], [b]) => a.localeCompare(b));
  const rows: TransferResult["rows"] = [];
  let allocatedFee = 0;

  for (let i = 0; i < sellerEntries.length; i++) {
    const [sellerId, grossMinor] = sellerEntries[i];
    const feeShare = i === sellerEntries.length - 1
      ? platformFee - allocatedFee
      : Math.floor((platformFee * grossMinor) / totalGross);

    allocatedFee += feeShare;
    const amountMinor = grossMinor - feeShare;
    if (amountMinor <= 0) throw new Error("transfer reconciliation blocked: non-positive seller allocation");

    const { data: sellerAccount, error: sellerAccountError } = await supabase
      .from("marketplace_seller_accounts")
      .select("id,stripe_connect_account_id,onboarding_status,charges_enabled,payouts_enabled")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (sellerAccountError) throw new Error("seller Connect account lookup failed");

    const idempotencyKey = `marketplace-transfer:${orderId}:${sellerId}`;
    const { data: existing, error: existingError } = await supabase
      .from("marketplace_transfers")
      .select("id,stripe_transfer_id,status,amount_minor,seller_account_id")
      .eq("order_id", orderId)
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (existingError) throw new Error("transfer ledger lookup failed");

    if (existing?.stripe_transfer_id) {
      rows.push({
        seller_id: sellerId,
        seller_account_id: existing.seller_account_id,
        amount_minor: Number(existing.amount_minor),
        status: existing.status,
        stripe_transfer_id: existing.stripe_transfer_id,
        reason: "already_created"
      });
      continue;
    }

    const ledgerPayload = {
      order_id: orderId,
      seller_id: sellerId,
      seller_account_id: sellerAccount?.id || null,
      transfer_group: transferGroup,
      amount_minor: amountMinor,
      currency: "nzd",
      status: "pending",
      stripe_charge_id: stripeChargeId,
      idempotency_key: idempotencyKey,
      metadata: {
        gross_minor: grossMinor,
        allocated_platform_fee_minor: feeShare,
        checkout_session_id: order.checkout_session_id || null
      },
      updated_at: new Date().toISOString()
    };

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from("marketplace_transfers")
      .upsert(ledgerPayload, { onConflict: "order_id,seller_id" })
      .select("id,status")
      .single();

    if (ledgerError || !ledgerRow) throw new Error("transfer ledger write failed");

    if (!sellerAccount?.stripe_connect_account_id ||
        sellerAccount.onboarding_status !== "complete" ||
        sellerAccount.charges_enabled !== true ||
        sellerAccount.payouts_enabled !== true) {
      await supabase
        .from("marketplace_transfers")
        .update({
          status: "pending",
          failure_code: "seller_connect_not_ready",
          failure_message: "Seller Stripe Connect account is not fully enabled.",
          updated_at: new Date().toISOString()
        })
        .eq("id", ledgerRow.id);

      rows.push({
        seller_id: sellerId,
        seller_account_id: sellerAccount?.id || null,
        amount_minor: amountMinor,
        status: "pending",
        reason: "seller_connect_not_ready"
      });
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: amountMinor,
        currency: "nzd",
        destination: sellerAccount.stripe_connect_account_id,
        transfer_group: transferGroup,
        ...(stripeChargeId ? { source_transaction: stripeChargeId } : {}),
        description: `DreamLedger order ${orderId}`,
        metadata: {
          order_id: orderId,
          seller_id: sellerId,
          transfer_group: transferGroup
        }
      }, { idempotencyKey });

      await supabase
        .from("marketplace_transfers")
        .update({
          stripe_transfer_id: transfer.id,
          status: "created",
          failure_code: null,
          failure_message: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", ledgerRow.id);

      await supabase
        .from("marketplace_payouts")
        .update({
          stripe_transfer_id: transfer.id,
          status: "pending",
          updated_at: new Date().toISOString()
        })
        .eq("order_id", orderId)
        .eq("seller_id", sellerId);

      rows.push({
        seller_id: sellerId,
        seller_account_id: sellerAccount.id,
        amount_minor: amountMinor,
        status: "created",
        stripe_transfer_id: transfer.id
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from("marketplace_transfers")
        .update({
          status: "failed",
          failure_code: "stripe_transfer_create_failed",
          failure_message: message.slice(0, 1000),
          updated_at: new Date().toISOString()
        })
        .eq("id", ledgerRow.id);
      throw new Error(`Stripe transfer failed for seller ${sellerId}: ${message}`);
    }
  }

  return { order_id: orderId, transfer_group: transferGroup, rows };
}
