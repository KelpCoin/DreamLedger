"""Privacy-first BECK access bridge for NZ healthcare and legal-aid navigation.

Prepares route choices, case packets, and editable drafts. It does not diagnose,
determine legal eligibility, persist personal information, or contact services.
Service details are manually curated and must be rechecked before use.
"""
from __future__ import annotations
from typing import Iterable

ROUTES = {
    "urgent_health": {"name": "Emergency medical help", "when": "Immediate danger or a medical emergency", "contact": "Call 111", "url": "https://www.govt.nz/browse/health/", "mode": "phone", "priority": 0},
    "healthline": {"name": "Healthline", "when": "You need clinical advice about what care to seek", "contact": "0800 611 116, free, 24/7", "url": "https://www.healthline.govt.nz/", "mode": "phone", "priority": 1},
    "health_advocacy": {"name": "Nationwide Health & Disability Advocacy Service", "when": "Access barriers, communication needs, or concerns about a health/disability service", "contact": "0800 555 050, Monday-Friday 8:30am-5pm; advocacy@advocacy.org.nz", "url": "https://advocacy.org.nz/contact-an-advocate-now/", "mode": "phone_or_email", "priority": 2},
    "legal_aid": {"name": "Ministry of Justice Legal Aid Services", "when": "Ask about legal aid, an existing application, delay, assigned lawyer, or a decision", "contact": "0800 253 425", "url": "https://www.justice.govt.nz/courts/going-to-court/legal-aid/contact-legal-aid/", "mode": "phone", "priority": 2},
    "community_law_bop": {"name": "Baywide Community Law (Tauranga/Whakatāne)", "when": "Free legal information/advice and help identifying the right legal-aid route", "contact": "0800 905 916; Tauranga: (07) 571 6812; tauranga@baywidecls.org.nz", "url": "https://communitylaw.org.nz/centre/tauranga-whakatane/", "mode": "phone_or_email", "priority": 2},
    "community_law_waikato": {"name": "Community Law Waikato", "when": "Free legal help in the Waikato region", "contact": "0800 529 482; reception@clwaikato.org.nz", "url": "https://communitylaw.org.nz/centre/waikato/", "mode": "phone_or_email", "priority": 2},
    "urgent_costs": {"name": "Work and Income urgent-cost support", "when": "Urgent food, eligible medical treatment/equipment, or health travel costs", "contact": "0800 559 009", "url": "https://www.workandincome.govt.nz/products/a-z-benefits/special-needs-grant/index.html", "mode": "phone", "priority": 1},
}
ALIASES = {
    "health": ["healthline", "health_advocacy"], "healthcare": ["healthline", "health_advocacy"],
    "medical": ["healthline", "health_advocacy"], "disability": ["health_advocacy"],
    "legal": ["legal_aid"], "legal_aid": ["legal_aid"],
    "food": ["urgent_costs"], "medical_costs": ["urgent_costs"], "urgent_costs": ["urgent_costs"],
}

# Evidence prompts are generic checklists, not assumptions that a record exists.
# Unknown barrier labels remain unknown and do not receive a guessed classification.
BARRIER_EVIDENCE = {
    "public_system_access": {
        "label": "Unable to access an appropriate public service",
        "evidence": ["Dates of referral or requests and the service contacted", "Any waitlist, triage, refusal, or redirection message", "The care or service requested and the practical impact of delay", "Any accessibility adjustment requested and the response"],
    },
    "private_care_cost": {
        "label": "Private care is unaffordable upfront",
        "evidence": ["Itemised written quote separating consultation, tests, treatment, and follow-up", "Ask provider whether a lower-cost first consultation or staged payment is possible", "Written response from Work and Income about any potentially eligible support before incurring costs", "Any clinician's referral or recommendation if available"],
    },
    "disability_access": {
        "label": "Disability-related access or accommodation barrier",
        "evidence": ["Specific practical accommodation requested, such as email-first contact or extra processing time", "Date and channel of request", "Provider response or record that no response was received", "Optional clinician or advocate support if already available"],
    },
    "communication": {
        "label": "Communication channel is inaccessible or burdensome",
        "evidence": ["Preferred accessible channel and any times phone contact is not feasible", "Dates and channels already tried", "Any missed-call, callback, or unanswered-message record"],
    },
    "referral": {
        "label": "Referral or handoff is unclear",
        "evidence": ["Referring service and referral date, if known", "Receiving service and any referral/reference number", "Current referral status and what the receiving service says is missing"],
    },
    "delay_or_no_response": {
        "label": "Delay or no response",
        "evidence": ["Dated contact attempts and channel used", "Any promised response date or published service timeframe", "Reference number and the latest status, if available"],
    },
    "missing_documents": {
        "label": "Requested documents or requirements are unclear",
        "evidence": ["Exact document or information requested, preferably in writing", "Who requested it and the due date, if any", "What has already been supplied and confirmation of receipt"],
    },
    "legal_aid_status": {
        "label": "Legal-aid application or existing file status is unclear",
        "evidence": ["Application/file reference, kept private", "Application date and any written status or decision", "Assigned lawyer and next court/deadline date, if applicable", "Exact missing evidence and the written review/escalation route"],
    },
}
BARRIER_ALIASES = {
    "public_system": "public_system_access", "public_healthcare": "public_system_access",
    "private_healthcare_cost": "private_care_cost", "private_care": "private_care_cost", "affordability": "private_care_cost",
    "disability": "disability_access", "accessibility": "disability_access",
    "communication_barrier": "communication", "inaccessible_contact": "communication",
    "referral_problem": "referral", "no_response": "delay_or_no_response", "delay": "delay_or_no_response",
    "documents": "missing_documents", "missing_evidence": "missing_documents", "legal_aid": "legal_aid_status",
}

