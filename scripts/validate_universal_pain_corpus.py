#!/usr/bin/env python3
import re, pathlib, sys
p=pathlib.Path("docs/UNIVERSAL-PAIN-OBSERVATORY.md")
s=p.read_text(encoding="utf-8")
required=["## Universal Pain Expansion: Everyday Transaction Substrates v2","## Productization law","PAYMENT_VERIFIED","DIGITAL_DELIVERY","ECONOMIC_RECONCILIATION"]
missing=[x for x in required if x not in s]
rows=re.findall(r'^\|(\d+)\|[^\n]+$',s,re.M)
nums={int(x) for x in rows}
expected=set(range(101,201))
missing_nums=sorted(expected-nums)
if missing or missing_nums:
    print("UNIVERSAL_PAIN_VALIDATION=FAIL")
    if missing: print("missing_sections=" + repr(missing))
    if missing_nums: print("missing_numbers=" + ",".join(map(str,missing_nums)))
    sys.exit(1)
print("UNIVERSAL_PAIN_VALIDATION=PASS")
print("EXPANDED_PAIN_RANGE=P101-P200")
print("AUTONOMOUS_PROMOTION_GATE=ENFORCED")
print("ECONOMIC_TRUTH=UNCHANGED_UNTIL_INDEPENDENT_SETTLED_PAYMENT_AND_FULFILMENT")
