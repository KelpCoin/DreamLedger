#!/usr/bin/env python3
import hashlib, json, time, uuid

def create_candidate(objective, silo_id="SILO_GENERAL", actor="elohim"):
    art = {
        "schema": "browneye/elohim-artifact/v1",
        "artifact_id": "ART-" + uuid.uuid4().hex[:12],
        "job_id": None,
        "silo_id": silo_id,
        "creator": actor,
        "role": "CREATE",
        "objective": objective,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    art["input_hash"] = hashlib.sha256(objective.encode()).hexdigest()
    art["output_hash"] = hashlib.sha256(json.dumps(art, sort_keys=True).encode()).hexdigest()
    return art

if __name__ == "__main__":
    import sys
    print(json.dumps(create_candidate(sys.argv[1] if len(sys.argv) > 1 else "observe-only"), indent=2))
