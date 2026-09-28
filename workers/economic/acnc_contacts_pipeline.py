#!/usr/bin/env python3
"""
ACNC bulk-contact fulfillment adapter.

This extends the existing economic fulfillment worker without creating a new
orchestration layer. It uses the public ACNC register/data.gov.au sources and
optional Hunter/Apollo API credentials when those connections exist.

No contact value is fabricated. Missing providers or ambiguous matches remain
explicitly classified.
"""

import csv
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ACNC_RESOURCE_ID = os.environ.get(
    "ACNC_REGISTER_RESOURCE_ID",
    "8fb32972-24e9-4c95-885e-7140be51be8a",
)
ACNC_DATASTORE = "https://data.gov.au/data/api/action/datastore_search"
ACNC_REGISTER_ROOT = "https://www.acnc.gov.au/charity/charities"
HUNTER_KEY = os.environ.get("HUNTER_API_KEY", "").strip()
APOLLO_KEY = os.environ.get("APOLLO_API_KEY", "").strip()
APOLLO_REVEAL_PHONE = os.environ.get("ACNC_APOLLO_REVEAL_PHONE", "0").strip().lower() in ("1", "true", "yes")
APOLLO_POLL_LIMIT = int(os.environ.get("ACNC_APOLLO_POLL_LIMIT", "8"))
HTTP_TIMEOUT = int(os.environ.get("ACNC_HTTP_TIMEOUT", "60"))
PAGE_SIZE = min(int(os.environ.get("ACNC_PAGE_SIZE", "1000")), 5000)
REQUEST_DELAY = float(os.environ.get("ACNC_REQUEST_DELAY", "0.15"))

STATE_ALIASES = ("State", "State_Territory", "Charity_State", "state")
ABN_ALIASES = ("ABN", "Charity_ABN", "abn")
LEGAL_ALIASES = ("Charity_Legal_Name", "Legal_Name", "Charity_Name", "name")
SUBTYPE_ALIASES = ("Charity_Subtype", "Subtype", "Current_Subtype")
TOWN_ALIASES = ("Town_City", "Town", "Suburb", "Town_Suburb", "Address_Town")
PHONE_ALIASES = ("Phone", "Telephone", "Charity_Phone")
EMAIL_ALIASES = ("Email", "Charity_Email", "Email_For_Service")
UUID_ALIASES = (
    "ACNC_Entity_ID",
    "ACNC_Entity_Id",
    "ACNC_Entity_UUID",
    "ACNC_UUID",
    "Entity_ID",
    "acnc_entity_id",
)
WEBSITE_ALIASES = ("Website", "Charity_Website", "Web_Address", "Website_URL")


def _request(url, method="GET", body=None, headers=None):
    h = {"User-Agent": "BrownEye-ACNC-Fulfillment/1.0", "Accept": "*/*"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, headers=h, method=method)
    with urlopen(req, timeout=HTTP_TIMEOUT) as response:
        return response.status, response.headers.get("content-type", ""), response.read()


def _first(row, aliases, default=""):
    for key in aliases:
        value = row.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return default


def _sha256(data):
    return hashlib.sha256(data).hexdigest()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _norm(value):
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())


def _split_name(name):
    parts = [p for p in str(name or "").strip().split() if p]
    if len(parts) < 2:
        return (parts[0] if parts else "", "")
    return parts[0], " ".join(parts[1:])


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__(); self.hrefs=[]
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href", "")
            if href: self.hrefs.append(href)

