from runtime.transition_primitives import canonical_state_hash, checkpoint_id, build_checkpoint

def test_state_hash_is_order_independent():
    assert canonical_state_hash({"b":2,"a":1}) == canonical_state_hash({"a":1,"b":2})

def test_checkpoint_id_is_deterministic():
    assert checkpoint_id("t1", "abc") == checkpoint_id("t1", "abc")

def test_checkpoint_changes_when_state_changes():
    assert checkpoint_id("t1", "abc") != checkpoint_id("t1", "def")

def test_checkpoint_contains_hash_and_snapshot():
    cp = build_checkpoint("t1", {"state":"OFFER_READY","price":50})
    assert cp["transition_id"] == "t1"
    assert cp["snapshot"]["price"] == 50
    assert len(cp["state_hash"]) == 64
