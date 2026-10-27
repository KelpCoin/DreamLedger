// Private CUBE matching evaluator. It does not contact buyers or providers.
export function evaluateMatch(request, offers = []) {
  const hold = reason => ({state:'HOLD',reason,matches:[],verified_external_revenue_nzd:0});
  if (!request?.request_id || !request?.silo_id || !request?.source_ref) return hold('MISSING_SOURCE');
  if (request?.consent?.explicit !== true || !request?.consent?.evidence_ref) return hold('NO_OPT_IN');
  if (!['S2','S3','S4'].includes(request.signal_tier)) return hold('WEAK_INTENT');
  if (!Number.isFinite(request.max_price_nzd) || request.max_price_nzd < 0) return hold('NO_BUDGET');
  if (!request.kind || !request.buyer_ref) return hold('INCOMPLETE_REQUIREMENTS');
  const required = Array.isArray(request.required_tags) ? request.required_tags : [];
  const seen = new Set();
  const matches = [];
  for (const offer of offers) {
    if (!offer?.offer_id || seen.has(offer.offer_id)) continue;
    seen.add(offer.offer_id);
    if (offer.silo_id !== request.silo_id || offer.kind !== request.kind) continue;
    if (!['PRIVATE_REVIEW','OFFER_APPROVED'].includes(offer.status)) continue;
    if (offer.terms_approved !== true || offer.seller_confirmed !== true || !offer.evidence_ref) continue;
    if (offer.kind === 'physical' && !(offer.stock_confirmed && offer.quantity_available > 0)) continue;
    if (offer.kind !== 'physical' && offer.capacity_confirmed !== true) continue;
    if (!Number.isFinite(offer.price_nzd) || offer.price_nzd < 0 || offer.price_nzd > request.max_price_nzd) continue;
    if (!required.every(t => (offer.tags || []).includes(t))) continue;
    matches.push({request_id:request.request_id,silo_id:request.silo_id,offer_id:offer.offer_id,
      price_nzd:offer.price_nzd, stage:'PRIVATE_CANDIDATE_NOT_A_SALE',
      evidence_refs:[request.source_ref,request.consent.evidence_ref,offer.evidence_ref]});
  }
  matches.sort((a,b)=>a.price_nzd-b.price_nzd || a.offer_id.localeCompare(b.offer_id));
  return {state:matches.length?'PRIVATE_CANDIDATES':'NO_ELIGIBLE_OFFER',
    request_id:request.request_id,matches,verified_external_revenue_nzd:0,
    action:'PRIVATE_REVIEW_ONLY',no_outreach:true,no_payment_action:true};
}
