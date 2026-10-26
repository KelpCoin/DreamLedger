#!/usr/bin/env python3
"""Tenant-isolated, provider-neutral Figure Eight refinement council.

This module never publishes, contacts buyers, spends money, or writes listings.
It returns review proposals and a hash-chained receipt for a caller-controlled gate.
Providers must be explicitly configured with BECK_COUNCIL_MODELS (JSON); each
entry uses {name, base_url, model, api_key_env}. OpenAI-compatible endpoints work.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

SCHEMA = "dreamledger/figure-eight-marketplace-council/v1"
MAX_INPUT_CHARS = 16000
MAX_OUTPUT_CHARS = 8000


class CouncilError(RuntimeError):
    pass


@dataclass(frozen=True)
class Provider:
    name: str
    base_url: str
    model: str
    api_key_env: str

    @property
    def identity(self) -> str:
        return self.name.strip().lower() + ":" + self.model.strip()


def load_providers(raw: str | None = None) -> list[Provider]:
    raw = os.environ.get("BECK_COUNCIL_MODELS", "") if raw is None else raw
    if not raw.strip():
        raise CouncilError("NO_COUNCIL_PROVIDERS_CONFIGURED")
    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise CouncilError("INVALID_COUNCIL_PROVIDER_JSON") from exc
    if not isinstance(rows, list):
        raise CouncilError("COUNCIL_PROVIDER_CONFIG_MUST_BE_LIST")
    providers = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name", "")).strip()
        base_url = str(row.get("base_url", "")).rstrip("/")
        model = str(row.get("model", "")).strip()
        key_env = str(row.get("api_key_env", "")).strip()
        if name and (base_url.startswith("https://") or base_url.startswith("http://127.0.0.1")):
            if model and key_env:
                providers.append(Provider(name, base_url, model, key_env))
    unique = {p.identity: p for p in providers}
    if len(unique) < 2:
        raise CouncilError("AT_LEAST_TWO_DISTINCT_MODELS_REQUIRED")
    return list(unique.values())


def canonical_hash(value: Any) -> str:
    data = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return hashlib.sha256(data).hexdigest()


def _request(provider: Provider, system: str, payload: dict[str, Any], timeout: int) -> str:
    key = os.environ.get(provider.api_key_env, "")
    if not key and not (provider.base_url.startswith("http://127.0.0.1") and provider.api_key_env == "NONE"):
        raise CouncilError("MISSING_PROVIDER_KEY:" + provider.name)
    body = {
        "model": provider.model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=True, separators=(",", ":"))},
        ],
    }
    req = urllib.request.Request(
        provider.base_url + "/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            result = json.loads(response.read(2_000_000).decode("utf-8"))
        content = result["choices"][0]["message"]["content"]
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as exc:
        raise CouncilError("PROVIDER_CALL_FAILED:" + provider.name) from exc
    if not isinstance(content, str) or not content.strip():
        raise CouncilError("EMPTY_PROVIDER_RESPONSE:" + provider.name)
    return content[:MAX_OUTPUT_CHARS]


def refine_candidate(
    candidate: dict[str, Any],
    *,
    tenant_id: str,
    silo_id: str,
    providers: list[Provider] | None = None,
    rounds: int = 2,
    timeout: int = 35,
) -> dict[str, Any]:
    """Refine one tenant-owned candidate using alternating model critique/refinement.

    No shared cross-tenant memory is loaded. Only this candidate and its explicit
    tenant/silo labels are sent to configured providers. Callers must obtain tenant
    membership authorization before invoking this function.
    """
    if not tenant_id.strip() or not silo_id.strip():
        raise CouncilError("TENANT_AND_SILO_REQUIRED")
    if not isinstance(candidate, dict) or not candidate:
        raise CouncilError("CANDIDATE_OBJECT_REQUIRED")
    if len(json.dumps(candidate, ensure_ascii=True)) > MAX_INPUT_CHARS:
        raise CouncilError("CANDIDATE_TOO_LARGE")
    if not 1 <= int(rounds) <= 4:
        raise CouncilError("ROUNDS_OUT_OF_RANGE")
    models = providers or load_providers()
    identities = {p.identity for p in models}
    if len(identities) < 2:
        raise CouncilError("AT_LEAST_TWO_DISTINCT_MODELS_REQUIRED")

    # The tenant boundary is explicit and included in every provider request.
    current = {"tenant_id": tenant_id, "silo_id": silo_id, "candidate": candidate}
    initial_hash = canonical_hash(current)
    previous_hash = initial_hash
    receipts = []
    for iteration in range(1, int(rounds) + 1):
        refiner = models[(iteration - 1) % len(models)]
        critic = models[iteration % len(models)]
        refined = _request(
            refiner,
            "You are the marketplace product refiner in BECK Figure Eight. Improve buyer clarity, "
            "deliverability, pricing logic, and evidence quality. Preserve facts and tenant/silo boundaries. "
            "Never invent demand, buyers, prices, credentials, or proof. Return concise JSON with candidate, "
            "assumptions, and unresolved_questions. This is a proposal, not authorization to publish.",
            {"schema": SCHEMA, "iteration": iteration, "input": current},
            timeout,
        )
        critique = _request(
            critic,
            "You are an independent adversarial reviewer. Identify unsupported claims, security and privacy "
            "risks, tenant leakage, missing delivery capability, unit-economics gaps, licensing risks, and "
            "ways the proposal could fail. Do not approve publication or claim revenue. Return concise JSON.",
            {"schema": SCHEMA, "iteration": iteration, "tenant_id": tenant_id, "silo_id": silo_id,
             "candidate_hash": canonical_hash(refined), "proposal": refined},
            timeout,
        )
        output = {"proposal": refined, "critique": critique}
        current = {"tenant_id": tenant_id, "silo_id": silo_id, "reviewed": output}
        output_hash = canonical_hash(current)
        receipt = {
            "iteration": iteration,
            "refiner": refiner.identity,
            "critic": critic.identity,
            "input_hash": previous_hash,
            "output_hash": output_hash,
            "created_at_epoch": int(time.time()),
        }
        receipts.append(receipt)
        previous_hash = output_hash

    return {
        "schema": SCHEMA,
        "status": "REVIEW_PROPOSAL_ONLY",
        "tenant_id": tenant_id,
        "silo_id": silo_id,
        "initial_hash": initial_hash,
        "final_hash": previous_hash,
        "rounds": len(receipts),
        "receipts": receipts,
        "result": current["reviewed"],
        "authorization": {"publish": False, "contact_buyer": False, "spend": False, "checkout": False},
        "revenue_claim": "NONE",
    }


if __name__ == "__main__":
    print(json.dumps({
        "schema": SCHEMA,
        "status": "READY" if os.environ.get("BECK_COUNCIL_MODELS") else "BLOCKED_CONFIGURATION",
        "minimum_distinct_models": 2,
        "provider_config_env": "BECK_COUNCIL_MODELS",
        "no_provider_configured": not bool(os.environ.get("BECK_COUNCIL_MODELS")),
    }, indent=2))
