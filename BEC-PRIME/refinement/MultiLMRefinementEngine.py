#!/usr/bin/env python3
"""
BEC PRIME - Multi-LM Refinement Engine

Purpose:
    Turn a raw commercial signal into a structured candidate offer by running
    multiple local OpenAI-compatible LMs through proposer, critic, monetizer,
    and synthesizer stages, then hard-gating the result through the deterministic
    Candidate Gauntlet.

Local-first:
    Default endpoint is LM Studio at http://localhost:1234/v1/chat/completions.
    Nothing is sent to a cloud model unless the operator explicitly supplies a
    non-local endpoint.

Outputs:
    data/refinement/RUN-<timestamp>/input.json
    data/refinement/RUN-<timestamp>/transcript.json
    data/refinement/RUN-<timestamp>/candidate.json
    data/refinement/RUN-<timestamp>/GAUNTLET-PROOF.json
    data/refinement/RUN-<timestamp>/RESULT.json

No public action is performed. A passing result is READY_FOR_APPROVAL only.
"""

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request


def now():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def post_chat(url, model, system, user, timeout=120):
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError("LM endpoint unavailable: %s" % exc)
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError("Unexpected LM response: %s" % json.dumps(data)[:2000])


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\\s*", "", text, flags=re.I)
        text = re.sub(r"\\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
    raise RuntimeError("Model did not return valid JSON: %s" % text[:1200])


def call_json(url, model, role, task, context):
    system = (
        "You are the %s in BEC PRIME. Work on commercial reality, not hype. "
        "Do not invent demand, buyers, payments, integrations, or evidence. "
        "Return JSON only. Keep the offer narrow enough to sell within 48 hours."
    ) % role
    user = task + "\n\nCURRENT CONTEXT:\n" + json.dumps(context, ensure_ascii=False, indent=2)
    raw = post_chat(url, model, system, user)
    return {"model": model, "role": role, "raw": raw, "json": extract_json(raw)}


def run(args):
    run_id = "RUN-" + now()
    out_dir = os.path.abspath(os.path.join(args.out_dir, run_id))
    os.makedirs(out_dir, exist_ok=True)

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    if not models:
        raise RuntimeError("No models supplied")
    while len(models) < 3:
        models.append(models[-1])

    signal = {
        "signal": args.signal,
        "silo": args.silo,
        "operator_constraint": "No public action without human approval. Optimize for cash in <=48h.",
    }
    with open(os.path.join(out_dir, "input.json"), "w", encoding="utf-8") as f:
        json.dump(signal, f, indent=2, ensure_ascii=False)

    transcript = []

    proposer = call_json(
        args.url, models[0], "PROPOSER",
        "Atomize the signal into the smallest painful buyer problem and propose exactly one paid offer. "
        "Return fields: offer_id, name, problem, target_buyer, deliverable, delivery_mechanism, "
        "price, currency, payment_adapter, checkout_route, approval_required, checkout_available, "
        "status, proof_of_delivery, verification_rules, provenance, silo, demand_evidence, "
        "why_buyer_pays_now, kill_condition.", signal)
    transcript.append(proposer)

    critic = call_json(
        args.url, models[1], "CRITIC",
        "Attack the proposed offer. Identify unsupported assumptions, weak urgency, fake differentiation, "
        "bad pricing, delivery risk, privacy/silo leakage, and anything that would prevent a real buyer "
        "from paying. Return: verdict, failures, required_fixes, revised_offer.", proposer["json"])
    transcript.append(critic)

    monetizer = call_json(
        args.url, models[2], "MONETIZER",
        "Convert the surviving concept into a cash-first offer. Prefer a concrete result over consulting. "
        "Specify price, delivery time, payment path, buyer trigger, proof artifact, and a single next action. "
        "Return: verdict, offer, buyer_trigger, payment_path, delivery_sla, proof_artifact, next_action, kill_condition.",
        {"proposal": proposer["json"], "critique": critic["json"]})
    transcript.append(monetizer)

    synth = call_json(
        args.url, models[0], "SYNTHESIZER",
        "Synthesize one canonical candidate from the proposal, critique, and monetizer. Do not add claims "
        "that are not evidenced. Return only the candidate offer object with the exact fields needed by "
        "the deterministic Candidate Gauntlet. Set approval_required=true and checkout_available=false.",
        {"proposal": proposer["json"], "critique": critic["json"], "monetizer": monetizer["json"]})
    transcript.append(synth)

    candidate = synth["json"]
    candidate.setdefault("approval_required", True)
    candidate.setdefault("checkout_available", False)
    candidate.setdefault("status", "candidate")
    candidate.setdefault("silo", args.silo)
    candidate["refinement_run_id"] = run_id
    candidate["refinement_models"] = models

    candidate_path = os.path.join(out_dir, "candidate.json")
    with open(candidate_path, "w", encoding="utf-8") as f:
        json.dump(candidate, f, indent=2, ensure_ascii=False)

    transcript_path = os.path.join(out_dir, "transcript.json")
    with open(transcript_path, "w", encoding="utf-8") as f:
        json.dump(transcript, f, indent=2, ensure_ascii=False)

    gauntlet_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "gauntlet", "CandidateGauntlet.js"))
    proof_path = os.path.join(out_dir, "GAUNTLET-PROOF.json")
    proc = subprocess.run(
        ["node", gauntlet_path, candidate_path, proof_path],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode not in (0, 1):
        raise RuntimeError("Candidate Gauntlet execution failed: %s" % proc.stderr[-2000:])

    result = {
        "schema_version": "BEC-MULTILM-REFINEMENT-1.0",
        "run_id": run_id,
        "status": "READY_FOR_APPROVAL" if proc.returncode == 0 else "QUARANTINE",
        "candidate_path": candidate_path,
        "transcript_path": transcript_path,
        "gauntlet_path": proof_path,
        "public_execution": "BLOCKED_UNTIL_HUMAN_APPROVAL",
        "models": models,
        "completed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    with open(os.path.join(out_dir, "RESULT.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "READY_FOR_APPROVAL" else 1


def main():
    p = argparse.ArgumentParser(description="BEC PRIME local multi-LM refinement -> deterministic gauntlet")
    p.add_argument("--signal", required=True)
    p.add_argument("--silo", default="mtg")
    p.add_argument("--url", default="http://localhost:1234/v1/chat/completions")
    p.add_argument("--models", default="qwen2.5-coder-14b-instruct,phi-3-mini-4k-instruct,qwen2.5-coder-14b-instruct")
    p.add_argument("--out-dir", default=os.path.join("BEC-PRIME", "data", "refinement"))
    args = p.parse_args()
    try:
        return run(args)
    except Exception as exc:
        print("ERROR: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
