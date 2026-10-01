"""Gauntlet adapter for the permanent Humanizer scorecard.

This adapter adds a scorecard dimension without changing Gauntlet authority.
A Humanizer finding is never converted into an economic verdict.
"""
from __future__ import annotations

from typing import Any

from .closed_loop import HumanizerLoop, HumanizerPolicy

def humanizer_gauntlet_check(text: str, *, policy: HumanizerPolicy | None = None) -> dict[str, Any]:
    result = HumanizerLoop(policy).run(text)
    return {
        "check": "HUMANIZER",
        "authority": "NON_AUTHORITATIVE",
        "economic_truth_effect": "NONE",
        "external_action_effect": "NONE",
        "review_required": result.review_required,
        "scorecard": result.scorecard.as_dict(),
        "output_text": result.output_text,
    }
