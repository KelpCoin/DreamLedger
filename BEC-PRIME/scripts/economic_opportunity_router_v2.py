#!/usr/bin/env python3
"""Contextual economic opportunity router.

Cold-start contextual UCB -> exploration UCB -> exploitation Thompson sampling.
Hard authority/dependency filters run before scoring. State is JSON serializable.
No external action is executed here.
"""
from __future__ import annotations
import json, math, random, sys
from dataclasses import dataclass, asdict, field
from typing import Any

@dataclass
class BusinessTruth:
    verified_payments: int = 0
    verified_revenue_nzd: float = 0.0
    independent_buyers: int = 0
    def context_key(self) -> str:
        if self.verified_payments == 0: return "PRE_REVENUE"
        if self.independent_buyers < 2: return "FIRST_REVENUE"
        if self.independent_buyers < 5: return "EARLY_REPLICATION"
        return "SCALE"

@dataclass
class AuthorityMap:
    OBSERVE: bool = True
    RECOMMEND: bool = True
    PREPARE: bool = True
    EXECUTE_INTERNAL: bool = True
    EXECUTE_EXTERNAL: bool = False
    def permits(self, level: str) -> bool: return bool(getattr(self, level, False))

@dataclass
class Candidate:
    candidate_id: str
    origin: str
    origin_ref: str
    action_class: str
    human_minutes_estimate: float
    token_cost_estimate: int
    reversibility: str
    authority_required: str
    dependencies_met: bool
    expected_evidence_if_successful: str
    kill_condition: str
    value_if_successful_nzd: float = 0.0
    is_duplicate_of_resolved: bool = False
    dependency_in_flight: bool = False

@dataclass
class ArmStats:
    pulls: int = 0
    successes: int = 0
    total_human_minutes: float = 0.0
    total_value_nzd: float = 0.0
    def alpha(self): return self.successes + 1.0
    def beta(self): return self.pulls - self.successes + 1.0
    def mean(self): return self.alpha() / (self.alpha() + self.beta())
    def sample(self): return random.betavariate(self.alpha(), self.beta())
    def ucb(self, delta=0.1):
        if self.pulls == 0: return float("inf")
        return self.mean() + math.sqrt(2 * math.log(1 / delta) / self.pulls)

@dataclass
class RouterState:
    business_truth: BusinessTruth
    authority_map: AuthorityMap
    candidates: list[Candidate]
    bandits: dict[str, dict[str, ArmStats]] = field(default_factory=dict)
    forced_pulls_per_arm: int = 3
    opportunity_rate_nzd_per_minute: float = 1.0
    min_value_nzd: float = 0.10

def stats_for(s, ctx, arm):
    s.bandits.setdefault(ctx, {})
    s.bandits[ctx].setdefault(arm, ArmStats())
    return s.bandits[ctx][arm]

def hard_filter(c, s):
    if not s.authority_map.permits(c.authority_required): return False, "AUTHORITY_NOT_PERMITTED"
    if not c.dependencies_met: return False, "DEPENDENCIES_NOT_MET"
    if c.dependency_in_flight: return False, "DEPENDENCY_IN_FLIGHT"
    if c.is_duplicate_of_resolved: return False, "DUPLICATE_OF_RESOLVED"
    return True, "OK"

def phase(s, ctx, candidates):
    if any(stats_for(s,ctx,c.action_class).pulls < s.forced_pulls_per_arm for c in candidates): return "COLD_START"
    if any(stats_for(s,ctx,c.action_class).pulls < s.forced_pulls_per_arm*2 for c in candidates): return "EXPLORATION"
    return "EXPLOITATION"

def select(s):
    ctx=s.business_truth.context_key()
    eligible=[]; filtered=[]
    for c in s.candidates:
        ok,reason=hard_filter(c,s)
        (eligible if ok else filtered).append(c if ok else {"candidate_id":c.candidate_id,"reason":reason})
    if not eligible:
        return {"status":"BLOCKED","context":ctx,"phase":phase(s,ctx,s.candidates),"reason":"NO_CANDIDATE_PASSES_HARD_FILTER","filtered":filtered}
    ph=phase(s,ctx,eligible)
    if ph=="COLD_START":
        c=min((c for c in eligible if stats_for(s,ctx,c.action_class).pulls<s.forced_pulls_per_arm),
              key=lambda c:(stats_for(s,ctx,c.action_class).pulls,c.human_minutes_estimate))
        reason="forced_cold_start_pull"
    elif ph=="EXPLORATION":
        def score(c):
            return stats_for(s,ctx,c.action_class).ucb()/max(c.human_minutes_estimate,0.1)
        c=max(eligible,key=score); reason="highest_ucb_per_human_minute"
    else:
        def score(c):
            st=stats_for(s,ctx,c.action_class)
            return st.sample()*(c.value_if_successful_nzd or s.min_value_nzd)-c.human_minutes_estimate*s.opportunity_rate_nzd_per_minute
        c=max(eligible,key=score); reason="thompson_sample_max"
    return {"status":"RECOMMENDATION" if c.authority_required=="EXECUTE_EXTERNAL" else "NEXT_ACTION",
            "context":ctx,"phase":ph,"next_action":c.candidate_id,"action_class":c.action_class,
            "origin_ref":c.origin_ref,"authority_required":c.authority_required,
            "human_minutes_estimate":c.human_minutes_estimate,
            "expected_evidence":c.expected_evidence_if_successful,"kill_condition":c.kill_condition,
            "reason":reason,"requires_human_gate":c.authority_required=="EXECUTE_EXTERNAL"}

def record_outcome(s,context,action_class,payment_observed,human_minutes,value_nzd=0.0):
    st=stats_for(s,context,action_class); st.pulls+=1
    if payment_observed: st.successes+=1
    st.total_human_minutes+=human_minutes; st.total_value_nzd+=value_nzd

def load(d):
    bt=BusinessTruth(**d.get("business_truth",{})); am=AuthorityMap(**d.get("authority_map",{}))
    cs=[Candidate(**c) for c in d.get("candidates",[])]
    s=RouterState(bt,am,cs,forced_pulls_per_arm=d.get("forced_pulls_per_arm",3),
                  opportunity_rate_nzd_per_minute=d.get("opportunity_rate_nzd_per_minute",1.0),
                  min_value_nzd=d.get("min_value_nzd",0.10))
    for ctx,arms in d.get("bandits",{}).items():
        s.bandits[ctx]={a:ArmStats(**st) for a,st in arms.items()}
    return s

def main():
    d=json.load(sys.stdin); s=load(d); out=select(s)
    out["_bandit_state"]={ctx:{a:asdict(st) for a,st in arms.items()} for ctx,arms in s.bandits.items()}
    print(json.dumps(out,indent=2,sort_keys=True))

if __name__=="__main__": main()
