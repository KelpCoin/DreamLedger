"""
Work Packet schema and state machine.

A Work Packet is the only object that can cross from the game world
into the real-world work queue. It starts life as a game discovery
and can never auto-execute real economic actions.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import json
import uuid


class WorkPacketState(str, Enum):
    REAL_CANDIDATE = "REAL_CANDIDATE"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    APPROVED_REAL_ACTION = "APPROVED_REAL_ACTION"
    REAL_EXECUTION = "REAL_EXECUTION"
    REAL_VERIFIED = "REAL_VERIFIED"
    REJECTED = "REJECTED"


# Legal transitions only
ALLOWED_TRANSITIONS = {
    WorkPacketState.REAL_CANDIDATE: {WorkPacketState.HUMAN_REVIEW, WorkPacketState.REJECTED},
    WorkPacketState.HUMAN_REVIEW: {WorkPacketState.APPROVED_REAL_ACTION, WorkPacketState.REJECTED},
    WorkPacketState.APPROVED_REAL_ACTION: {WorkPacketState.REAL_EXECUTION, WorkPacketState.REJECTED},
    WorkPacketState.REAL_EXECUTION: {WorkPacketState.REAL_VERIFIED, WorkPacketState.REJECTED},
    WorkPacketState.REAL_VERIFIED: set(),
    WorkPacketState.REJECTED: set(),
}


@dataclass
class WorkPacket:
    id: str
    created_at: str
    source_game_event_id: Optional[str]
    source_opportunity_id: Optional[str]
    hypothesis: str
    evidence_required: List[str]
    potential_counterparties: List[str]
    expected_economics: Dict[str, Any]
    verification_criteria: List[str]
    state: WorkPacketState = WorkPacketState.REAL_CANDIDATE
    human_notes: List[str] = field(default_factory=list)
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    real_outcome_evidence_id: Optional[str] = None  # BrownEye evidence only after REAL_VERIFIED
    game_consequence: Optional[Dict[str, Any]] = None

    def transition(self, new_state: WorkPacketState, actor: str, note: str = "") -> bool:
        if new_state not in ALLOWED_TRANSITIONS.get(self.state, set()):
            return False
        self.state = new_state
        if note:
            self.human_notes.append(f"[{actor}] {note}")
        if new_state == WorkPacketState.APPROVED_REAL_ACTION:
            self.approved_by = actor
            self.approved_at = datetime.now(timezone.utc).isoformat()
        return True

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["state"] = self.state.value
        return d

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


def create_candidate_from_game(
    hypothesis: str,
    evidence_required: List[str],
    potential_counterparties: List[str],
    expected_economics: Dict[str, Any],
    verification_criteria: List[str],
    source_game_event_id: Optional[str] = None,
    source_opportunity_id: Optional[str] = None,
) -> WorkPacket:
    """Only entry point from the game world. Always starts as REAL_CANDIDATE."""
    return WorkPacket(
        id=f"wp_{uuid.uuid4().hex[:12]}",
        created_at=datetime.now(timezone.utc).isoformat(),
        source_game_event_id=source_game_event_id,
        source_opportunity_id=source_opportunity_id,
        hypothesis=hypothesis,
        evidence_required=evidence_required,
        potential_counterparties=potential_counterparties,
        expected_economics=expected_economics,
        verification_criteria=verification_criteria,
        state=WorkPacketState.REAL_CANDIDATE,
    )
