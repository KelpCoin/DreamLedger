#!/usr/bin/env python3
"""Local-first multi-model revenue operator for DreamLedger.

This is a decision-support and evidence engine, not an autonomous publisher.
It keeps a hash-chained JSONL memory, asks diverse local models to propose,
attack, price, verify and synthesize one offer, then runs CandidateGauntlet.
No payment, posting, deployment, or public action is performed here.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

DEFAULT_MODELS = [
    "qwen2.5-coder-14b-instruct",
    "phi-3-mini-4k-instruct",
    "qwen2.5-coder-14b-instruct",
]


def now():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def post_chat(url, model, system, user, timeout=120):
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.15,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError("LM Studio unavailable: %s" % exc)
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError("Unexpected LM Studio response: %s" % json.dumps(data)[:2000])


def extract_json(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
    raise RuntimeError("Model did not return JSON: %s" % text[:1500])


def load_memory(path):
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows[-50:]


def append_memory(path, event):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    previous = "0" * 64
    if os.path.exists(path):
        with open(path, "rb") as f:
            for line in f:
                if line.strip():
                    previous = json.loads(line.decode("utf-8"))["event_hash"]
    record = dict(event)
    record["previous_hash"] = previous
    record["event_hash"] = sha(json.dumps(record, sort_keys=True, ensure_ascii=False))
    with open(path, "ab") as f:
        f.write((json.dumps(record, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8"))
    return record


def call_role(url, model, role, task, context):
    system = (
        "You are the %s in a local revenue-control system. "
        "Commercial claims must be evidence-backed. Never invent buyers, demand, "
        "payments, compliance status, integrations, or market validation. "
        "Prefer the smallest sellable result within 48 hours. Return JSON only."
    ) % role
    user = task + "\n\nCONTEXT:\n" + json.dumps(context, ensure_ascii=False, indent=2)
    raw = post_chat(url, model, system, user)
    return {"role": role, "model": model, "raw": raw, "json": extract_json(raw)}


def run(args):
    models = [m.strip() for m in args.models.split(",") if m.strip()]
    if not models:
        models = list(DEFAULT_MODELS)
    while len(models) < 3:
        models.append(models[-1])

    run_id = "REV-" + now()
    out = os.path.abspath(os.path.join(args.out_dir, run_id))
    os.makedirs(out, exist_ok=True)
    memory_path = os.path.abspath(args.memory)
    memory = load_memory(memory_path)

    signal = {
        "signal": args.signal,
        "silo": args.silo,
        "constraint": "cash-first, low cognitive load, no autonomous public action",
        "approved_offer_catalog": args.approved_catalog,
    }
    with open(os.path.join(out, "INPUT.json"), "w", encoding="utf-8") as f:
        json.dump(signal, f, indent=2, ensure_ascii=False)

    transcript = []
    proposer = call_role(args.url, models[0], "PROPOSER",
        "Create exactly one narrow paid offer. Return offer_id, name, problem, target_buyer, "
        "deliverable, delivery_mechanism, price, currency, payment_adapter, checkout_route, "
        "approval_required, checkout_available, status, proof_of_delivery, verification_rules, "
        "provenance, silo, demand_evidence, why_buyer_pays_now, kill_condition.",
        {"signal": signal, "memory": memory})
    transcript.append(proposer)

    attacker = call_role(args.url, models[1], "ADVERSARIAL_CRITIC",
        "Try to kill the proposal. Find unsupported market claims, weak urgency, bad unit economics, "
        "delivery risk, privacy leakage, silo leakage, false compliance claims, and reasons a real buyer "
        "would refuse to pay. Return verdict, failures, required_fixes, and revised_offer.", proposer["json"])
    transcript.append(attacker)

    verifier = call_role(args.url, models[2], "EVIDENCE_VERIFIER",
        "Separate observed facts from hypotheses. Score evidence quality. Reject any claim that is not "
        "supported by the supplied context. Return evidence_grade, verified_facts, unsupported_claims, "
        "minimum_missing_evidence, and whether the offer is worth testing.",
        {"proposal": proposer["json"], "critique": attacker["json"], "memory": memory})
    transcript.append(verifier)

    monetizer = call_role(args.url, models[0], "MONETIZER",
        "Turn the surviving idea into a simple payment experiment. Specify one price, one buyer trigger, "
        "one checkout path, one delivery artifact, one proof artifact, and one kill condition. "
        "Do not invent payment evidence.",
        {"proposal": proposer["json"], "critique": attacker["json"], "verification": verifier["json"]})
    transcript.append(monetizer)

    synth = call_role(args.url, models[1], "SYNTHESIZER",
        "Produce one deterministic candidate object using only supported facts. The candidate must require "
        "human approval and must not self-publish or self-enable checkout. Return the exact CandidateGauntlet "
        "fields plus demand_evidence and evidence_grade.",
        {"proposal": proposer["json"], "critique": attacker["json"], "verification": verifier["json"], "monetizer": monetizer["json"]})
    transcript.append(synth)

    candidate = synth["json"]
    candidate["approval_required"] = True
    candidate["checkout_available"] = False
    candidate["status"] = "candidate"
    candidate["silo"] = args.silo
    candidate["refinement_run_id"] = run_id
    candidate["refinement_models"] = models

    candidate_path = os.path.join(out, "candidate.json")
    with open(candidate_path, "w", encoding="utf-8") as f:
        json.dump(candidate, f, indent=2, ensure_ascii=False)

    transcript_path = os.path.join(out, "transcript.json")
    with open(transcript_path, "w", encoding="utf-8") as f:
        json.dump(transcript, f, indent=2, ensure_ascii=False)

    gauntlet = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "gauntlet", "CandidateGauntlet.js"))
    proof_path = os.path.join(out, "GAUNTLET-PROOF.json")
    proc = subprocess.run(["node", gauntlet, candidate_path, proof_path], capture_output=True, text=True, timeout=120)
    if proc.returncode not in (0, 1):
        raise RuntimeError("CandidateGauntlet failed: %s" % proc.stderr[-2000:])

    result = {
        "schema_version": "BEC-REVENUE-OPERATOR-1.0",
        "run_id": run_id,
        "status": "READY_FOR_APPROVAL" if proc.returncode == 0 else "QUARANTINE",
        "candidate": candidate_path,
        "transcript": transcript_path,
        "gauntlet_proof": proof_path,
        "memory_path": memory_path,
        "public_execution": "BLOCKED_UNTIL_HUMAN_APPROVAL",
        "financial_execution": "BLOCKED_UNTIL_HUMAN_APPROVAL",
        "models": models,
        "completed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    result_path = os.path.join(out, "RESULT.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    append_memory(memory_path, {
        "type": "revenue_operator_run",
        "run_id": run_id,
        "signal_hash": sha(json.dumps(signal, sort_keys=True)),
        "candidate_hash": sha(json.dumps(candidate, sort_keys=True, ensure_ascii=False)),
        "status": result["status"],
        "evidence_grade": candidate.get("evidence_grade"),
    })

    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "READY_FOR_APPROVAL" else 1


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--signal", required=True)
    p.add_argument("--silo", default="dreamledger")
    p.add_argument("--url", default="http://localhost:1234/v1/chat/completions")
    p.add_argument("--models", default=",".join(DEFAULT_MODELS))
    p.add_argument("--out-dir", default="BEC-PRIME/data/revenue-operator")
    p.add_argument("--memory", default="BEC-PRIME/data/revenue-operator/MEMORY.jsonl")
    p.add_argument("--approved-catalog", default="BEC-PRIME/catalog/offers/approved.json")
    args = p.parse_args()
    try:
        return run(args)
    except Exception as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
