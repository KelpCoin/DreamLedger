#!/usr/bin/env python3
"""Local event-bus -> LM Studio -> existing Gauntlet bridge.

LM Studio is advisory. Existing CORTEX/Gauntlet remains authoritative.
This adapter never sends outreach, executes checkout, claims revenue, or
mutates the authoritative economic ledger.
"""
import argparse, hashlib, json, os, sys, time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(os.environ.get("DREAMLEDGER_ROOT", Path(__file__).resolve().parents[2]))
LM_BASE = os.environ.get("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1").rstrip("/")
LM_MODEL = os.environ.get("LM_STUDIO_MODEL", "").strip()
PROOF_DIR = ROOT / "runtime" / "lm_studio" / "runs"

ALLOWED = {
    "2_FREQUENCY": {"isolated", "recurring", "widespread"},
    "3_URGENCY": {"nuisance", "costly", "blocking", "critical"},
    "5_BUYING_INTENT": {"none", "implied", "stated", "actively_seeking", "already_paying"},
    "6_MONEY_SIGNAL": {"explicit_budget", "existing_spend", "avoided_loss", "unknown"},
    "9_STATUS_BUCKET": {"WORKING_MONETIZABLE", "TRENDING_SPIKE", "DEAD_ABANDONED", "HUMAN_GATE_CANDIDATE"},
    "10_NEXT_ACTION": {"ignore", "monitor", "investigate", "free_diagnostic", "paid_offer_candidate", "cube_swarm_candidate"},
}

def sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def http_json(path, body=None, timeout=60):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = Request(
        LM_BASE + path,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST" if body is not None else "GET",
    )
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))

def fallback(signal, reason):
    text = (signal.get("text") or "").lower()
    money = any(k in text for k in ["pay", "budget", "cost", "spend", "burn", "$", "expensive", "invoice", "quote"])
    urgent = any(k in text for k in ["urgent", "asap", "critical", "broken", "failing", "deadline"])
    quote = any(k in text for k in ["supplier quote", "supplier quotation", "quote pdf", "supplier"])
    return {
        "1_PAIN": (signal.get("title") or "Signal requires classification")[:240],
        "2_FREQUENCY": "recurring" if any(k in text for k in ["every", "weekly", "monthly", "hours a week", "often", "manual"]) else "isolated",
        "3_URGENCY": "critical" if urgent and "critical" in text else ("costly" if money else "nuisance"),
        "4_CURRENT_WORKAROUND": "Unknown; preserve as unknown until evidence exists.",
        "5_BUYING_INTENT": "actively_seeking" if any(k in text for k in ["looking for", "need", "seeking", "want a tool"]) else ("implied" if money else "none"),
        "6_MONEY_SIGNAL": "existing_spend" if any(k in text for k in ["spend", "hours a week", "paying", "invoice"]) else ("avoided_loss" if money else "unknown"),
        "7_BUYER": "Unknown buyer role",
        "8_PRODUCT_OPPORTUNITY": "QUOTE-COMPARE-49" if quote else "UNMATCHED",
        "9_STATUS_BUCKET": "WORKING_MONETIZABLE" if money else "TRENDING_SPIKE",
        "10_NEXT_ACTION": "paid_offer_candidate" if money else "monitor",
        "_fallback_reason": reason,
    }

