from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlparse

class Gate(str, Enum):
    PASS="PASS"; BLOCKED="BLOCKED"; UNKNOWN="UNKNOWN"; EXPIRED="EXPIRED"; NOT_APPLICABLE="NOT_APPLICABLE"

@dataclass(frozen=True)
class SourcePolicy:
    source_url: str
    terms_url: str | None = None
    api_url: str | None = None
    robots_checked: bool = False
    terms_reviewed: bool = False
    permitted_automated_access: bool | None = None
    personal_data_expected: bool = False
    sensitive_data_expected: bool = False
    licensed_access: bool = False
    jurisdiction: str | None = None

    def gate(self) -> str:
        if self.sensitive_data_expected and not self.licensed_access:
            return Gate.BLOCKED
        if self.permitted_automated_access is False:
            return Gate.BLOCKED
        if not self.robots_checked or not self.terms_reviewed:
            return Gate.UNKNOWN
        if self.permitted_automated_access is None and not self.licensed_access:
            return Gate.UNKNOWN
        return Gate.PASS

def validate_public_url(url: str) -> None:
    parsed=urlparse(url)
    if parsed.scheme not in {"http","https"} or not parsed.netloc:
        raise ValueError("source_url_must_be_http_or_https")
