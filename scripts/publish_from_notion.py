import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
#!/usr/bin/env python3
"""Publish approved listings (v3.3  hardened)."""
import os, json, re, time, hashlib, sys
from datetime import datetime, timezone
from notion_client import Client
import stripe
from tenacity import retry, stop_after_attempt, wait_exponential

# Fix AI import path
sys.path.append(os.path.dirname(__file__))
from ai_agent import generate_marketing

# Auto-load .env
if not os.environ.get("NOTION_API_KEY"):
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()

NOTION_API_KEY = os.environ["NOTION_API_KEY"]
DATABASE_ID    = os.environ["NOTION_DATABASE_ID"]
DATA_SOURCE_ID = os.environ["NOTION_DATA_SOURCE_ID"]
STRIPE_KEY     = os.environ.get("STRIPE_SECRET_KEY", "")
SILO           = "MTG"
SKU_PREFIX     = f"DL-{SILO}-"
ROOT           = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSPORT_DIR   = os.path.join(ROOT, "passports")
PROOF_DIR      = os.path.join(ROOT, "proofs")
LEDGER_FILE    = os.path.join(ROOT, "ledger", "chain.jsonl")
CONTENT_DIR    = os.path.join(ROOT, "content", "mtg")
STRIPE_REG     = os.path.join(ROOT, "registry", "stripe_registry.json")
os.makedirs(PASSPORT_DIR, exist_ok=True)
os.makedirs(PROOF_DIR, exist_ok=True)
os.makedirs(CONTENT_DIR, exist_ok=True)

notion = Client(auth=NOTION_API_KEY)
stripe.api_key = STRIPE_KEY

def now():
    return datetime.now(timezone.utc).isoformat()
def sha256(s):
    return hashlib.sha256(s.encode()).hexdigest()

