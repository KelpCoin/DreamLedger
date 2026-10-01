import hashlib
import json
import sys
from pathlib import Path


def verify(path: str):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    stored = data.get("proof_sha256")
    unsigned = dict(data)
    unsigned.pop("proof_sha256", None)
    recomputed = hashlib.sha256(json.dumps(unsigned, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    source = data.get("source", {})
    response = source.get("raw_response", {})
    response_hash = hashlib.sha256(json.dumps(response, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    response_hash_matches = response_hash == source.get("response_sha256")

    candidates = data.get("candidates", [])
    strong_recomputed = any(float(c.get("total_score", 0)) >= 0.8 and c.get("verdict") == "STRONG" for c in candidates)
    ids = {item.get("itemId") for item in response.get("itemSummaries", []) if item.get("itemId")}
    candidate_ids = {c.get("item_id") for c in candidates if c.get("item_id")}
    candidates_derive_from_response = candidate_ids.issubset(ids)

    gates = data.get("gates", {})
    required = ["G01_CREDENTIALS_PRESENT", "G02_OAUTH_SUCCESS", "G03_HTTP_SUCCESS", "G04_RESPONSE_HASHED", "G05_RESULTS_RETURNED", "G06_STRONG_MATCH"]
    gate_schema_valid = all(gates.get(k) in {"PASS", "FAIL"} for k in required)
    external_gate_recompute = {
        "G03_HTTP_SUCCESS": source.get("http_status") == 200,
        "G04_RESPONSE_HASHED": bool(source.get("response_sha256")) and response_hash_matches,
        "G05_RESULTS_RETURNED": len(candidates) > 0,
        "G06_STRONG_MATCH": strong_recomputed and candidates_derive_from_response,
    }
    externally_consistent = all(external_gate_recompute.values())

    result = {
        "hash_match": stored == recomputed,
        "gate_schema_valid": gate_schema_valid,
        "response_hash_matches": response_hash_matches,
        "candidates_derive_from_response": candidates_derive_from_response,
        "strong_match_recomputed": strong_recomputed,
        "external_gate_recompute": external_gate_recompute,
        "commercial_signal": data.get("commercial_signal"),
    }
    result["overall"] = result["hash_match"] and result["gate_schema_valid"] and externally_consistent
    print(json.dumps(result, indent=2))
    return 0 if result["overall"] else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python beck/proof/verify_ebay_proof.py <proof.json>")
        raise SystemExit(2)
    raise SystemExit(verify(sys.argv[1]))
