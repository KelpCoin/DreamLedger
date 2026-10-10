"""Privacy-first BECK access bridge for NZ healthcare and legal-aid navigation.

This module prepares next steps and communication drafts. It does not diagnose,
determine legal eligibility, persist personal information, or contact services.
Service details are manually curated and must be rechecked before use.
"""
from __future__ import annotations
from typing import Iterable

ROUTES = {
    "urgent_health": {"name": "Emergency medical help", "when": "Immediate danger or a medical emergency", "contact": "Call 111", "url": "https://www.govt.nz/browse/health/", "mode": "phone", "priority": 0},
    "healthline": {"name": "Healthline", "when": "You need clinical advice about what care to seek", "contact": "0800 611 116, free, 24/7", "url": "https://www.healthline.govt.nz/", "mode": "phone", "priority": 1},
    "health_advocacy": {"name": "Nationwide Health & Disability Advocacy Service", "when": "Access barriers, communication needs, or concerns about a health/disability service", "contact": "0800 555 050, Monday-Friday 8:30am-5pm; advocacy@advocacy.org.nz", "url": "https://advocacy.org.nz/contact-an-advocate-now/", "mode": "phone_or_email", "priority": 2},
    "legal_aid": {"name": "Ministry of Justice Legal Aid Services", "when": "Ask about legal aid, an existing application, delay, or a decision", "contact": "0800 253 425", "url": "https://www.justice.govt.nz/courts/going-to-court/legal-aid/contact-legal-aid/", "mode": "phone", "priority": 2},
    "community_law_bop": {"name": "Baywide Community Law (Tauranga/Whakatāne)", "when": "Free legal information/advice and help identifying the right legal-aid route", "contact": "Tauranga: (07) 571 6812; info@baywidecls.org.nz", "url": "https://communitylaw.org.nz/centre/tauranga-whakatane/", "mode": "phone_or_email", "priority": 2},
    "community_law_waikato": {"name": "Community Law Waikato", "when": "Free legal help in the Waikato region", "contact": "0800 529 482; reception@clwaikato.org.nz", "url": "https://communitylaw.org.nz/centre/waikato/", "mode": "phone_or_email", "priority": 2},
    "urgent_costs": {"name": "Work and Income urgent-cost support", "when": "Urgent food, eligible medical treatment/equipment, or health travel costs", "contact": "0800 559 009", "url": "https://www.workandincome.govt.nz/products/a-z-benefits/special-needs-grant/index.html", "mode": "phone", "priority": 1},
}
ALIASES = {
    "health": ["healthline", "health_advocacy"], "healthcare": ["healthline", "health_advocacy"],
    "medical": ["healthline", "health_advocacy"], "disability": ["health_advocacy"],
    "legal": ["legal_aid", "community_law_bop"], "legal_aid": ["legal_aid", "community_law_bop"],
    "food": ["urgent_costs"], "medical_costs": ["urgent_costs"], "urgent_costs": ["urgent_costs"],
}

def list_routes(categories: Iterable[str] | None = None, region: str = "Bay of Plenty") -> list[dict]:
    """Return service routes, prioritised and deduplicated, without user data."""
    supplied = list(categories or [])
    keys: list[str] = []
    local_law = "community_law_waikato" if "waikato" in region.lower() else "community_law_bop"
    for category in supplied:
        normalized = str(category).strip().lower().replace(" ", "_")
        if normalized in {"legal", "legal_aid"}:
            keys.extend(["legal_aid", local_law])
        else:
            keys.extend(ALIASES.get(normalized, []))
    if not supplied:
        keys = ["urgent_health", "healthline", "health_advocacy", "legal_aid", local_law, "urgent_costs"]
    unique = sorted(set(keys), key=lambda key: (ROUTES[key]["priority"], key))
    return [{"id": key, **ROUTES[key]} for key in unique if key in ROUTES]

def build_access_plan(categories: Iterable[str], barrier: str = "I have been unable to access the service and need help identifying the next step.", communication_needs: str = "Please offer a low-effort way to respond, such as email or a scheduled callback.", region: str = "Bay of Plenty") -> dict:
    """Prepare a bounded action plan and editable message draft; nothing is sent or stored."""
    selected = list_routes(categories, region)
    checklist = [
        "Choose one priority service and one backup route.",
        "Write down dates of previous contacts, responses, and any reference numbers.",
        "Ask what exact information or form is missing, who owns the next action, and when to expect a response.",
        "Ask for an accessible communication method and a support person or advocate if useful.",
        "Keep a private copy of messages and record the next follow-up date locally.",
        "If there is no response by the stated date, use the listed backup route.",
    ]
    draft = (
        "Subject: Request for accessible help to resolve an access barrier\n\n"
        "Hello,\n\nI need help accessing the appropriate service. The barrier I am facing is:\n"
        + barrier.strip() + "\n\n"
        "Please tell me the next concrete step, what information or documents you need, and the expected response time. "
        "If this is not the right team, please direct me to the correct service rather than closing the request without a route forward.\n\n"
        "Communication request: " + communication_needs.strip() + "\n\n"
        "Please confirm receipt and provide a reference number if one is available.\n\nThank you."
    )
    return {"mode": "DRAFT_ONLY", "personal_data_persisted": False, "external_actions_taken": False,
            "medical_or_legal_decision_made": False, "region": region, "routes": selected,
            "checklist": checklist, "message_draft": draft,
            "safety_note": "For immediate medical danger call 111. Healthline can advise on urgent clinical next steps. This tool does not replace a clinician or lawyer."}
