from runtime.event_envelope import EventEnvelope
from runtime.autonomy_budget import evaluate_window

def test_event_envelope_is_idempotent_for_transition():
    a=EventEnvelope.create("OFFER_READY","t1","cortex",{"x":1})
    assert a.idempotency_key=="dl-event-t1"
    assert a.schema_version=="1.0"

def test_autonomy_demotes_on_missing_metric():
    r=evaluate_window({},{"verified_outcome_rate":0.9},"AUTONOMOUS","AUTONOMOUS")
    assert r["action"]=="DEMOTE"

def test_autonomy_promotes_only_when_thresholds_pass():
    r=evaluate_window({"verified_outcome_rate":1.0},{"verified_outcome_rate":0.9},"GATED","AUTONOMOUS")
    assert r["action"]=="PROMOTE"

def test_autonomy_holds_at_registered_max():
    r=evaluate_window({"verified_outcome_rate":1.0},{"verified_outcome_rate":0.9},"AUTONOMOUS","AUTONOMOUS")
    assert r["action"]=="HOLD"
