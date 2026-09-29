#!/usr/bin/env python3
"""Deterministic repository-level acceptance checks for fulfillment integrity."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "FORENSIC-FULFILLMENT-ACCEPTANCE.md"
FACTORY = ROOT / "docs" / "TRANSACTION-PRIMITIVE-FACTORY.md"
README = ROOT / "README.md"

errors = []

def require(text, needle, label):
    if needle not in text:
        errors.append(f"missing {label}: {needle}")

doc = DOC.read_text(encoding="utf-8")
factory = FACTORY.read_text(encoding="utf-8")
readme = README.read_text(encoding="utf-8")

for gate in range(1, 11):
    require(doc, f"G{gate} ", f"fulfillment gate G{gate}")

for phrase in [
    "Capability does not imply access.",
    "Access does not imply authority.",
    "Authority does not imply execution.",
    "Execution does not imply fulfillment.",
    "Fulfillment does not imply a verified economic outcome.",
    "UNKNOWN is not PASS.",
    "Internal evidence cannot self-certify an external result.",
    "The prepared packet, internal routing, actuator code, or generated research must never be counted as an external submission or customer result.",
]:
    require(doc, phrase, f"operator law: {phrase}")

require(doc, "INTERNAL WORK", "external truth boundary")
require(doc, "EXTERNAL RESULT", "external result boundary")
require(doc, "VERIFIED ECONOMIC OUTCOME", "verification boundary")
require(doc, "PARTIALLY_FULFILLABLE", "partial fulfillment classification")
require(doc, "G6 Representation / Authority: BLOCKED", "ACNC authority classification")
require(doc, "G10 External Action: BLOCKED", "ACNC external action classification")

for scoreboard in [
    "VERIFIED_EXTERNAL_REVENUE = NZ$0.00",
    "SETTLED_EXTERNAL_PAYMENTS = 0",
    "INDEPENDENT_EXTERNAL_BUYERS = 0",
    "VERIFIED_ECONOMIC_OUTCOMES = 0",
]:
    require(factory + "\n" + doc + "\n" + readme, scoreboard, f"canonical scoreboard value {scoreboard}")

for forbidden in [
    "INTERNAL_ROUTED = VERIFIED",
    "DISPATCHED = FULFILLED",
    "GENERATED = FULFILLED",
    "CI PASS = VERIFIED ECONOMIC OUTCOME",
]:
    if forbidden in doc or forbidden in factory or forbidden in readme:
        errors.append(f"forbidden equivalence present: {forbidden}")

if errors:
    print("FULFILLMENT_ACCEPTANCE=FAIL")
    for error in errors:
        print("ERROR:", error)
    sys.exit(1)

print("FULFILLMENT_ACCEPTANCE=PASS")
print("GATES=10")
print("ACNC=PARTIALLY_FULFILLABLE")
print("ECONOMIC_TRUTH=UNCHANGED")
