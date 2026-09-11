#!/usr/bin/env python3
import json, time, hashlib

def write_proof(path, name, status, detail):
    doc = {
        "schema": "browneye/proof/v1",
        "name": name,
        "status": status,
        "detail": detail,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    doc["hash"] = hashlib.sha256(json.dumps(doc, sort_keys=True).encode()).hexdigest()
    with open(path, "w") as f:
        json.dump(doc, f, indent=2)
    return doc
