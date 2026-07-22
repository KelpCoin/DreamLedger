import os, json, re, time, hashlib
from datetime import datetime, timezone
from notion_client import Client
import stripe
from tenacity import retry, stop_after_attempt, wait_exponential

NOTION_API_KEY = os.environ["NOTION_API_KEY"]
DATABASE_ID = os.environ["NOTION_DATABASE_ID"]
STRIPE_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
SILO = "MTG"
SKU_PREFIX = f"DL-{SILO}-"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSPORT_DIR = os.path.join(ROOT, "passports")
PROOF_DIR = os.path.join(ROOT, "proofs")
LEDGER_FILE = os.path.join(ROOT, "ledger", "chain.jsonl")
CONTENT_DIR = os.path.join(ROOT, "content", "mtg")
STRIPE_REG = os.path.join(ROOT, "registry", "stripe_registry.json")
os.makedirs(PASSPORT_DIR, exist_ok=True); os.makedirs(PROOF_DIR, exist_ok=True); os.makedirs(CONTENT_DIR, exist_ok=True)

def create_revenue_atom(sku, amount, currency, stripe_event_id):
    import json, os, hashlib
    from datetime import datetime, timezone
    atom_id = f"REV-{sku}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}"
    atom = {
        "event": "REVENUE_RECEIVED",
        "atom_id": atom_id,
        "sku": sku,
        "amount": amount,
        "currency": currency,
        "stripe_event_id": stripe_event_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "PAID",
        "fulfillment": "PENDING"
    }
    atom_path = os.path.join(REPO_ROOT, "revenue", "atoms", f"{atom_id}.json")
    with open(atom_path, "w") as f:
        json.dump(atom, f, indent=2)
    return atom

notion = Client(auth=NOTION_API_KEY)
stripe.api_key = STRIPE_KEY

def now():
    return datetime.now(timezone.utc).isoformat()
def sha256(s):
    return hashlib.sha256(s.encode()).hexdigest()

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def safe_n(f, *a, **kw): return f(*a, **kw)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def safe_s(f, *a, **kw): return f(*a, **kw)

def get_prop(page, name, kind="text"):
    p = page["properties"].get(name)
    if not p: return None
    if kind == "title": return "".join(t.get("plain_text","") for t in p.get("title",[])).strip() or None
    if kind == "rich_text": return "".join(t.get("plain_text","") for t in p.get("rich_text",[])).strip() or None
    if kind == "number": return p.get("number")
    if kind == "select": return p.get("select",{}).get("name")
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
    if not os.path.exists(LEDGER_FILE):
        return "genesis"
    with open(LEDGER_FILE, "r") as f:
        lines = f.readlines()
    if not lines:
        return "genesis"
    return json.loads(lines[-1])["event_hash"]

def ledger_append(event_type, sku, payload):
    prev = ledger_last_hash()
    evt = {"event": event_type, "sku": sku, "payload": payload, "timestamp": now(), "previous_hash": prev}
    evt["event_hash"] = sha256(json.dumps(evt, sort_keys=True))
    with open(LEDGER_FILE, "a") as f:
        f.write(json.dumps(evt) + "\n")
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
def save_stripe_reg(d): json.dump(d, open(STRIPE_REG, "w"), indent=2)

# Fetch Publish Approved pages
pages = []
cursor = None
while True:
    resp = safe_n(notion.databases.query, database_id=DATABASE_ID,
        filter={"property": "Status", "select": {"equals": "Publish Approved"}},
        page_size=100, start_cursor=cursor)
    pages.extend(resp["results"])
    cursor = resp.get("next_cursor")
    if not resp["has_more"]: break

