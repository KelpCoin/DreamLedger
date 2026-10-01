"""Permanent Elohim -> Humanizer -> Gauntlet closed loop.

The callbacks are injected so this module does not create a second Elohim or
Gauntlet implementation. Humanizer is mandatory for the loop, but remains
non-authoritative.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .closed_loop import HumanizerLoop, HumanizerPolicy
from .gauntlet_adapter import humanizer_gauntlet_check

@dataclass(frozen=True)
class KingdomLoopResult:
    draft: str
    humanized: str
    humanizer: dict[str, Any]
    gauntlet: Any
    external_action_allowed: bool = False

def run_kingdom_loop(
    *,
    elohim_draft: Callable[[], str],
    gauntlet_review: Callable[[str, dict[str, Any]], Any],
    policy: HumanizerPolicy | None = None,
) -> KingdomLoopResult:
    """Run one output through the permanent closed review loop.

    Elohim creates content.
    Humanizer analyzes and safely refines it.
    Gauntlet receives both output and Humanizer scorecard.
    No callback in this module is an external-action authority.
    """
    draft = elohim_draft()
    if not isinstance(draft, str):
        raise TypeError("Elohim draft must be text")

    loop = HumanizerLoop(policy)
    humanized = loop.run(draft)
    scorecard = humanizer_gauntlet_check(humanized.output_text, policy=policy)
    gauntlet = gauntlet_review(humanized.output_text, scorecard)

    return KingdomLoopResult(
        draft=draft,
        humanized=humanized.output_text,
        humanizer=humanized.as_dict(),
        gauntlet=gauntlet,
    )
