"""Truth-preserving Humanizer transformations.

Only transformations that cannot introduce a new factual, causal, authority,
or experiential claim are allowed here. Risky claims are flagged, never
re-authored.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

SAFE_RULES = (
    (re.compile(r"\s+—\s+"), ", "),
    (re.compile(r"[“”]"), '"'),
    (re.compile(r"[‘’]"), "'"),
    (re.compile(r"[ \t]+\n"), "\n"),
    (re.compile(r"\n{3,}"), "\n\n"),
    (re.compile(r"[ \t]{2,}"), " "),
)

@dataclass(frozen=True)
class Refinement:
    text: str
    changed: bool
    applied_rules: tuple[str, ...]

def refine(text: str) -> Refinement:
    current = text
    applied: list[str] = []

    for index, (rule, replacement) in enumerate(SAFE_RULES, 1):
        updated = rule.sub(replacement, current)
        if updated != current:
            applied.append(f"SAFE_{index}")
            current = updated

    current = current.strip()
    if current != text.strip():
        if "SAFE_TRIM" not in applied:
            applied.append("SAFE_TRIM")

    return Refinement(current, current != text, tuple(applied))
