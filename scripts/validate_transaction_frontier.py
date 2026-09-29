#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
frontier = (root / "docs/TRANSACTION-FRONTIER.md").read_text(encoding="utf-8")
acceptance = (root / "docs/FORENSIC-FULFILLMENT-ACCEPTANCE.md").read_text(encoding="utf-8")

errors = []

required = [
    "Four transaction families",
    "First transaction candidate",
    "REAL_BUYER",
    "G1 Observed Opportunity",
    "G10 External Action",
    "CUBE owns the canonical state and economic truth boundary.",
    "Swarm workers may not:",
    "Truth Oracle verifies the external evidence boundary.",
    "QUOTE NORMALIZATION: CANDIDATE",
    "None is yet verified revenue.",
    "VERIFIED_EXTERNAL_REVENUE = NZ$0.00",
    "SETTLED_EXTERNAL_PAYMENTS = 0",
    "INDEPENDENT_EXTERNAL_BUYERS = 0",
    "VERIFIED_ECONOMIC_OUTCOMES = 0",
]

for item in required:
    if item not in frontier:
        errors.append(f"frontier missing: {item}")

for item in [
    "Preparation is not fulfillment.",
    "Capability does not imply access.",
    "Access does not imply authority.",
    "Authority does not imply execution.",
    "Execution does not imply fulfillment.",
    "Fulfillment does not imply a verified economic outcome.",
]:
    if item not in acceptance:
        errors.append(f"acceptance contract missing: {item}")

for forbidden in [
    "QUOTE NORMALIZATION: VERIFIED",
    "QUOTE NORMALIZATION: REVENUE",
    "MARKET EXISTS = REAL BUYER",
    "CI PASS = VERIFIED ECONOMIC OUTCOME",
]:
    if forbidden in frontier or forbidden in acceptance:
        errors.append(f"forbidden equivalence: {forbidden}")

if errors:
    print("TRANSACTION_FRONTIER=FAIL")
    for e in errors:
        print("ERROR:", e)
    sys.exit(1)

print("TRANSACTION_FRONTIER=PASS")
print("FAMILIES=4")
print("FIRST_CANDIDATE=QUOTE_NORMALIZATION")
print("ECONOMIC_TRUTH=UNCHANGED")