def list_routes(categories: Iterable[str] | None = None, region: str = "Bay of Plenty") -> list[dict]:
    """Return service routes, prioritised and deduplicated, without user data."""
    supplied = list(categories or [])
    keys: list[str] = []
    local_law = "community_law_waikato" if any(x in region.lower() for x in ("waikato", "hamilton")) else "community_law_bop"
    for category in supplied:
        normalized = str(category).strip().lower().replace(" ", "_")
        if normalized in {"legal", "legal_aid", "criminal_legal_aid", "existing_legal_aid_file"}:
            keys.extend(["legal_aid", local_law])
        else:
            keys.extend(ALIASES.get(normalized, []))
    if not supplied:
        keys = ["urgent_health", "healthline", "health_advocacy", "legal_aid", local_law, "urgent_costs"]
    unique = sorted(set(keys), key=lambda key: (ROUTES[key]["priority"], key))
    return [{"id": key, **ROUTES[key]} for key in unique if key in ROUTES]

def list_healthcare_funding_options() -> list[dict]:
    """Return starting points for costs; never imply that private treatment will be funded."""
    return [
        {"id": "winz_disability_allowance", "name": "Work and Income Disability Allowance", "when": "Regular, ongoing eligible health or disability costs", "maximum_rate": "Up to NZ$82.85 per week as at 1 April 2026; the actual amount depends on eligible costs and circumstances and is not guaranteed", "proof_to_prepare": ["Clinician/medical certificate or form signed by a health practitioner as requested", "Receipts or quotes showing actual ongoing costs", "Evidence linking costs to disability or health needs"], "contact": "0800 559 009", "url": "https://www.workandincome.govt.nz/eligibility/health-and-disability/prescriptions-and-gp-costs", "limitation": "Eligibility and eligible expense rules apply; ask whether this specific provider and treatment qualify."},
        {"id": "winz_special_needs_grant", "name": "Work and Income Special Needs Grant", "when": "An immediate and essential or emergency cost with no other way to pay, including some medical treatment or equipment", "proof_to_prepare": ["Written quote or invoice", "Why the cost is urgent/essential", "Evidence of income and available cash assets if requested", "Provider details and proposed treatment"], "contact": "0800 559 009", "url": "https://www.workandincome.govt.nz/products/a-z-benefits/special-needs-grant/index.html", "limitation": "Not guaranteed and does not automatically cover any private clinic or elective treatment. Ask before incurring the cost."},
        {"id": "provider_payment_options", "name": "Ask the private provider about a staged plan", "when": "You have identified a private provider but cannot pay the full amount upfront", "proof_to_prepare": ["Itemised quote", "Deposit and staged-payment options", "Cancellation/refund terms", "Whether a shorter initial consultation can establish next steps"], "contact": "Contact the provider using its official contact channel", "url": "", "limitation": "Provider discretion; do not assume credit or a payment plan is available."},
        {"id": "acc_injury", "name": "ACC treatment pathway", "when": "The treatment need relates to an accident or personal injury that may be covered", "proof_to_prepare": ["Date and description of injury", "Treating provider details", "ACC claim number if one exists"], "contact": "Ask the treating provider whether an ACC claim is appropriate", "url": "https://www.acc.co.nz/", "limitation": "Coverage depends on ACC rules and claim acceptance; this is not a general funding route for illness."},
        {"id": "high_cost_treatment_pool", "name": "Health New Zealand High Cost Treatment Pool", "when": "Potentially qualifying treatment not otherwise available in the public system", "proof_to_prepare": ["Specialist's clinical recommendation", "Evidence the treatment is unavailable through the public system", "Clinical rationale and likely benefit"], "contact": "Ask the treating district-hospital specialist about eligibility and referral", "url": "https://www.healthnz.govt.nz/hospitals-services/eligibility-subsidies/high-cost-treatment-pool", "limitation": "Application is made by a district hospital specialist and strict criteria apply; this is not a general private-care subsidy."},
    ]

