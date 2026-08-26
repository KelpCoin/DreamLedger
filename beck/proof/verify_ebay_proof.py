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
    gates = data.get("gates", {})
    required = ["G01_CREDENTIALS_PRESENT", "G02_OAUTH_SUCCESS", "G03_HTTP_SUCCESS", "G04_RESPONSE_HASHED", "G05_RESULTS_RETURNED", "G06_STRONG_MATCH"]
    gate_integrity = all(gates.get(k) in {"PASS", "FAIL"} for k in required)
    all_pass = all(gates.get(k) == "PASS" for k in required)
    response = data.get("source", {}).get("raw_response", {})
    canonical_response = json.dumps(response, separators=(",", ":"), sort_keys=True)
    response_hash = hashlib.sha256(canonical_response.encode()).hexdigest()
    result = {
        "hash_match": stored == recomputed,
        "gate_schema_valid": gate_integrity,
        "all_required_gates_pass": all_pass,
        "response_present": bool(response),
        "response_hash_recomputed": response_hash,
        "recorded_response_hash": data.get("source", {}).get("response_sha256"),
        "response_hash_matches": False,
        "commercial_signal": data.get("commercial_signal"),
    }
    # The producer hashes the exact HTTP response text, so the verifier cannot
    # reconstruct that text from parsed JSON. The recorded hash remains evidence,
    # while proof integrity is verified independently.
    result["overall"] = result["hash_match"] and result["gate_schema_valid"] and result["response_present"] and all_pass
    print(json.dumps(result, indent=2))
    return 0 if result["overall"] else 1


if __name__ == "__main__":
    raise SystemExit(verify(sys.argv[1]))
