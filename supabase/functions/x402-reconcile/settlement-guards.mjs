// Reusable, deterministic settlement checks. Compatible with Supabase Edge (Deno) and Node.js.
export class MalformedAmountError extends Error {
  constructor(field) {
    super(`MALFORMED_${field}`);
    this.name = 'MalformedAmountError';
  }
}

// x402 v2 uses decimal strings of atomic units. USDC has 6 decimals.
// It is incorrect to call these units 'stroops' (a Stellar-specific term).
export function parseAtomicAmount(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) {
    throw new MalformedAmountError('ATOMIC_AMOUNT');
  }
  return BigInt(value);
}

// ERC-20 Transfer log.data is an EVM hex uint256, not a decimal string.
export function parseTransferData(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new MalformedAmountError('TRANSFER_DATA');
  }
  return BigInt(value);
}

export function assertExactAmount(transferred, required) {
  if (typeof transferred !== 'bigint' || typeof required !== 'bigint' || required <= 0n || transferred !== required) {
    throw new Error('X402_AMOUNT_NOT_EXACT');
  }
  return true;
}

// A confirmed transfer proves money moved, not that a real buyer got a good artifact.
// Do not touch economic_events.verification_status or claim verified revenue here.
export function settledPaymentPatch({ metadata, network, txHash, tollCallId, block, confirmations, amountNzd, fx }) {
  if (!['eip155:8453', 'eip155:84532'].includes(network)) throw new Error('X402_NETWORK_UNSUPPORTED');
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('X402_TX_INVALID');
  if (!Number.isSafeInteger(block) || block < 0 || !Number.isSafeInteger(confirmations) || confirmations < (network === 'eip155:84532' ? 2 : 3)) {
    throw new Error('X402_CONFIRMATIONS_INVALID');
  }
  if (!tollCallId || !Number.isFinite(amountNzd) || amountNzd <= 0 || !Number.isFinite(fx?.rate) || fx.rate <= 0) {
    throw new Error('X402_PAYMENT_CONTEXT_INVALID');
  }
  const prior = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  return {
    settlement_state: 'SETTLED_CONFIRMED',
    payment_settled: true,
    amount_nzd: amountNzd,
    price_nzd: amountNzd,
    metadata: {
      ...prior,
      reconciliation: 'INDEPENDENT_CHAIN_VERIFIED',
      toll_call_id: String(tollCallId),
      network, tx_hash: txHash, block_number: block, confirmations,
      fx_usd_nzd: fx.rate, fx_source: fx.source, fx_observed_at: fx.observed_at,
      delivery_verified: false,
      scoreboard_eligible: false,
      economic_proof_gate: 'AWAITING_EXTERNAL_BUYER_FULFILLMENT_AND_DELIVERY_PROOF'
    }
  };
}
