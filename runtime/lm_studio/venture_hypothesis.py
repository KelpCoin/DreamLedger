"""Deterministic H/E and weighted scale scoring for DreamLedger venture tests.

Scores are supplied by a human or evidence-backed process; this module does not
invent scores or promote hypotheses based on missing evidence.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

CORE_GATES = (
    "problem_intensity",
    "economic_buyer",
    "market_size",
    "willingness_to_pay_roi",
)
SCALE_WEIGHTS = {
    "must_have_resonance": 20,
    "gtm_unit_economics": 20,
    "defensibility": 15,
    "retention_expansion": 15,
    "timing_catalysts": 15,
    "capital_intensity_liquidity": 15,
}


def _score(value, path):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not 1 <= value <= 10:
        raise ValueError(f"{path} must be a number from 1 to 10")
    return float(value)


def evaluate(hypothesis: dict) -> dict:
    """Return a conservative decision. Scores alone are not evidence of demand."""
    if not isinstance(hypothesis, dict):
        raise ValueError("hypothesis must be an object")
    h = hypothesis.get("h_scores", {})
    e = hypothesis.get("e_scores", {})
    scale = hypothesis.get("scale_scores", {})
    missing_h = [k for k in CORE_GATES if k not in h]
    missing_e = [k for k in CORE_GATES if k not in e]
    missing_scale = [k for k in SCALE_WEIGHTS if k not in scale]
    if missing_h or missing_e or missing_scale:
        return {
            "id": hypothesis.get("id", "UNNAMED"),
            "decision": "HOLD_MISSING_SCORES",
            "missing": {"h_scores": missing_h, "e_scores": missing_e, "scale_scores": missing_scale},
            "weighted_scale_score": None,
            "evidence_state": "UNVERIFIED",
        }

    hs = {k: _score(h[k], f"h_scores.{k}") for k in CORE_GATES}
    es = {k: _score(e[k], f"e_scores.{k}") for k in CORE_GATES}
    ss = {k: _score(scale[k], f"scale_scores.{k}") for k in SCALE_WEIGHTS}
    weighted = round(sum(ss[k] / 10 * weight for k, weight in SCALE_WEIGHTS.items()), 2)
    h_pass = all(v >= 7 for v in hs.values())
    e_low = any(v <= 3 for v in es.values())
    e_high = any(v >= 7 for v in es.values())
    if not h_pass and e_high:
        decision = "PIVOT"
    elif not h_pass or weighted < 60:
        decision = "KILL"
    elif not e_high and (weighted < 75 or e_low):
        decision = "ITERATE"
    elif weighted < 75:
        decision = "ITERATE"
    else:
        decision = "PROCEED_TO_TEST_LAYER"

    # Even a high rubric score is not a validated venture without direct evidence.
    if decision == "PROCEED_TO_TEST_LAYER" and max(es.values()) < 7:
        decision = "ITERATE"
    return {
        "id": hypothesis.get("id", "UNNAMED"),
        "decision": decision,
        "core_h_pass": h_pass,
        "weighted_scale_score": weighted,
        "h_scores": hs,
        "e_scores": es,
        "evidence_state": hypothesis.get("evidence_state", "UNVERIFIED"),
        "evidence_refs": hypothesis.get("evidence_refs", []),
        "caveat": "A rubric decision is not a buyer, payment, or validated outcome.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="JSON array of hypothesis objects")
    args = parser.parse_args()
    payload = json.loads(args.file.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit("Input must be a JSON array")
    print(json.dumps([evaluate(item) for item in payload], indent=2))


if __name__ == "__main__":
    main()
