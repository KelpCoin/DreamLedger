"""Permanent, non-authoritative Humanizer layer for Branai Cortex Kingdom.

The Humanizer reviews and safely refines text. It never establishes truth,
economic state, authority, authorization, payment, fulfillment, or proof.
"""
from .closed_loop import HumanizerLoop, HumanizerPolicy, humanize_output
from .scorecard import HumanizerScorecard, HumanizerResult

__all__ = [
    "HumanizerLoop",
    "HumanizerPolicy",
    "HumanizerScorecard",
    "HumanizerResult",
    "humanize_output",
]