def classify(signal):
    prompt = f"""You are the bounded Cortex Demand Evaluator for DreamLedger.
Return JSON only. Never invent evidence, buyers, payments, outcomes, or budgets.
Classify the signal into exactly these ten fields:
1_PAIN, 2_FREQUENCY, 3_URGENCY, 4_CURRENT_WORKAROUND, 5_BUYING_INTENT,
6_MONEY_SIGNAL, 7_BUYER, 8_PRODUCT_OPPORTUNITY, 9_STATUS_BUCKET, 10_NEXT_ACTION.

Allowed values:
2_FREQUENCY=isolated|recurring|widespread
3_URGENCY=nuisance|costly|blocking|critical
5_BUYING_INTENT=none|implied|stated|actively_seeking|already_paying
6_MONEY_SIGNAL=explicit_budget|existing_spend|avoided_loss|unknown
9_STATUS_BUCKET=WORKING_MONETIZABLE|TRENDING_SPIKE|DEAD_ABANDONED|HUMAN_GATE_CANDIDATE
10_NEXT_ACTION=ignore|monitor|investigate|free_diagnostic|paid_offer_candidate|cube_swarm_candidate

Title: {signal.get("title", "")}
Text: {(signal.get("text") or "")[:1200]}
URL: {signal.get("url", "")}
"""
    try:
        from beck_lmstudio_sdk import classify_with_sdk
        result, telemetry = classify_with_sdk(prompt, LM_MODEL)
        required = ["1_PAIN","2_FREQUENCY","3_URGENCY","4_CURRENT_WORKAROUND","5_BUYING_INTENT","6_MONEY_SIGNAL","7_BUYER","8_PRODUCT_OPPORTUNITY","9_STATUS_BUCKET","10_NEXT_ACTION"]
        for key in required:
            if key not in result:
                raise ValueError("MISSING_" + key)
            if key in ALLOWED and result[key] not in ALLOWED[key]:
                raise ValueError("INVALID_" + key)
        return result, telemetry
    except Exception as exc:
        return fallback(signal, str(exc)), {"provider": "cortex-heuristic", "model": None, "fallback": True, "error": str(exc)}

def load_offer(audit):
    needle = str(audit.get("8_PRODUCT_OPPORTUNITY", "")).upper()
    path = ROOT / "BEC-PRIME" / "catalog" / "offers" / "approved.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    for offer in data.get("approved", []):
        ids = {str(offer.get(k, "")).upper() for k in ("offer_id", "product_id", "product_sku")}
        if needle in ids:
            return offer
    return None

def run_existing_gauntlet(audit, signal, offer):
    score = 0
    score += {"none":0,"implied":5,"stated":10,"actively_seeking":15,"already_paying":20}.get(audit.get("5_BUYING_INTENT"), 0)
    score += {"unknown":0,"avoided_loss":10,"existing_spend":15,"explicit_budget":20}.get(audit.get("6_MONEY_SIGNAL"), 0)
    score += {"nuisance":2,"costly":7,"blocking":10,"critical":12}.get(audit.get("3_URGENCY"), 0)
    score += {"isolated":2,"recurring":8,"widespread":10}.get(audit.get("2_FREQUENCY"), 0)
    if audit.get("7_BUYER") and audit.get("7_BUYER") != "Unknown buyer role":
        score += 10
    if audit.get("8_PRODUCT_OPPORTUNITY") not in {"", "UNMATCHED"}:
        score += 10
    if audit.get("10_NEXT_ACTION") == "paid_offer_candidate":
        score += 10
    score = min(100, score)

    proposal = {
        "offer_id": (offer or {}).get("offer_id", audit.get("8_PRODUCT_OPPORTUNITY")),
        "name": (offer or {}).get("name", audit.get("8_PRODUCT_OPPORTUNITY")),
        "problem": audit.get("1_PAIN"),
        "target_buyer": audit.get("7_BUYER"),
        "deliverable": (offer or {}).get("deliverable", "candidate output"),
        "delivery_mechanism": (offer or {}).get("delivery_mechanism", "digital"),
        "price": (offer or {}).get("price", 49),
        "currency": (offer or {}).get("currency", "NZD"),
        "payment_adapter": (offer or {}).get("payment_adapter", "stripe"),
        "checkout_route": (offer or {}).get("checkout_route", "stripe_payment_link"),
        "approval_required": True,
        "checkout_available": False,
        "status": "candidate",
        "proof_of_delivery": (offer or {}).get("proof_of_delivery", "evidence required"),
        "verification_rules": (offer or {}).get("verification_rules", ["evidence_present"]),
        "provenance": (offer or {}).get("provenance", {"private_material": "excluded"}),
        "silo": "dreamledger",
        "kill_condition": "no buyer response or contradictory evidence",
    }
    artifact = {
        "artifact_id": "CORTEX-SIGNAL-" + sha(json.dumps(signal, sort_keys=True))[:16].upper(),
        "job_id": signal.get("id"),
        "silo_id": "SILO_DREAMLEDGER",
        "score": score,
        "proposal": proposal,
        "evidence_refs": [signal["url"]] if signal.get("url") else [],
        "reasons": ["LM Studio classification is advisory; existing CORTEX Gauntlet remains authoritative."],
    }
    sys.path.insert(0, str(ROOT))
    try:
        from CORTEX.gauntlet_adapter import evaluate
        return evaluate(artifact)
    except Exception as exc:
        return {"decision": "FAIL", "score": 0, "reasons": ["CORTEX_GAUNTLET_ERROR:" + str(exc)]}

