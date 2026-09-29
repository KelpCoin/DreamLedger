from pathlib import Path

p=Path("docs/UNIVERSAL-B2B-PAIN-CORPUS-004.md").read_text(encoding="utf-8")
rows=[x for x in p.splitlines() if x.startswith("| ") and x[1:4].strip().isdigit()]
assert len(rows)==100, len(rows)
required=["HYPOTHESIS","SANDBOXED","FULFILLABLE","OFFER_LIVE","DEMAND_OBSERVED","TRANSACTING","VERIFIED"]
for s in required: assert s in p
assert "VERIFIED_EXTERNAL_REVENUE = NZ$0.00" in p
print("UNIVERSAL_B2B_CORPUS_004=PASS")
print("PAIN_COUNT=100")
print("ECONOMIC_TRUTH=UNCHANGED")
