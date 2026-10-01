"""Deterministic Humanizer analysis.

This module never decides whether a claim is true. It identifies stylistic
patterns and semantic-risk conditions for downstream review.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .patterns import PATTERNS

RULES = {
    "A01_NEGATIVE_PARALLELISM": re.compile(r"\bnot\s+[^.]{0,90}\bbut\b", re.I),
    "A02_CORRELATIVE_NOT_ONLY": re.compile(r"\bnot only\b[^.]{0,120}\bbut also\b", re.I),
    "A04_FALSE_RANGE": re.compile(r"\bfrom\s+[^.]{1,60}\bto\s+[^.]{1,60}\b", re.I),
    "A09_HEDGING_STACK": re.compile(r"\b(?:may|might|could|possibly|perhaps|arguably)\b(?:\s+\w+){0,5}\s+\b(?:appear|seem|suggest)\b", re.I),
    "B01_INFLATED_SIGNIFICANCE": re.compile(r"\b(?:pivotal|transformative|groundbreaking|revolutionary|landmark|historic|game-changing)\b", re.I),
    "B02_BORROWED_AUTHORITY": re.compile(r"\b(?:experts agree|industry reports suggest|studies show|research proves|it is widely known)\b", re.I),
    "B03_SALES_LANGUAGE": re.compile(r"\b(?:best-in-class|world-class|cutting-edge|seamless|powerful|unmatched|revolutionary)\b", re.I),
    "B04_VAGUE_CONNECTION": re.compile(r"\b(?:plays a key role|is important for|has implications for|is closely related to)\b", re.I),
    "C01_EM_DASH_OVERUSE": re.compile(r"—"),
    "C02_BOLD_DECORATION": re.compile(r"\*\*[^*]+\*\*"),
    "C04_CURLY_QUOTES": re.compile(r"[“”‘’]"),
    "D01_PLEASANTRY": re.compile(r"^(?:sure|absolutely|of course|certainly)[,! ]+", re.I),
    "D02_KNOWLEDGE_LIMIT_DISCLAIMER": re.compile(r"\b(?:as an ai|as a language model|i don't have access to|my knowledge cutoff)\b", re.I),
    "D03_STAGED_RUN_UP": re.compile(r"\b(?:let's dive in|here's the thing|first, let's|before we begin)\b", re.I),
    "E01_AI_LEXICON": re.compile(r"\b(?:delve|landscape|nuanced|robust|leverage|foster|underscore|multifaceted|paradigm)\b", re.I),
    "E02_APHORISM": re.compile(r"\b(?:at the end of the day|the bottom line is|in today's world|when all is said and done)\b", re.I),
    "E03_ARGUING_WITH_NO_ONE": re.compile(r"\b(?:it is not about|this isn't about|rather than merely|not simply)\b", re.I),
    "E07_UNSUPPORTED_CONFIDENCE": re.compile(r"\b(?:clearly|undeniably|certainly|without question|there is no doubt)\b", re.I),
    "E08_URGENCY_LANGUAGE": re.compile(r"\b(?:act now|don't miss|must-have|urgent|immediately|right away)\b", re.I),
    "E09_TEMPLATE_OPENING": re.compile(r"^(?:in this (?:article|guide|post|section)|whether you are|in the ever-changing)\b", re.I),
    "E10_TEMPLATE_CTA": re.compile(r"\b(?:learn more|get started today|take the next step|contact us today)\b", re.I),
    "E14_META_WRITING": re.compile(r"\b(?:in this response|as requested|i'll explain|let me break this down)\b", re.I),
    "E15_PROMPT_ECHO": re.compile(r"\b(?:your request|your prompt|the above|as you asked)\b", re.I),
}

SEMANTIC_RISK = {
    "B02_BORROWED_AUTHORITY",
    "B04_VAGUE_CONNECTION",
    "E07_UNSUPPORTED_CONFIDENCE",
}

@dataclass(frozen=True)
class Finding:
    pattern_id: str
    category: str
    severity: int
    semantic_risk: bool
    spans: tuple[tuple[int, int], ...]

@dataclass(frozen=True)
class Analysis:
    word_count: int
    density: float
    findings: tuple[Finding, ...]
    semantic_risk: bool
    status: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "word_count": self.word_count,
            "density": self.density,
            "semantic_risk": self.semantic_risk,
            "status": self.status,
            "findings": [
                {
                    "pattern_id": f.pattern_id,
                    "category": f.category,
                    "severity": f.severity,
                    "semantic_risk": f.semantic_risk,
                    "spans": list(f.spans),
                }
                for f in self.findings
            ],
        }

def analyze(text: str) -> Analysis:
    words = re.findall(r"\b\w+[\w'-]*\b", text, re.UNICODE)
    word_count = max(len(words), 1)
    findings: list[Finding] = []
    score = 0.0

    for pattern_id, (category, severity) in PATTERNS.items():
        rule = RULES.get(pattern_id)
        if rule is None:
            continue
        matches = tuple((m.start(), m.end()) for m in rule.finditer(text))
        if matches:
            findings.append(
                Finding(
                    pattern_id,
                    category,
                    severity,
                    pattern_id in SEMANTIC_RISK,
                    matches,
                )
            )
            score += severity * len(matches)

    density = (score / word_count) * 100.0
    semantic_risk = any(f.semantic_risk for f in findings)

    if semantic_risk:
        status = "REVIEW_REQUIRED"
    elif density < 0.5:
        status = "LOW_PATTERN_DENSITY"
    elif density < 1.5:
        status = "REVIEW_REQUIRED"
    else:
        status = "BLOCKED_BY_PATTERN_DENSITY"

    return Analysis(word_count, density, tuple(findings), semantic_risk, status)
