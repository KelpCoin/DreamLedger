// CUBE shared Patreon-to-Discord policy evaluator.
// Pure, private, reusable across silos. Provider verification happens upstream.
const disclosures=['PUBLIC','SIGNAL','INTELLIGENCE','FACTORY'];
export function evaluateMemberAccess(config, membership, request) {
  const hold=reason=>({decision:'DENY',reason,action:'NO_ROLE_WRITE',verified_external_revenue_nzd:0});
  if(!config?.enabled || !config.silo_id || !membership || !request) return hold('CONFIG_DISABLED');
  if(config.silo_id !== membership.silo_id || config.silo_id !== request.silo_id || request.resource_silo_id!==config.silo_id) return hold('SILO_ISOLATION');
  if(!request.member_ref || request.member_ref !== membership.member_ref || request.member_ref.includes('@')) return hold('MEMBER_IDENTITY_NOT_CONFIRMED');
  if(membership.provider!=='patreon' || membership.provider_authentic!==true || membership.current_membership_checked!==true || !membership.provider_evidence_ref) return hold('UNVERIFIED_PROVIDER');
  if(membership.status!=='active' || membership.revoked===true || (membership.valid_until && Date.parse(membership.valid_until)<=Date.now())) return hold('INACTIVE_MEMBERSHIP');
  const tier=(config.tiers||[]).find(t=>t.provider_tier_id===membership.provider_tier_id && t.enabled===true);
  if(!tier || !tier.discord_role_id || !disclosures.includes(tier.max_disclosure_class)) return hold('NO_CONFIGURED_TIER');
  if(!disclosures.includes(request.resource_class) || disclosures.indexOf(request.resource_class)>disclosures.indexOf(tier.max_disclosure_class)) return hold('DISCLOSURE_NOT_ALLOWED');
  if(request.resource_class==='FACTORY' && request.owner_approved!==true) return hold('OWNER_APPROVAL_REQUIRED');
  return {decision:'ELIGIBLE_FOR_VERIFIED_ROLE_SYNC',action:'PRIVATE_REVIEW_ONLY',silo_id:config.silo_id,
    member_ref:request.member_ref,discord_role_id:tier.discord_role_id,
    disclosure_class:request.resource_class,provider_evidence_ref:membership.provider_evidence_ref,
    verified_external_revenue_nzd:0,no_network_action:true};
}