class TableCollector(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=[]; self.in_cell=False
    def handle_starttag(self, tag, attrs):
        if tag == "tr": self.row=[]
        elif tag in ("td","th"): self.in_cell=True; self.cell=[]
    def handle_data(self, data):
        if self.in_cell: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ("td","th") and self.in_cell:
            self.row.append(" ".join(" ".join(self.cell).split())); self.in_cell=False
        elif tag == "tr" and self.row:
            self.rows.append(self.row)

class TextCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        value = " ".join(data.split())
        if value:
            self.parts.append(value)


def _public_text(html):
    parser = TextCollector()
    parser.feed(html.decode("utf-8", "replace"))
    return " ".join(parser.parts)


def parse_responsible_people(html):
    """
    ACNC currently exposes public Responsible People as name + position only.
    Parse only that public material. Never infer private contact details.
    """
    text = _public_text(html)
    people = []
    # The public page renders entries in the form: Name Role: Position Associated charities.
    pattern = re.compile(
        r"(?P<name>[A-Za-zÀ-ÖØ-öø-ÿ0-9'().&-]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ0-9'().&-]+){1,8})\s+"
        r"Role:\s*(?P<role>[^\n]+?)\s+Associated charities",
        re.I,
    )
    seen = set()
    for match in pattern.finditer(text):
        name = " ".join(match.group("name").split()).strip(" -")
        role = " ".join(match.group("role").split()).strip(" -")
        if not name or not role:
            continue
        key = (_norm(name), role.lower())
        if key in seen:
            continue
        seen.add(key)
        people.append({"name": name, "role": role})
    return people


def derive_subtypes(raw):
    mapping = {
        "PBI": "Public Benevolent Institution",
        "HPC": "Health Promotion Charity",
        "Preventing_or_relieving_suffering_of_animals": "Preventing or relieving the suffering of animals",
        "Advancing_Culture": "Advancing culture",
        "Advancing_Education": "Advancing education",
        "Advancing_Health": "Advancing health",
        "Promote_or_oppose_a_change_to_law__government_poll_or_prac": "Advancing public debate",
        "Advancing_natual_environment": "Advancing the natural environment",
        "Promoting_or_protecting_human_rights": "Promoting or protecting human rights",
        "Purposes_beneficial_to_ther_general_public_and_other_analogous": "Purposes beneficial to the general public and other analogous",
        "Promoting_reconciliation__mutual_respect_and_tolerance": "Promoting reconciliation, mutual respect and tolerance",
        "Advancing_Religion": "Advancing religion",
        "Advancing_social_or_public_welfare": "Advancing social or public welfare",
        "Advancing_security_or_safety_of_Australia_or_Australian_public": "Advancing security or safety of Australia or the Australian public",
    }
    found=[]
    for key,label in mapping.items():
        value=str(raw.get(key,"")).strip().lower()
        if value in ("yes","y","true","1"):
            found.append(label)
    return found

def resolve_charity_uuid(abn):
    url = "https://www.acnc.gov.au/charity/charities?search=" + quote(str(abn).strip())
    status, ctype, body = _request(url)
    parser=LinkCollector(); parser.feed(body.decode("utf-8","replace"))
    candidates=[]
    for href in parser.hrefs:
        match=re.search(r"/charity/charities/([0-9a-f-]{36})/(?:profile|people|history)",href,re.I)
        if match:
            candidates.append(match.group(1))
    unique=list(dict.fromkeys(candidates))
    return {
        "url":url,"http_status":status,"content_type":ctype,"sha256":_sha256(body),
        "retrieved_at":_now(),"entity_uuid":unique[0] if len(unique)==1 else "",
        "match_status":"UNIQUE_UUID" if len(unique)==1 else ("NO_UUID" if not unique else "AMBIGUOUS_UUID")
    }

def parse_profile_contacts(html):
    text=_public_text(html)
    def one(pattern):
        match=re.search(pattern,text,re.I)
        return match.group(1).strip(" ,.;") if match else ""
    email=one(r"\bEmail:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})")
    service_email=one(r"\bAddress For Service email:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})")
    website=one(r"\bWebsite:\s*([^\s]+)")
    phone=one(r"\bPhone:\s*([0-9][0-9 ()+.-]{5,})")
    return {"charity_email":email,"address_for_service_email":service_email,"charity_website_public":website,"charity_phone":phone}

def fetch_register_profile(entity_uuid):
    url=ACNC_REGISTER_ROOT+"/"+quote(str(entity_uuid).strip(),safe="")+"/profile"
    status,ctype,body=_request(url)
    return {"url":url,"http_status":status,"content_type":ctype,"sha256":_sha256(body),
            "retrieved_at":_now(),"contacts":parse_profile_contacts(body) if status==200 else {}}

def _acnc_page(abn_or_uuid):
    return ACNC_REGISTER_ROOT + "/" + quote(str(abn_or_uuid).strip(), safe="") + "/people"


def fetch_register_people(entity_uuid):
    url = _acnc_page(entity_uuid)
    status, ctype, body = _request(url)
    return {
        "url": url,
        "http_status": status,
        "content_type": ctype,
        "sha256": _sha256(body),
        "retrieved_at": _now(),
        "people": parse_responsible_people(body) if status == 200 else [],
    }


def fetch_acnc_rows(states=None, limit=None):
    """
    Pull the official ACNC datastore in pages. Filtering is local so the
    adapter remains resilient to datastore field-name changes.
    """
    wanted = {str(s).strip().upper() for s in (states or []) if str(s).strip()}
    rows = []
    offset = 0
    while True:
        params = {
            "resource_id": ACNC_RESOURCE_ID,
            "limit": PAGE_SIZE,
            "offset": offset,
        }
        status, ctype, body = _request(ACNC_DATASTORE + "?" + urlencode(params))
        if status != 200:
            raise RuntimeError("ACNC_DATASTORE_HTTP_" + str(status))
        payload = json.loads(body.decode("utf-8-sig"))
        result = (payload or {}).get("result") or {}
        page = result.get("records") or []
        if not page:
            break
        for raw in page:
            state = _first(raw, STATE_ALIASES)
            if wanted and state.upper() not in wanted:
                continue
            row = {
                "charity_legal_name": _first(raw, LEGAL_ALIASES),
                "abn": _first(raw, ABN_ALIASES),
                "town_suburb": _first(raw, TOWN_ALIASES),
                "state": state,
                "charity_subtype": _first(raw, SUBTYPE_ALIASES),
                "charity_phone": _first(raw, PHONE_ALIASES),
                "charity_email": _first(raw, EMAIL_ALIASES),
                "website": _first(raw, WEBSITE_ALIASES),
                "acnc_entity_id": _first(raw, UUID_ALIASES),
                "_source_url": ACNC_DATASTORE,
                "_source_sha256": _sha256(body),
                "_retrieved_at": _now(),
                "_source_status": "VERIFIED_SOURCE_RETRIEVAL",
            }
            row["_raw"] = raw
            rows.append(row)
            if limit and len(rows) >= limit:
                return rows
        offset += len(page)
        total = result.get("total")
        if total is not None and offset >= int(total):
            break
        if len(page) < PAGE_SIZE:
            break
        time.sleep(REQUEST_DELAY)
    return rows


def _hunter_email(person, domain):
    if not HUNTER_KEY or not domain:
        return None
    first, last = _split_name(person["name"])
    if not first or not last:
        return None
    query = urlencode({
        "domain": domain,
        "first_name": first,
        "last_name": last,
        "api_key": HUNTER_KEY,
    })
    status, _, body = _request("https://api.hunter.io/v2/email-finder?" + query)
    if status != 200:
        return {"provider": "hunter", "status": "ERROR_" + str(status)}
    data = (json.loads(body.decode()) or {}).get("data") or {}
    return {
        "provider": "hunter",
        "status": "FOUND" if data.get("email") else "NOT_FOUND",
        "email": data.get("email") or "",
        "score": data.get("score"),
        "verification_status": ((data.get("verification") or {}).get("status") or ""),
        "source_type": data.get("source_type") or "",
    }


def _find_phone(value):
    if isinstance(value, dict):
        for key in ("phone_number","sanitized_phone","mobile_phone_number","direct_dial","phone"):
            if value.get(key):
                return str(value[key])
        for key in ("phone_numbers","phones"):
            if isinstance(value.get(key),list):
                for item in value[key]:
                    found=_find_phone(item)
                    if found: return found
        for item in value.values():
            found=_find_phone(item)
            if found: return found
    elif isinstance(value,list):
        for item in value:
            found=_find_phone(item)
            if found: return found
    return ""

def _apollo_person(person, domain):
    if not APOLLO_KEY or not domain:
        return None
    params={
        "name":person["name"],"domain":domain,
        "reveal_personal_emails":"false",
        "reveal_phone_number":"true" if APOLLO_REVEAL_PHONE else "false",
        "poll_only":"true" if APOLLO_REVEAL_PHONE else "false",
    }
    status, _, body = _request(
        "https://api.apollo.io/api/v1/people/match?" + urlencode(params),
        method="POST", body={},
        headers={"x-api-key":APOLLO_KEY,"Cache-Control":"no-cache","Content-Type":"application/json","accept":"application/json"},
    )
    if status != 200:
        return {"provider":"apollo","status":"ERROR_"+str(status)}
    payload=json.loads(body.decode()) or {}
    data=payload.get("person") or {}
    phone=_find_phone(data)
    request_id=payload.get("request_id")
    if APOLLO_REVEAL_PHONE and request_id and not phone:
        poll_url="https://api.apollo.io/api/v1/webhook_result/"+quote(str(request_id),safe="")
        for _ in range(max(1,APOLLO_POLL_LIMIT)):
            pstatus,_,pbody=_request(poll_url,headers={"x-api-key":APOLLO_KEY,"Cache-Control":"no-cache","Content-Type":"application/json","accept":"application/json"})
            if pstatus==200:
                result=json.loads(pbody.decode()) or {}
                phone=_find_phone(result)
                break
            if pstatus==404:
                try:
                    retry=max(1,int((json.loads(pbody.decode()) or {}).get("retry_after_seconds",3)))
                except Exception:
                    retry=3
                time.sleep(min(retry,30))
                continue
            break
    return {"provider":"apollo","status":"FOUND" if data else "NOT_FOUND",
            "email":data.get("email") or "","phone":phone,
            "title":data.get("title") or "","linkedin_url":data.get("linkedin_url") or "",
            "email_status":data.get("email_status") or "","request_id":request_id,
            "phone_reveal_requested":APOLLO_REVEAL_PHONE}


def enrich_person(person, domain):
    evidence = []
    hunter = _hunter_email(person, domain)
    apollo = _apollo_person(person, domain)
    if hunter:
        evidence.append(hunter)
    if apollo:
        evidence.append(apollo)

    email = ""
    phone = ""
    title = person.get("role") or ""
    status = "NO_CONTACT_FOUND"
    if hunter and hunter.get("email"):
        email = hunter["email"]
        status = "EMAIL_FOUND"
    if apollo:
        email = email or apollo.get("email", "")
        phone = apollo.get("phone", "")
        title = title or apollo.get("title", "")
        if phone:
            status = "EMAIL_AND_PHONE_FOUND" if email else "PHONE_FOUND"
        elif email:
            status = "EMAIL_FOUND"

    if not HUNTER_KEY and not APOLLO_KEY:
        status = "ENRICHMENT_PROVIDER_NOT_CONFIGURED"

    return {
        "decision_maker_name": person.get("name", ""),
        "decision_maker_title": title,
        "decision_maker_phone": phone,
        "decision_maker_email": email,
        "contact_status": status,
        "enrichment_evidence": evidence,
    }


def run_acnc_contacts(payload):
    states = payload.get("states") or ["WA"]
    limit = payload.get("limit")
    rows = fetch_acnc_rows(states=states, limit=int(limit) if limit else None)
    output = []
    evidence = []
    for index, row in enumerate(rows, start=1):
        entity_id = row.get("acnc_entity_id")
        uuid_evidence = resolve_charity_uuid(row.get("abn","")) if row.get("abn") else None
        if uuid_evidence and uuid_evidence.get("entity_uuid"):
            entity_id = uuid_evidence["entity_uuid"]
            row["acnc_entity_id"] = entity_id
            evidence.append({"type":"acnc_register_search","url":uuid_evidence["url"],
                             "http_status":uuid_evidence["http_status"],"sha256":uuid_evidence["sha256"],
                             "retrieved_at":uuid_evidence["retrieved_at"]})
        profile_evidence=None
        if entity_id:
            profile_evidence=fetch_register_profile(entity_id)
            row.update(profile_evidence.get("contacts") or {})
            evidence.append({"type":"acnc_register_profile","url":profile_evidence["url"],
                             "http_status":profile_evidence["http_status"],"sha256":profile_evidence["sha256"],
                             "retrieved_at":profile_evidence["retrieved_at"]})
        people = []
        people_evidence = None
        if entity_id:
            people_evidence = fetch_register_people(entity_id)
            people = people_evidence.get("people") or []
            evidence.append({"type":"acnc_register_people","url":people_evidence["url"],
                             "http_status":people_evidence["http_status"],"sha256":people_evidence["sha256"],
                             "retrieved_at":people_evidence["retrieved_at"]})
        row["charity_email"] = row.get("charity_email") or ""
        row["charity_phone"] = row.get("charity_phone") or ""
        row["website"] = row.get("website") or row.get("charity_website_public") or ""
        row["charity_subtype"] = "; ".join(derive_subtypes(row.get("_raw") or {}))
        time.sleep(REQUEST_DELAY)

        domain = ""
        website = row.get("website") or ""
        if website:
            domain = re.sub(r"^https?://", "", website, flags=re.I).split("/")[0].lower()

        if people:
            for person in people:
                enriched = enrich_person(person, domain)
                item = {k: v for k, v in row.items() if k != "_raw"}
                item.update(enriched)
                item["responsible_people_count"] = len(people)
                output.append(item)
        else:
            item = {k: v for k, v in row.items() if k != "_raw"}
            item.update({
                "decision_maker_name": "",
                "decision_maker_title": "",
                "decision_maker_phone": "",
                "decision_maker_email": "",
                "contact_status": (
                    "NO_RESPONSIBLE_PEOPLE_PARSED"
                    if entity_id else "ACNC_ENTITY_ID_UNAVAILABLE"
                ),
                "responsible_people_count": 0,
                "enrichment_evidence": [],
            })
            output.append(item)

        if index % 100 == 0:
            time.sleep(REQUEST_DELAY)

    provider_state = {
        "hunter_configured": bool(HUNTER_KEY),
        "apollo_configured": bool(APOLLO_KEY),
        "automated_email_enrichment_available": bool(HUNTER_KEY or APOLLO_KEY),
        "apollo_phone_reveal_enabled": APOLLO_REVEAL_PHONE,
        "automated_contact_enrichment_available": bool(HUNTER_KEY or (APOLLO_KEY and APOLLO_REVEAL_PHONE)),
    }
    if not provider_state["automated_contact_enrichment_available"]:
        raise RuntimeError("ACNC_ENRICHMENT_PROVIDER_REQUIRED")
    return {
        "job_type": "ACNC_CHARITY_CONTACTS",
        "states": states,
        "row_count": len(output),
        "rows": output,
        "evidence": evidence,
        "provider_state": provider_state,
        "fulfillment_status": (
            "READY_FOR_AUTOMATED_ENRICHMENT"
            if provider_state["automated_contact_enrichment_available"]
            else "BASELINE_READY_ENRICHMENT_PROVIDER_REQUIRED"
        ),
        "truth_boundary": (
            "Generated data is fulfillment evidence only. It is not revenue or buyer evidence."
        ),
    }
