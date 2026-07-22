import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
#!/usr/bin/env python3
import os, json, hashlib, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
file = os.path.join(root, "ledger", "chain.jsonl")
if not os.path.exists(file):
    print("LEDGER NOT FOUND")
    sys.exit(0)
previous = "genesis"
count = 0
def canonical_json(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))
for line in open(file):
    event = json.loads(line)
    if event.get("previous_hash") != previous:
        print(f"CHAIN BROKEN at event {count}")
        sys.exit(1)
    recalc = hashlib.sha256(canonical_json({k: v for k, v in event.items() if k != "event_hash"}).encode()).hexdigest()
    if recalc != event.get("event_hash"):
        print(f"HASH MISMATCH at event {count}")
        sys.exit(1)
    previous = event["event_hash"]
    count += 1
print(f"LEDGER VERIFIED  {count} events")
