"""Canonical event envelope for at-least-once delivery with idempotent effects."""
from dataclasses import dataclass
from datetime import datetime, timezone
import uuid

@dataclass(frozen=True)
class EventEnvelope:
    event_id: str
    event_type: str
    schema_version: str
    transition_id: str
    idempotency_key: str
    producer: str
    created_at: str
    payload: dict

    @classmethod
    def create(cls, event_type: str, transition_id: str, producer: str, payload: dict):
        eid=str(uuid.uuid4())
        return cls(eid,event_type,"1.0",transition_id,
                   f"dl-event-{transition_id}",producer,
                   datetime.now(timezone.utc).isoformat(),payload)
