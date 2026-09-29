#!/usr/bin/env python3
import pathlib,re
p=pathlib.Path("docs/PORTFOLIO-ENGINE-UNIVERSAL-PAIN-ATLAS.md").read_text()
nums=re.findall(r"^(d+)\. ",p,re.M)
assert len(nums)==100 and nums==[str(i) for i in range(1,101)]
for x in ["Portfolio rule","Universal-product test","Batch experiment","Economic truth","Automation boundary"]:
    assert x in p
assert "VERIFIED_EXTERNAL_REVENUE = NZ$0.00" in p
print("PORTFOLIO_ENGINE_VALIDATION=PASS")
print("PAIN_VECTORS=100")
print("ECONOMIC_TRUTH=UNCHANGED_UNTIL_SETTLED_EXTERNAL_PAYMENT_AND_VERIFIED_FULFILLMENT")