def resolve_barrier_evidence(barriers: Iterable[str] = ()) -> dict:
    """Resolve explicitly selected barrier tags to evidence prompts; do not infer from personal narrative."""
    resolved = []
    unknown = []
    for raw in barriers:
        key = str(raw or "").strip().lower().replace(" ", "_").replace("-", "_")
        key = BARRIER_ALIASES.get(key, key)
        if key in BARRIER_EVIDENCE:
            if key not in [item["id"] for item in resolved]:
                resolved.append({"id": key, **BARRIER_EVIDENCE[key]})
        elif key and key not in unknown:
            unknown.append(key)
    return {"barriers": resolved, "unclassified_barriers": unknown,
            "note": "Evidence prompts are suggestions only. Keep source records in a private location; provide only what the receiving service actually requests."}

def build_access_plan(categories: Iterable[str], barrier: str = "I have been unable to access the service and need help identifying the next step.", communication_needs: str = "Please offer a low-effort way to respond, such as email or a scheduled callback.", region: str = "Bay of Plenty") -> dict:
    """Prepare an editable action plan; nothing is sent or stored."""
    supplied = list(categories)
    selected = list_routes(supplied, region)
    checklist = [
        "Choose one priority service and one backup route.",
        "Write down dates of previous contacts, responses, and any reference numbers.",
        "Ask what exact information or form is missing, who owns the next action, and when to expect a response.",
        "Ask for an accessible communication method and a support person or advocate if useful.",
        "Keep a private copy of messages and record the next follow-up date locally.",
        "If there is no response by the stated date, use the listed backup route.",
    ]
    if any(str(c).lower() in {"legal", "legal_aid", "criminal_legal_aid", "existing_legal_aid_file"} for c in supplied):
        checklist.insert(2, "For an existing legal-aid matter, ask for the current file status, assigned lawyer, next court/deadline date, any missing documents, and the written review/escalation route.")
    health_related = any(str(c).lower().replace(" ", "_") in {"health", "healthcare", "medical", "disability", "medical_costs"} for c in supplied)
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
            "healthcare_funding_options": list_healthcare_funding_options() if health_related else [],
            "checklist": checklist, "message_draft": draft,
            "safety_note": "For immediate medical danger call 111. Healthline can advise on urgent clinical next steps. This tool does not replace a clinician or lawyer."}

def build_access_case_packet(issue_type: str, summary: str, desired_outcome: str, timeline: Iterable[str] = (), prior_attempts: Iterable[str] = (), deadline: str = "", region: str = "Bay of Plenty", barriers: Iterable[str] = ()) -> dict:
    """Structure only user-supplied facts into a private, unsaved case packet. No inferred facts or external actions."""
    issue = str(issue_type or "unknown").strip().lower().replace(" ", "_")
    steps = [str(x).strip() for x in prior_attempts if str(x).strip()]
    events = [str(x).strip() for x in timeline if str(x).strip()]
    barrier_map = resolve_barrier_evidence(barriers)
    gaps = []
    if not events: gaps.append("Add a dated chronology of key events, contacts, decisions, and deadlines if known.")
    if not steps: gaps.append("List previous attempts to obtain help and the response to each, including no response.")
    if not str(desired_outcome or "").strip(): gaps.append("State the specific practical outcome you are asking the service to provide.")
    if not str(deadline or "").strip(): gaps.append("Check whether a court, treatment, application, or review deadline exists; do not assume there is none.")
    if not barrier_map["barriers"]: gaps.append("Select explicit barrier tags or leave the blocker unclassified until evidence identifies it.")
    if barrier_map["unclassified_barriers"]: gaps.append("Review unclassified barrier tags; do not treat them as identified blockers.")
    categories = ["healthcare"] if issue in {"health", "healthcare", "medical", "disability"} else ["legal_aid"] if issue in {"legal", "legal_aid", "criminal_legal_aid", "existing_legal_aid_file"} else ["urgent_costs"] if issue in {"food", "medical_costs", "urgent_costs"} else []
    if not categories: gaps.append("Choose the service category; it remains unknown from the supplied issue type.")
    return {
        "mode": "DRAFT_ONLY", "personal_data_persisted": False, "external_actions_taken": False,
        "issue_type": issue, "summary": str(summary or "").strip(),
        "desired_outcome": str(desired_outcome or "").strip(),
        "timeline": events, "prior_attempts": steps, "deadline": str(deadline or "").strip() or "UNKNOWN",
        "barrier_evidence": barrier_map,
        "routes": list_routes(categories, region),
        "healthcare_funding_options": list_healthcare_funding_options() if issue in {"health", "healthcare", "medical", "disability", "medical_costs"} else [],
        "missing_information": gaps,
        "next_action": "Request written confirmation of the current status, the exact blocker, the person/team responsible, what evidence is needed, and the date for the next response.",
        "privacy_note": "This packet exists only in the current tool response. Copy it to a private location you control if you want to retain it; do not put personal health or legal details in public issues or repositories."
    }
