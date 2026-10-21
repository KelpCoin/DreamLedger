#!/usr/bin/env python3
"""Private, offline DreamLedger campaign admission; no public, DB or payment writes.

Use this alongside the existing commercial/event state machine. This is
a draft tool only. It is not an alternative payment ledger or an outreach bot.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

FREE_URL = "https://dreamledger.org/quote-comparison/"
STRIPE_HOST = "buy.stripe.com"
SCHEMA = "dreamledger.private_campaign_draft.v1"
REF_RE = re.compile(r"^[A-Za-z0-9_-]{1,200}$")
CHANNELS = {"OWNED", "REDDIT", "DISCORD", "X", "EMAIL"}
DENIED_ACTIONS = ["publish", "send_message", "create_payment", "modify_stripe",
                  "mutate_commercial_ledger", "provision_domain", "spend"]


def _canonical(obj: object) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True).encode("ascii")


def _https_public_url(raw: str) -> bool:
    if not isinstance(raw, str) or len(raw) > 2048:
        return False
    try:
        x = urlsplit(raw)
        return (x.scheme == "https" and bool(x.hostname)
                and x.hostname not in {"localhost", "127.0.0.1", "::1"}
                and not x.username and not x.password and not x.fragment)
    except ValueError:
        return False


def _date_utc(s: str):
    try:
        parsed = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc) if parsed.tzinfo is not None else None
    except (TypeError, ValueError, AttributeError):
        return None


def build_draft(signal: dict, now=None) -> dict:
    now = now or datetime.now(timezone.utc)
    if not isinstance(signal, dict):
        raise ValueError("SIGNAL_OBJECT_REQUIRED")
    channel = signal.get("channel")
    if channel not in CHANNELS:
        raise ValueError("INVALID_CHANNEL")
    lane = signal.get("silo_id")
    if lane not in {"commerce", "mtg"}:
        raise ValueError("CROSS_SILO_OR_UNRECOGNIZED_LANE")
    if signal.get("offer_id") != "FREE_QUOTE_WORKSHEET" or lane != "commerce":
        raise ValueError("PAID_OR_UNDELIVERABLE_OFFER_HOLD")
    if signal.get("source_permission") not in {"OWNER_ORIGINAL", "AUTHORIZED_PUBLIC_REFERENCE"}:
        raise ValueError("SOURCE_RIGHTS_UNPROVEN")
    if not _https_public_url(signal.get("source_url")):
        raise ValueError("INVALID_SOURCE_URL")
    observed = _date_utc(signal.get("observed_at_utc"))
    if observed is None or abs((now - observed).total_seconds()) > 86400 * 14:
        raise ValueError("STALE_OR_INVALID_SIGNAL")
    if not isinstance(signal.get("audience"), str) or signal["audience"] not in {
        "small_business", "procurement", "mtg_traders"
    }:
        raise ValueError("UNRECOGNIZED_AUDIENCE")
    ref = "dl_" + hashlib.sha256(_canonical(signal)).hexdigest()[:24]
    # Deliberately do not ask an LLM to infer what a buyer is purchasing.
    # Free worksheet only; no unverifiable claims, paid CTA, or guaranteed results.
    content = (
        "Comparing supplier quotes? DreamLedger has a free browser worksheet "
        "for entering prices, delivery costs, lead times, minimum quantities "
        "and payment terms side by side. Unknown values stay visible. "
        "No account or file upload is required. It is not a paid audit, "
        "supplier verification, or automatic PDF analysis service. "
        + FREE_URL
    )
    payload = {
        "schema": SCHEMA,
        "campaign_id": ref,
        "channel": channel,
        "silo_id": lane,
        "offer_id": signal["offer_id"],
        "source_reference": signal["source_url"],
        "source_observed_at_utc": signal["observed_at_utc"],
        "source_truth": "USER_SUPPLIED_NOT_INDEPENDENTLY_VALIDATED",
        "status": "DRAFT",
        "publication": "HUMAN_APPROVAL_REQUIRED",
        "commercial_gate": "NO_PAID_OFFER_AUTHORIZED",
        "content": content,
        "content_sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "destination": FREE_URL,
        "client_reference_id": ref,
        "external_actions": [],
        "denied_actions": DENIED_ACTIONS,
        "buyer_contacts": 0,
        "economic_outcomes_verified": 0,
    }
    return payload


def make_attributed_link(existing_link: str, ref: str) -> str:
    """Prepare a candidate URL only; never publish, activate or call Stripe."""
    if not REF_RE.fullmatch(ref):
        raise ValueError("INVALID_CLIENT_REFERENCE")
    if not isinstance(existing_link, str):
        raise ValueError("INVALID_STRIPE_LINK")
    p = urlsplit(existing_link)
    if p.scheme != "https" or p.hostname != STRIPE_HOST or p.username or p.password:
        raise ValueError("NON_STRIPE_LINK")
    params = parse_qsl(p.query, keep_blank_values=True)
    if any(k == "client_reference_id" for k, _ in params):
        raise ValueError("DUPLICATE_ATTRIBUTION_PARAMETER")
    return urlunsplit((p.scheme, p.netloc, p.path,
                       urlencode([*params, ("client_reference_id", ref)]), ""))


def observe_verified_checkout(packet: dict, event: dict, *, signature_verified=False) -> dict:
    """Observation only. Upstream signature check must be real, not model-assigned.

    Does not certify buyer independence, payout, product delivery or revenue.
    """
    if not signature_verified:
        raise ValueError("UNTRUSTED_WEBHOOK")
    if event.get("type") != "checkout.session.completed":
        return {"status": "NO_COMPLETED_CHECKOUT_EVENT", "verified_revenue": False}
    data = event.get("data", {}).get("object", {})
    if data.get("client_reference_id") != packet.get("client_reference_id"):
        return {"status": "UNMATCHED_CAMPAIGN", "verified_revenue": False}
    if data.get("payment_status") != "paid" or not data.get("id", "").startswith("cs_"):
        return {"status": "UNPAID_OR_UNPROVEN_SESSION", "verified_revenue": False}
    return {
        "status": "ATTRIBUTED_CHECKOUT_OBSERVATION_ONLY",
        "checkout_session_id": data["id"],
        "campaign_id": packet["campaign_id"],
        "verified_revenue": False,
        "required_next": "INDEPENDENT_BUYER_SETTLEMENT_FULFILLMENT_DELIVERY_EVIDENCE",
    }


def save_packet(packet: dict, destination) -> str:
    path = pathlib.Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(packet, sort_keys=True, indent=2, ensure_ascii=True).encode("ascii") + b"\n"
    digest = hashlib.sha256(raw).hexdigest()
    if path.exists() and path.read_bytes() != raw:
        raise FileExistsError("EXISTING_PACKET_MISMATCH")
    if not path.exists():
        with path.open("xb") as stream:
            stream.write(raw)
    sidecar = path.with_suffix(path.suffix + ".sha256")
    if sidecar.exists() and sidecar.read_text(encoding="ascii").strip() != digest:
        raise ValueError("EXISTING_HASH_MISMATCH")
    if not sidecar.exists():
        sidecar.write_text(digest + "\n", encoding="ascii")
    return digest


def verify_packet(destination) -> bool:
    path = pathlib.Path(destination)
    sha_path = path.with_suffix(path.suffix + ".sha256")
    obj = json.loads(path.read_text(encoding="ascii"))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return (sha_path.read_text(encoding="ascii").strip() == digest
            and obj.get("schema") == SCHEMA and obj.get("status") == "DRAFT"
            and obj.get("external_actions") == [])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="Owner-authorized signal JSON file")
    p.add_argument("--output", required=True, help="Private draft proof JSON")
    p.add_argument("--verify", action="store_true")
    p.add_argument("--local-model", action="store_true", help="Opt-in localhost LM Studio only")
    p.add_argument("--lmstudio-base", default="", help="Discovered localhost LM Studio base URL")
    p.add_argument("--model-id", default="", help="Actual model id from /v1/models")
    a = p.parse_args()
    if a.verify:
        print(json.dumps({"verified": verify_packet(a.output)}))
        return
    src = pathlib.Path(a.input)
    if src.stat().st_size > 65536:
        raise ValueError("INPUT_TOO_LARGE")
    signal = json.loads(src.read_text(encoding="utf-8"))
    packet = build_draft(signal)
    if a.local_model:
        from lmstudio_copy_adapter import draft_from_local_model
        endpoint = a.lmstudio_base or os.environ.get("LM_STUDIO_BASE_URL", "")
        if not endpoint:
            raise ValueError("LOCAL_ENDPOINT_DISCOVERY_REQUIRED")
        content, model_id = draft_from_local_model(signal, endpoint, a.model_id)
        packet["content"] = content
        packet["content_sha256"] = hashlib.sha256(content.encode("utf-8")).hexdigest()
        packet["model_observation"] = {"provider": "LM_STUDIO_LOOPBACK", "model_id": model_id}
        # A real local inference does not authorize publication or payment.
    digest = save_packet(packet, a.output)
    print(json.dumps({"status": packet["status"], "sha256": digest, "path": a.output}))


if __name__ == "__main__":
    main()
