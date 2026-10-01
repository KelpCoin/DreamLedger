"""Closed Humanizer loop for Branai Cortex Kingdom.

Flow:
ELOHIM_DRAFT -> HUMANIZER_ANALYZE -> SAFE_REFINEMENT -> HUMANIZER_RECHECK
-> GAUNTLET_SCORECARD -> OUTPUT

The loop is permanently available to every output-producing caller. It is
non-authoritative: it cannot authorize dispatch, payment, fulfillment,
verification, or any economic state transition.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .review import Analysis, analyze
from .scorecard import HumanizerScorecard, build_scorecard
from .transform import Refinement, refine

@dataclass(frozen=True)
class HumanizerPolicy:
    enabled: bool = True
    max_passes: int = 2
    safe_refinement: bool = True
    production_gate: bool = False
    calibration: str = "UNCALIBRATED"

@dataclass(frozen=True)
class HumanizerResult:
    original_text: str
    output_text: str
    first_analysis: Analysis
    final_analysis: Analysis
    refinement: Refinement
    scorecard: HumanizerScorecard
    passes: int

    @property
    def authoritative(self) -> bool:
        return False

    @property
    def review_required(self) -> bool:
        return self.scorecard.disposition == "REVIEW_REQUIRED"

    def as_dict(self) -> dict[str, Any]:
        return {
            "component": "HUMANIZER",
            "authority": "NON_AUTHORITATIVE",
            "production_gate": False,
            "original_text": self.original_text,
            "output_text": self.output_text,
            "first_analysis": self.first_analysis.as_dict(),
            "final_analysis": self.final_analysis.as_dict(),
            "refinement": {
                "changed": self.refinement.changed,
                "applied_rules": list(self.refinement.applied_rules),
            },
            "scorecard": self.scorecard.as_dict(),
            "passes": self.passes,
        }

class HumanizerLoop:
    def __init__(self, policy: HumanizerPolicy | None = None):
        self.policy = policy or HumanizerPolicy()

    def run(self, text: str, *, post_review: Callable[[str], str] | None = None) -> HumanizerResult:
        if not isinstance(text, str):
            raise TypeError("Humanizer input must be text")

        first = analyze(text)
        current = text
        last_refinement = Refinement(text, False, ())
        passes = 1

        if self.policy.enabled and self.policy.safe_refinement:
            last_refinement = refine(current)
            current = last_refinement.text

            while passes < max(1, self.policy.max_passes):
                after = analyze(current)
                if after.semantic_risk or not last_refinement.changed:
                    break
                next_refinement = refine(current)
                passes += 1
                if not next_refinement.changed:
                    break
                current = next_refinement.text
                last_refinement = next_refinement

        final = analyze(current)
        if post_review is not None:
            reviewed = post_review(current)
            if not isinstance(reviewed, str):
                raise TypeError("post_review must return text")
            current = reviewed
            final = analyze(current)

        scorecard = build_scorecard(final, transformed=last_refinement.changed)
        return HumanizerResult(
            original_text=text,
            output_text=current,
            first_analysis=first,
            final_analysis=final,
            refinement=last_refinement,
            scorecard=scorecard,
            passes=passes,
        )

def humanize_output(text: str, *, policy: HumanizerPolicy | None = None) -> dict[str, Any]:
    """Canonical boundary call for any output-producing silo."""
    return HumanizerLoop(policy).run(text).as_dict()
