import importlib.util
from pathlib import Path
p=Path(__file__).with_name("economic_opportunity_router_v2.py")
spec=importlib.util.spec_from_file_location("router",p); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

def candidate(cid, arm, authority="RECOMMEND", minutes=3):
    return m.Candidate(cid,"PROMPT",cid,arm,minutes,1000,"high",authority,True,"EVIDENCE","KILL")

def test_cold_start_round_robin():
    s=m.RouterState(m.BusinessTruth(),m.AuthorityMap(),[candidate("A","a"),candidate("B","b")],forced_pulls_per_arm=1)
    r1=m.select(s); m.record_outcome(s,"PRE_REVENUE",r1["action_class"],False,3)
    r2=m.select(s)
    assert r1["action_class"] != r2["action_class"]
    assert r1["phase"]=="COLD_START"

def test_context_isolation():
    s=m.RouterState(m.BusinessTruth(),m.AuthorityMap(),[candidate("A","a")])
    m.record_outcome(s,"PRE_REVENUE","a",True,1,10)
    m.record_outcome(s,"SCALE","a",False,1,0)
    assert m.stats_for(s,"PRE_REVENUE","a").successes==1
    assert m.stats_for(s,"SCALE","a").successes==0

def test_external_is_hard_blocked():
    s=m.RouterState(m.BusinessTruth(),m.AuthorityMap(EXECUTE_EXTERNAL=False),[candidate("X","outreach","EXECUTE_EXTERNAL")])
    r=m.select(s)
    assert r["status"]=="BLOCKED"
    assert r["filtered"][0]["reason"]=="AUTHORITY_NOT_PERMITTED"

def test_learning_changes_posterior():
    s=m.RouterState(m.BusinessTruth(),m.AuthorityMap(),[candidate("A","a")],forced_pulls_per_arm=1)
    for _ in range(3): m.record_outcome(s,"PRE_REVENUE","a",True,1,50)
    assert m.stats_for(s,"PRE_REVENUE","a").mean()>0.7
