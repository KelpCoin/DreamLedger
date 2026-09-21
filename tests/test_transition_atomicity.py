import asyncio
import pytest
from runtime.attempt_transition_v2 import attempt_transition, evaluate_preconditions, transition_id

POLICY = {
    "from_state": "OFFER_READY", "to_state": "OFFER_PUBLISHED", "authority_lane": "AMBER",
    "deterministic_preconditions": [
        {"field": "offer_exists", "required": True},
        {"field": "offer_internally_complete", "required": True},
        {"field": "price_present", "required": True},
        {"field": "sku_present", "required": True},
        {"field": "destination_url_present", "required": True},
        {"field": "fulfillment_method_present", "required": True},
        {"field": "required_evidence_present", "required": True},
        {"field": "publication_authority_granted", "required": True},
        {"field": "not_already_published", "required": True},
        {"field": "transition_not_already_executed", "required": True},
    ],
}

def complete_offer():
    return {"id":"offer-1","version":1,"state":"OFFER_READY",
            **{c["field"]:True for c in POLICY["deterministic_preconditions"]}}

def test_transition_id_is_deterministic():
    assert transition_id("offer-1","OFFER_READY","OFFER_PUBLISHED") == transition_id("offer-1","OFFER_READY","OFFER_PUBLISHED")

def test_missing_price_is_rejected():
    offer=complete_offer(); offer["price_present"]=False
    passed, failures=evaluate_preconditions(POLICY,offer)
    assert not passed and failures==["price_present"]

class FakeTx:
    async def __aenter__(self): return self
    async def __aexit__(self,*args): return False

class FakeDB:
    def __init__(self,offer): self.offer=offer; self.rows={}; self.inserts=0; self.updates=0
    def transaction(self): return FakeTx()
    async def fetchrow(self,query,*args):
        if "economic_transitions" in query:
            return self.rows.get(args[0]) or self.rows.get(args[1])
        if "from public.offers" in query: return self.offer
        if "update public.offers" in query: return {"id":self.offer["id"],"version":self.offer["version"]+1}
        return None
    async def execute(self,query,*args):
        if "insert into public.economic_transitions" in query:
            tid=args[0]
            if tid in self.rows: return
            row={"outcome":args[4],"transition_id":tid}
            self.rows[tid]=row; self.rows[args[6]]=row; self.inserts+=1
        elif "update public.offers" in query: self.updates+=1

@pytest.mark.asyncio
async def test_duplicate_idempotency_key_returns_existing_result():
    db=FakeDB(complete_offer())
    r1=await attempt_transition(db,"offer-1",POLICY,"key-abc")
    r2=await attempt_transition(db,"offer-1",POLICY,"key-abc")
    assert r1["outcome"]=="AWAITING_AUTHORIZATION"
    assert r2["replay"] is True and r2["outcome"]==r1["outcome"]
    assert db.inserts==1

@pytest.mark.asyncio
async def test_concurrent_attempts_cannot_append_duplicate_transition():
    db=FakeDB(complete_offer())
    results=await asyncio.gather(
        attempt_transition(db,"offer-1",POLICY,"key-1"),
        attempt_transition(db,"offer-1",POLICY,"key-2"))
    assert len(results)==2 and db.inserts==1

@pytest.mark.asyncio
async def test_approved_transition_requires_compare_and_swap():
    policy=dict(POLICY,authority_lane="GREEN"); db=FakeDB(complete_offer())
    result=await attempt_transition(db,"offer-1",policy,"key-green")
    assert result["outcome"]=="APPROVED" and db.updates==1
