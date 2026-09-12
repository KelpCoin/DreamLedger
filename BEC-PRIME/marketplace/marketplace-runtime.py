"""Pure marketplace state transitions. No payment or external messaging."""
import json
from pathlib import Path

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

if __name__ == "__main__":
    print(json.dumps({"schema": "dreamledger/marketplace-runtime/v1", "status": "READY", "states": CONTRACT["lifecycle"]}, indent=2))