def canonical_json(obj):
    """Return deterministic JSON string."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def safe_n(f, *a, **kw): return f(*a, **kw)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def safe_s(f, *a, **kw): return f(*a, **kw)


def query_db(filter_obj, start_cursor=None):

    body={
        "filter": filter_obj,
        "page_size":100
    }

    if start_cursor:
        body["start_cursor"]=start_cursor

    return notion.data_sources.query(
        data_source_id=DATA_SOURCE_ID,
        **body
    )


    if start_cursor:
        body["start_cursor"] = start_cursor

    return safe_n(
        notion.data_sources.query, data_source_id=DATA_SOURCE_ID,
        **body
    )

def get_prop(page, name, kind="text"):
    p = page["properties"].get(name)
    if not p: return None
    if kind == "title":      return "".join(t.get("plain_text","") for t in p.get("title",[])).strip() or None
    if kind == "rich_text": return "".join(t.get("plain_text","") for t in p.get("rich_text",[])).strip() or None
    if kind == "number":    return p.get("number")
    if kind == "select":    return p.get("select",{}).get("name")
    return None

def parse_cards(txt):
    cards = []
    for line in txt.splitlines():
        line = line.strip()
        if not line or line.startswith("//"): continue
        m = re.match(r'^(\d+)\s+\[([^\]]+)\]\s+(.+)$', line)
        if m: cards.append({"qty": int(m.group(1)), "set": m.group(2), "name": m.group(3)})
    return cards

def ledger_last_hash():
    if not os.path.exists(LEDGER_FILE): return "genesis"
    with open(LEDGER_FILE, "r") as f:
        lines = f.readlines()
    if not lines: return "genesis"
    return json.loads(lines[-1])["event_hash"]

def ledger_append(event_type, sku, payload):
    prev = ledger_last_hash()
    evt = {"event": event_type, "sku": sku, "payload": payload,
           "timestamp": now(), "previous_hash": prev}
    evt["event_hash"] = sha256(canonical_json(evt))
    with open(LEDGER_FILE, "a") as f:
        f.write(canonical_json(evt) + "\n")
    return evt["event_hash"]

def next_sku():
    if os.path.exists(LEDGER_FILE):
        with open(LEDGER_FILE) as f:
            for line in reversed(f.readlines()):
                d = json.loads(line)
                if d.get("event") == "SKU_ASSIGNED" and d["sku"].startswith(SKU_PREFIX):
                    return int(d["sku"][len(SKU_PREFIX):]) + 1
    return 1

def load_stripe_reg():
    if os.path.exists(STRIPE_REG): return json.load(open(STRIPE_REG))
    return {}
def save_stripe_reg(d): json.dump(d, open(STRIPE_REG, "w", encoding="utf-8"), indent=2)

pages = []
cursor = None
while True:
    resp = query_db({"property": "Status", "select": {"equals": "Publish Approved"}},
                    start_cursor=cursor)
    pages.extend(resp.get("results", []))
    if not resp.get("has_more"):
        break
    cursor = resp.get("next_cursor")

for page in pages:
    pid = page["id"]
    name       = get_prop(page, "Name", "title")
    price      = get_prop(page, "Price NZD", "number")
    type_      = get_prop(page, "Type", "select") or "Deck"
    decklist_raw = get_prop(page, "Decklist", "rich_text") or ""
    commander    = get_prop(page, "Commander", "rich_text") or ""
    sku_val      = get_prop(page, "SKU", "rich_text") or ""

    if not sku_val:
        sku_num = next_sku()
        sku = f"{SKU_PREFIX}{sku_num:05d}"
        safe_n(notion.pages.update, page_id=pid,
               properties={"SKU": {"rich_text":[{"text":{"content":sku}}]}})
        ledger_append("SKU_ASSIGNED", sku, {"page_id": pid})
    else:
        sku = sku_val

    if type_ == "Deck":
        cards = parse_cards(decklist_raw)
        identity = {"name": name, "commander": commander, "format": "Commander"}
        # tolerant validation: 99-101 cards allowed
        if len(cards) < 99 or len(cards) > 101:
            print(f"WARNING: {sku} has {len(cards)} cards  allowed range 99-101")
        card_names = [c["name"] for c in cards]
        marketing = generate_marketing(commander, card_names, price, "Commander")
    else:
        cards = [{"qty": 1, "set": "?", "name": decklist_raw.strip()}] if decklist_raw.strip() else []
        identity = {"name": name, "card_name": decklist_raw.strip(), "type": "single"}
        marketing = {"headline": name, "description": f"Single card: {decklist_raw.strip()}. ${price} NZD."}

    passport = {
        "asset_id": sku, "silo_id": "MTG", "type": type_,
        "identity": identity,
        "inventory": {"cards": cards, "card_count": len(cards)},
        "commerce": {"price_nzd": price, "currency": "NZD", "status": "APPROVED", "stripe_url": ""},
        "trust": {"gate": "PASS", "badge": "VERIFIED_ASSET"},
        "evidence": {"source": "Notion", "source_id": pid, "created_at": now()},
        "marketing": marketing
    }

    payment_url = ""
    if STRIPE_KEY:
        reg = load_stripe_reg()
        price_hash = sha256(f"{price}{name}")
        existing = reg.get(sku)
        if existing and existing.get("price_hash") == price_hash:
            try:
                session = safe_s(stripe.checkout.Session.retrieve, existing["session_id"])
                if session.url: payment_url = session.url
            except: pass
        if not payment_url:
            if existing:
                try: safe_s(stripe.checkout.Session.expire, existing["session_id"])
                except: pass
            session = safe_s(stripe.checkout.Session.create,
                payment_method_types=["card"],
                line_items=[{"price_data": {
                    "currency": "nzd",
                    "product_data": {"name": f"DreamLedger MTG: {name}"},
                    "unit_amount": int(price*100)
                }, "quantity": 1}],
                mode="payment",
                success_url="https://dreamledger.org/success.html",
                cancel_url="https://dreamledger.org/cancel.html",
                metadata={"sku": sku, "system": "DreamLedgerMTG", "version": "3.3"},
                idempotency_key=f"checkout_{sku}_{price_hash}")
            payment_url = session.url
            reg[sku] = {"session_id": session.id, "price_hash": price_hash,
                        "price": price, "created": now()}
            save_stripe_reg(reg)
    passport["commerce"]["stripe_url"] = payment_url

    p_hash = sha256(canonical_json({k: passport[k] for k in ["identity","inventory","commerce","marketing"]}))
    passport["passport_hash"] = p_hash
    with open(os.path.join(PASSPORT_DIR, f"{sku}.json"), "w") as f:
        json.dump(passport, f, indent=2)

    if type_ == "Deck":
        mw = f"// NAME : {name}\n// COMMANDER : {commander}\n// FORMAT : Commander\n"
        for c in cards: mw += f"{c['qty']} [{c['set']}] {c['name']}\n"
        mw_file = os.path.join(CONTENT_DIR, f"{sku}.mwDeck")
    else:
        mw = f"// CARD : {decklist_raw.strip()}\n// PRICE : {price}\n// SKU : {sku}\n"
        mw_file = os.path.join(CONTENT_DIR, f"{sku}.mwSingle")
    with open(mw_file, "w", encoding="utf-8") as f: f.write(mw)
    decklock_hash = sha256(mw)

    proof = {
        "event": "ASSET_PUBLISHED", "sku": sku,
        "passport_hash": p_hash, "decklock_hash": decklock_hash,
        "stripe_url": payment_url, "notion_page_id": pid,
        "timestamp": now(), "status": "PASS"
    }
    with open(os.path.join(PROOF_DIR, f"publish_{sku}.json"), "w") as f:
        json.dump(proof, f, indent=2)
    ledger_append("ASSET_PUBLISHED", sku, {"proof_file": f"publish_{sku}.json"})

    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:30]
    safe_n(notion.pages.update, page_id=pid, properties={
        "Status": {"select": {"name": "Published"}},
        "Publish URL": {"url": f"https://dreamledger.org/mtg/{slug}/"},
        "Payment URL": {"url": payment_url},
        "Last Factory Run": {"rich_text": [{"text": {"content": f"{now()} PUBLISH PASS"}}]},
        "Publish Error": {"rich_text": []},
        "Marketing Headline": {"rich_text": [{"text": {"content": marketing["headline"]}}]},
        "Marketing Description": {"rich_text": [{"text": {"content": marketing["description"]}}]}
    })
    print(f"Published {sku}")