def checkout_decision(gauntlet, offer):
    if gauntlet.get("decision") != "PASS":
        return {"status": "NO_ACTION", "reason": "GAUNTLET_NOT_PASS"}
    if not offer:
        return {"status": "HUMAN_GATE_REQUIRED", "reason": "NO_APPROVED_OFFER"}
    if offer.get("approval_required") is not False or offer.get("checkout_available") is not True:
        return {"status": "HUMAN_GATE_REQUIRED", "reason": "OFFER_NOT_APPROVED_FOR_CHECKOUT"}
    return {
        "status": "CHECKOUT_CANDIDATE",
        "reason": "Approved existing offer matches signal; external send remains approval-gated.",
        "offer_id": offer.get("offer_id"),
        "payment_link_url": offer.get("payment_link_url"),
    }

def process(signal):
    process_started = time.perf_counter()
    audit, provider = classify(signal)
    offer = load_offer(audit)
    gauntlet = run_existing_gauntlet(audit, signal, offer)
    decision = checkout_decision(gauntlet, offer)
    provider.setdefault("task_class", "demand_signal_classification")
    provider.setdefault("latency_ms", None)
    provider.setdefault("input_tokens", None)
    provider.setdefault("output_tokens", None)
    provider.setdefault("estimated_cost", None)
    provider.setdefault("cost_currency", None)
    result = {
        "schema": "BEC/LOCAL-CORTEX-SIGNAL-GAUNTLET/v1",
        "signal": signal,
        "audit": audit,
        "provider": provider,
        "runtime_latency_ms": round((time.perf_counter() - process_started) * 1000, 2),
        "gauntlet": gauntlet,
        "checkout_decision": decision,
        "external_action_taken": False,
        "revenue_claim": False,
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    result["input_hash"] = sha(json.dumps(signal, sort_keys=True))
    result["output_hash"] = sha(json.dumps(result, sort_keys=True))
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    (PROOF_DIR / ("signal-" + result["input_hash"][:16] + ".json")).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--signal-file")
    parser.add_argument("--stdin-jsonl", action="store_true")
    parser.add_argument("--cortex-act", help="Run a bounded, read-only LM Studio .act task")
    parser.add_argument("--act-max-tool-calls", type=int, default=3)
    parser.add_argument("--act-max-rounds", type=int, default=4)
    args = parser.parse_args()
    if args.cortex_act:
        from beck_lmstudio_sdk import cortex_act
        print(json.dumps(cortex_act(args.cortex_act, model_key=LM_MODEL,
                                    max_tool_calls=args.act_max_tool_calls,
                                    max_rounds=args.act_max_rounds), indent=2))
        return
    if args.stdin_jsonl:
        for line in sys.stdin:
            if line.strip():
                print(json.dumps(process(json.loads(line)), separators=(",", ":")), flush=True)
        return
    if not args.signal_file:
        raise SystemExit("Use --signal-file <json> or --stdin-jsonl")
    signal = json.loads(Path(args.signal_file).read_text(encoding="utf-8"))
    print(json.dumps(process(signal), indent=2))

if __name__ == "__main__":
    main()
