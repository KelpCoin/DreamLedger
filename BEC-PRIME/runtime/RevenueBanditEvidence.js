'use strict';
// Pure, read-only evidence adapter around the canonical RevenueBandit.js.
// NEVER uses checkout starts, clicks, test purchases or generated hypotheses as paid reward.
const {ucb1}=require('./RevenueBandit');
const SHA256=/^[a-f0-9]{64}$/;
const ALLOWED=new Set(['mtg','truth_oracle','b2b','billboard','avatar','kelphaven','agent_bridge','digital_tools','marketplace']);
const MIN_EXPOSURES=30;
const MAX_EVENTS=10000;
const MAX_SHADOW_EXPOSURE_SHARE=0.10;
const NZD100_IN_CENTS=10000;

function safeInt(value){return Number.isSafeInteger(value)&&value>=0;}
function fatal(condition,message){if(!condition)throw new Error(message);}

function analyzeArm(arm){
  fatal(arm&&typeof arm==='object'&&typeof arm.id==='string'&&arm.id.length>0,'ARM_ID_REQUIRED');
  fatal(ALLOWED.has(arm.silo),'INVALID_SILO');
  fatal(Array.isArray(arm.events)&&arm.events.length<=MAX_EVENTS,'EVENTS_INVALID_OR_OVER_LIMIT');
  const issues=[],exposures=new Map(),payments=new Set(),eventIds=new Set();
  const economic=[];
  for(const e of arm.events){
    if(!e||typeof e!=='object'||!e.event_id||eventIds.has(e.event_id)){
      issues.push('INVALID_OR_DUPLICATE_EVENT');continue;
    }
    eventIds.add(e.event_id);
    if(e.silo!==arm.silo){issues.push('CROSS_SILO_EVENT_REJECTED');continue;}
    if(e.type==='exposure'){
      if(e.observed===true&&e.source_ref&&e.visit_id&&!exposures.has(e.visit_id))
        exposures.set(e.visit_id,e);
      else issues.push('UNVERIFIED_OR_DUPLICATE_EXPOSURE');
    }else if(e.type==='sale') economic.push(e);
    else issues.push('UNKNOWN_EVENT_TYPE');
  }
  let paid=0,contribution=0,positive=0,negative=0;
  for(const e of economic){
    const validated=e.external_buyer_verified===true&&e.provider_settlement_reconciled===true&&
      e.attribution_reconciled===true&&e.delivery_verified===true&&
      e.independent_proof_verified===true&&e.rights_verified===true&&
      typeof e.payment_id==='string'&&e.payment_id.startsWith('pi_')&&
      typeof e.delivery_sha256==='string'&&SHA256.test(e.delivery_sha256)&&
      e.currency==='nzd'&&safeInt(e.paid_minor)&&e.paid_minor>0&&
      safeInt(e.direct_cost_minor)&&e.visit_id&&exposures.has(e.visit_id)&&
      !payments.has(e.payment_id);
    if(!validated){issues.push('UNVERIFIED_ECONOMIC_EVENT');continue;}
    // All input declarations remain self-reported until evidence is independently audited.
    payments.add(e.payment_id);
    paid++;const margin=e.paid_minor-e.direct_cost_minor;contribution+=margin;
    if(margin>0)positive++;if(margin<0)negative++;
  }
  const exposureCount=exposures.size;
  const epvMinor=exposureCount?contribution/exposureCount:null;
  const enough=exposureCount>=MIN_EXPOSURES;
  // Unitless [0,1] bounded proxy; never substitute for actual contribution margin.
  const meanReward=exposureCount?Math.max(0,Math.min(1,(epvMinor||0)/NZD100_IN_CENTS)):0;
  const hasEvidence=paid>0;
  return {
    arm_id:arm.id,silo:arm.silo,
    exposures:exposureCount,provider_reconciled_sales_reported:paid,
    reported_positive_contribution_sales:positive,reported_negative_contribution_sales:negative,
    reported_contribution_minor:contribution,reported_epv_minor:epvMinor,
    candidate_bandit_arm:{id:arm.id,pulls:exposureCount,reward:meanReward*exposureCount},
    readiness:!hasEvidence?'NO_ATTRIBUTABLE_ECONOMIC_OUTCOME':
      !enough?'INSUFFICIENT_EXPOSURES':'REQUIRES_INDEPENDENT_AUDIT_AND_HUMAN_APPROVAL',
    issue_codes:[...new Set(issues)].sort(),
    winner:false,clone_permission:false,prune_permission:false,live_pricing_permission:false,
    publication_permission:false,traffic_mutation_permission:false,
  };
}

function assessPortfolio(arms){
  fatal(Array.isArray(arms)&&arms.length>0&&arms.length<=100,'ARMS_INVALID');
  const seen=new Set(),reports=[];
  for(const arm of arms){
    const r=analyzeArm(arm);
    fatal(!seen.has(r.arm_id),'DUPLICATE_ARM');
    seen.add(r.arm_id);reports.push(r);
  }
  const ready=reports.filter(x=>x.provider_reconciled_sales_reported>0&&x.exposures>=MIN_EXPOSURES&&
    x.reported_contribution_minor>0&&x.issue_codes.length===0);
  const total=ready.reduce((s,a)=>s+a.exposures,0);
  const priorities=ready.map(x=>({
    arm_id:x.arm_id,
    // Prefer bounded exploration of reviewed profitable data; a negative EPV cannot win.
    shadow_ucb1:ucb1(x.candidate_bandit_arm,total),
  })).sort((a,b)=>b.shadow_ucb1-a.shadow_ucb1||a.arm_id.localeCompare(b.arm_id));
  return {
    schema:'BECK/REVENUE-BANDIT-EVIDENCE/v1',
    mode:'SHADOW_REVIEW_ONLY',
    source_claim:'INPUT_FLAGS_ARE_ASSERTIONS_NOT_PROVIDER_VERIFICATION',
    sample_minimum:MIN_EXPOSURES,
    max_future_exploration_share:MAX_SHADOW_EXPOSURE_SHARE,
    unit:'NZD_MINOR_UNITS_PER_VALIDATED_VISITOR_EXPOSURE',
    arms:reports,shadow_priority:priorities,
    outcome:priorities.length?'REVIEW_RANKING_ONLY':'NO_SUPPORTED_REWARD_TO_OPTIMIZE',
    portfolio_state:'HOLD',
    all_external_actions:'BLOCKED',
    live_price_changes:false,auto_tenant_spawning:false,
    auto_cloning:false,auto_pruning:false,
    independent_audit_required:true,
  };
}
module.exports={analyzeArm,assessPortfolio};
