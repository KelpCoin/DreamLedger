"""Canonical output boundary for Branai Cortex Kingdom.

All text intended to leave a silo should pass through this boundary. The
boundary is deliberately non-authoritative: it returns text plus review
metadata and never performs an external action.
"""
from __future__ import annotations

from typing import Any

from .closed_loop import HumanizerLoop, HumanizerPolicy

def prepare_output(
    text: str,
    *,
    policy: HumanizerPolicy | None = None,
    output_kind: str = "TEXT",
) -> dict[str, Any]:
    result = HumanizerLoop(policy).run(text)
    return {
        "output_kind": output_kind,
        "humanizer": result.as_dict(),
        "text": result.output_text,
        "ready_for_gauntlet_review": True,
        "humanizer_authority": "NON_AUTHORITATIVE",
        "economic_truth_effect": "NONE",
        "external_action_effect": "NONE",
    }
