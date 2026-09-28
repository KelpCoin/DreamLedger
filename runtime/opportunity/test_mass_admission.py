from mass_admission import evaluate

REGISTRY = {"capabilities": [{"id": "FULL", "automation": "FULL"}, {"id": "PARTIAL", "automation": "PARTIAL"}]}

BASE = {"opportunity_id": "o1", "confidence": 0.9, "commercial_relevance": 0.9, "evidence": {"source": "public"}, "required_capabilities": ["FULL"], "authority_lane": "GREEN", "external_action_allowed": True}

assert evaluate(BASE, REGISTRY).state == "EXECUTABLE"
assert evaluate({**BASE, "external_action_allowed": None}, REGISTRY).state == "TRAVERSABLE"
assert evaluate({**BASE, "required_capabilities": ["MISSING"]}, REGISTRY).state == "QUALIFIABLE"
assert evaluate({**BASE, "required_capabilities": ["PARTIAL"]}, REGISTRY).state == "HUMAN_GATED"
assert evaluate({**BASE, "authority_lane": "UNKNOWN"}, REGISTRY).state == "CAPABILITY_MATCHED"
assert evaluate({**BASE, "confidence": 0.2}, REGISTRY).state == "REJECTED"
print("6/6 mass-admission tests passed")
