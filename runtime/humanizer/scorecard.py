"""Humanizer scorecard for Gauntlet.

The scorecard is a review signal, not an authority signal. It cannot veto
economic truth and cannot authorize an external action.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .review import Analysis

@dataclass(frozen=True)
class HumanizerScorecard:
    pattern_density: float
    pattern_count: int
    semantic_risk: bool
    truth_preservation: str
    calibration: str
    disposition: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "component": "HUMANIZER",
            "authority": "NON_AUTHORITATIVE",
            "pattern_density": self.pattern_density,
            "pattern_count": self.pattern_count,
            "semantic_risk": self.semantic_risk,
            "truth_preservation": self.truth_preservation,
            "calibration": self.calibration,
            "disposition": self.disposition,
        }

def build_scorecard(analysis: Analysis, *, transformed: bool) -> HumanizerScorecard:
    disposition = (
        "REVIEW_REQUIRED"
        if analysis.semantic_risk or analysis.status != "LOW_PATTERN_DENSITY"
        else "PASS_REVIEW_SIGNAL"
    )
    return HumanizerScorecard(
        pattern_density=analysis.density,
        pattern_count=len(analysis.findings),
        semantic_risk=analysis.semantic_risk,
        truth_preservation="PRESERVED_SAFE_TRANSFORMS_ONLY",
        calibration="UNCALIBRATED",
        disposition=disposition,
    )
