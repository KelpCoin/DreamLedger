"""Pure marketplace state transitions. No payment or external messaging."""
import json
from pathlib import Path
import os

from figure_eight_council import CouncilError, load_providers, SCHEMA as COUNCIL_SCHEMA

ROOT = Path(__file__).resolve().parent
CONTRACT = json.loads((ROOT / "marketplace-contract.json").read_text(encoding="utf-8"))

ALLOWED = {
    "SUBMITTED": {"SCREENING"},
    "SCREENING": {"GAUNTLET"},
    "GAUNTLET": {"APPROVED", "SUSPENDED"},
    "APPROVED": {"PUBLISHED", "SUSPENDED"},
    "PUBLISHED": {"SOLD_OUT", "SUSPENDED", "RETIRED"},
    "SOLD_OUT": {"PUBLISHED", "RETIRED"},
    "SUSPENDED": {"SCREENING", "RETIRED"},
    "RETIRED": set(),
}


def transition_inventory(current, target):
    if target not in ALLOWED.get(current, set()):
        raise ValueError("invalid inventory transition: %s -> %s" % (current, target))
    return target


def validate_inventory(item):
    required = ("inventory_id", "seller_id", "category", "description", "currency", "fulfilment")
    missing = [key for key in required if not item.get(key)]
    if missing:
        raise ValueError("missing inventory fields: " + ",".join(missing))
    if item.get("status") not in CONTRACT["lifecycle"]["inventory"]:
        raise ValueError("invalid inventory status")
    return True


def match_score(buyer, item):
    score = 0
    if buyer.get("category") == item.get("category"):
        score += 40
    if buyer.get("currency") == item.get("currency"):
        score += 15
    if buyer.get("budget") is not None and item.get("price") is not None and item["price"] <= buyer["budget"]:
        score += 20
    if item.get("evidence"):
        score += 15
    if item.get("availability", True):
        score += 10
    return score

def council_readiness():
    if not os.environ.get("BECK_COUNCIL_MODELS", "").strip():
        return {"schema": COUNCIL_SCHEMA, "status": "BLOCKED_CONFIGURATION", "reason": "BECK_COUNCIL_MODELS is not configured", "minimum_distinct_models": 2}
    try:
        providers = load_providers()
        return {"schema": COUNCIL_SCHEMA, "status": "CONFIGURED", "distinct_models": len(providers)}
    except CouncilError as exc:
        return {"schema": COUNCIL_SCHEMA, "status": "BLOCKED_CONFIGURATION", "reason": str(exc), "minimum_distinct_models": 2}


if __name__ == "__main__":
    print(json.dumps({
        "schema": "dreamledger/marketplace-runtime/v1",
        "status": "READY",
        "states": CONTRACT["lifecycle"],
        "figure_eight_council": council_readiness()
    }, indent=2))
