"""Deterministic CUBE mechanism matcher.
Candidate generation only. It never clears Truth/Gauntlet or publishes a CTA.
"""
from __future__ import annotations
import hashlib, json, os, urllib.parse, urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def request(path, params=None, method="GET", body=None):
    url = f"{URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req, timeout=20) as res:
        raw = res.read()
        return json.loads(raw) if raw else []

def words(value):
    if value is None:
        return set()
    if isinstance(value, (list, tuple)):
        value = " ".join(map(str, value))
    if isinstance(value, dict):
        value = " ".join(map(str, value.values()))
    return {w for w in str(value).lower().replace("-", " ").split() if len(w) > 2}

def fit(signal, mechanism):
    payload = signal.get("payload") or {}
    signal_text = words(" ".join([str(payload.get("title","")), str(payload.get("body","")), str(payload.get("intent_candidate","")), str(signal.get("signal_key",""))]))
    haystack = words(" ".join([str(mechanism.get("label","")), str(mechanism.get("mechanism_type","")), json.dumps(mechanism.get("buyer_fit",{})), json.dumps(mechanism.get("problem_fit",{})), json.dumps(mechanism.get("value_exchange",{})), str(mechanism.get("price_model","")), json.dumps(mechanism.get("conversion_triggers",[])), json.dumps(mechanism.get("fulfillment_methods",[]))]))
    overlap = sorted(signal_text & haystack)
    reasons = [f"keyword:{x}" for x in overlap[:8]]
    score = min(1.0, len(overlap) / 8.0)
    if payload.get("intent_candidate") is True:
        score = min(1.0, score + 0.25)
        reasons.append("intent_candidate")
    return score, reasons

def context_hash(buyer_segment, problem_signature, value_exchange, price_model, distribution_channel):
    raw = "|".join([str(buyer_segment or "").strip().lower(), str(problem_signature or "").strip().lower(), str(value_exchange or "").strip().lower(), str(price_model or "").strip().lower(), str(distribution_channel or "").strip().lower()])
    return hashlib.sha256(raw.encode()).hexdigest()

def main():
    signals = request("demand_signals", {
        "select":"id,silo,signal_key,source,evidence_ref,payload,demand_evidence_status,payment_intent_status,truth_verdict,gauntlet_verdict",
        "publication_state":"eq.HIDDEN",
        "demand_evidence_status":"in.(VERIFIED,UNVERIFIED)",
        "order":"observed_at.desc","limit":"50"})
    mechanisms = request("cube_mechanisms", {"select":"*","enabled":"eq.true","limit":"200"})
    created = 0
    for signal in signals:
        if signal.get("truth_verdict") == "BLOCK" or signal.get("gauntlet_verdict") == "BLOCK":
            continue
        for mechanism in mechanisms:
            score, reasons = fit(signal, mechanism)
            if score < 0.25:
                continue
            payload = signal.get("payload") or {}
            buyer = payload.get("buyer") or payload.get("buyer_segment") or {}
            problem = payload.get("problem") or payload.get("problem_signature") or signal.get("signal_key")
            value = payload.get("value_exchange") or mechanism.get("value_exchange") or {}
            price_model = payload.get("price_model") or mechanism.get("price_model")
            channel = payload.get("distribution_channel") or signal.get("source")
            ctx = {"buyer_segment":buyer,"problem_signature":problem,"value_exchange":value,"price_model":price_model,"distribution_channel":channel,"context_hash":context_hash(buyer,problem,value,price_model,channel)}
            body = {
                "silo_id": signal.get("silo") or "CUBE_DISCOVERY",
                "demand_signal_id": signal["id"],
                "mechanism_id": mechanism["mechanism_id"],
                "buyer": buyer if isinstance(buyer,dict) else {"label":str(buyer)},
                "problem": str(problem),
                "demand_evidence": {"status":signal.get("demand_evidence_status"),"source":signal.get("source"),"evidence_ref":signal.get("evidence_ref")},
                "payment_intent_status": signal.get("payment_intent_status") or "UNVERIFIED",
                "evidence_status": signal.get("demand_evidence_status") or "UNVERIFIED",
                "gauntlet_verdict":"PENDING","truth_verdict":"PENDING","selection_state":"CANDIDATE",
                "test_action":{"type":"NEXT_CHEAPEST_EXTERNAL_MEASUREMENT"},
                "expected_evidence":{"payment":"STRIPE_WEBHOOK_VERIFIED"},
                "score":score,"rationale":"; ".join(reasons),"context":ctx,
                "provenance":{"matcher":"deterministic","source_signal":signal["id"]}}
            request("cube_mechanism_matches", {"on_conflict":"demand_signal_id,mechanism_id"}, "POST", body)
            created += 1
    print(json.dumps({"status":"OK","matches_created":created}))

if __name__ == "__main__":
    main()