for page in pages:
    pid = page["id"]
    name = get_prop(page, "Name", "title")
    price = get_prop(page, "Price NZD", "number")
    type_ = get_prop(page, "Type", "select") or "Deck"
    decklist_raw = get_prop(page, "Decklist", "rich_text") or ""
    commander = get_prop(page, "Commander", "rich_text") or ""
    sku_val = get_prop(page, "SKU", "rich_text") or ""

    if not sku_val:
        sku_num = next_sku()
        sku = f"{SKU_PREFIX}{sku_num:05d}"
        safe_n(notion.pages.update, page_id=pid, properties={"SKU": {"rich_text":[{"text":{"content":sku}}]}})
        ledger_append("SKU_ASSIGNED", sku, {"page_id": pid})
    else:
        sku = sku_val

    # Parse cards
    if type_ == "Deck":
        cards = parse_cards(decklist_raw)
        identity = {"name": name, "commander": commander, "format": "Commander"}
    else:
        cards = [{"qty": 1, "set": "?", "name": decklist_raw.strip()}] if decklist_raw.strip() else []
        identity = {"name": name, "card_name": decklist_raw.strip(), "type": "single"}

    passport = {
        "asset_id": sku, "silo_id": "MTG", "type": type_,
        "identity": identity,
        "inventory": {"cards": cards, "card_count": len(cards)},
        "commerce": {"price_nzd": price, "currency": "NZD", "status": "APPROVED", "stripe_url": ""},
        "trust": {"gate": "PASS", "badge": "VERIFIED_ASSET"},
        "evidence": {"source": "Notion", "source_id": pid, "created_at": now()}
    }

    # Stripe payment link
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
                line_items=[{
                    "price_data": {"currency": "nzd", "product_data": {"name": f"DreamLedger MTG: {name}"},
                    "unit_amount": int(price*100)}, "quantity": 1
                }],
                mode="payment",
                success_url="https://dreamledger.org/mtg/success",
                cancel_url="https://dreamledger.org/mtg/cancel",
                metadata={"sku": sku},
                idempotency_key=f"checkout_{sku}_{price_hash}")
            payment_url = session.url
            reg[sku] = {"session_id": session.id, "price_hash": price_hash, "price": price, "created": now()}
            save_stripe_reg(reg)
    passport["commerce"]["stripe_url"] = payment_url  # now included

    p_hash = sha256(json.dumps({k: passport[k] for k in ["identity","inventory","commerce"]}, sort_keys=True))
    passport["passport_hash"] = p_hash

    with open(os.path.join(PASSPORT_DIR, f"{sku}.json"), "w") as f:
        json.dump(passport, f, indent=2)

    # DeckLock file
    if type_ == "Deck":
        mw = f"// NAME : {name}\n// COMMANDER : {commander}\n// FORMAT : Commander\n"
        for c in cards: mw += f"{c['qty']} [{c['set']}] {c['name']}\n"
        mw_file = os.path.join(CONTENT_DIR, f"{sku}.mwDeck")
    else:
        mw = f"// CARD : {decklist_raw.strip()}\n// PRICE : {price}\n// SKU : {sku}\n"
        mw_file = os.path.join(CONTENT_DIR, f"{sku}.mwSingle")
    with open(mw_file, "w") as f: f.write(mw)
    decklock_hash = sha256(mw)

    # Proof
    proof = {
        "event": "ASSET_PUBLISHED", "sku": sku,
        "passport_hash": p_hash, "decklock_hash": decklock_hash,
        "stripe_url": payment_url, "notion_page_id": pid,
        "timestamp": now(), "status": "PASS"
    }
    with open(os.path.join(PROOF_DIR, f"publish_{sku}.json"), "w") as f: json.dump(proof, f, indent=2)

    ledger_append("ASSET_PUBLISHED", sku, {"proof_file": f"publish_{sku}.json"})

    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:30]
    safe_n(notion.pages.update, page_id=pid, properties={
        "Status": {"select": {"name": "Published"}},
        "Publish URL": {"url": f"https://dreamledger.org/mtg/{slug}/"},
        "Payment URL": {"url": payment_url},
        "Last Factory Run": {"rich_text": [{"text": {"content": f"{now()} PUBLISH PASS"}}]},
        "Publish Error": {"rich_text": []}
    })
    print(f"Published {sku}")



