#!/usr/bin/env python3
import hashlib, json, time

def verify(claim, evidence_refs=None):
    refs = evidence_refs or []
    out = {
        "schema": "browneye/truth-result/v1",
        "claim": claim,
        "status": "PROVEN" if refs else "UNPROVEN",
        "evidence_refs": refs,
        "verifier": "truth",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    out["output_hash"] = hashlib.sha256(json.dumps(out, sort_keys=True).encode()).hexdigest()
    return out

if __name__ == "__main__":
    import sys
    print(json.dumps(verify(sys.argv[1] if len(sys.argv) > 1 else "no claim"), indent=2))
