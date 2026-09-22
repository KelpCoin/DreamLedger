"""Deterministic default-deny authorization boundary. No LLM in the decision path."""
from pathlib import Path
import os
import yaml

POLICY_PATH = Path(os.getenv("AUTH_POLICY_PATH", "ops/policy/actions.yaml"))

class AuthorizationFirewall:
    def __init__(self, policy_path=POLICY_PATH):
        with open(policy_path, encoding="utf-8") as f:
            self.policy = yaml.safe_load(f)

    def authorize(self, request: dict) -> dict:
        action = request["action"]
        principal = request["principal"]
        scope = set(request.get("scope", []))
        spend = request.get("spend", 0)
        unit = request.get("unit")
        rule = self.policy["actions"].get(action)
        if not rule:
            return {"verdict": "DENY", "reason": "unknown_action"}
        if principal not in rule.get("allowed_principals", []):
            return {"verdict": "DENY", "reason": "principal_not_permitted"}
        required = set(rule.get("required_scope", []))
        if not required.issubset(scope):
            return {"verdict": "DENY", "reason": "missing_scope"}
        limit = rule.get("spend_limit")
        if limit is not None and spend > limit:
            return {"verdict": "DENY", "reason": "spend_exceeds_limit"}
        if rule.get("requires_unit") and not unit:
            return {"verdict": "DENY", "reason": "unit_not_declared"}
        if rule.get("authority_lane") == "AMBER":
            return {"verdict": "REQUIRE_APPROVAL", "reason": "amber_authority"}
        return {"verdict": "ALLOW", "constraints": rule.get("constraints", {})}
