import os, json, hashlib, hmac
from pathlib import Path
from datetime import datetime, timezone
import stripe
from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
PRICE_ID = os.getenv("STRIPE_PRICE_ID")

PROOF_DIR = Path("D:/BrownEyeCortex/LAKE/FIGURE8/proof/LOCAL-BECK")
EVIDENCE_DIR = Path("D:/BrownEyeCortex/LAKE/EVIDENCE/BUYLIST")
PROOF_DIR.mkdir(parents=True, exist_ok=True)
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
IDEMPOTENCY_FILE = PROOF_DIR / "stripe_event_idempotency.jsonl"

def sha256_text(t: str) -> str:
    return hashlib.sha256(t.encode('utf-8')).hexdigest()

def is_event_processed(event_id: str) -> bool:
    if not IDEMPOTENCY_FILE.exists(): return False
    try:
        with IDEMPOTENCY_FILE.open('r', encoding='utf-8') as f:
            for line in f:
                if event_id in line: return True
    except: pass
    return False

def mark_event_processed(event_id: str, session_id: str, sku: str):
    rec = {"event_id": event_id, "session_id": session_id, "sku": sku, "at": datetime.now(timezone.utc).isoformat()}
    with IDEMPOTENCY_FILE.open('a', encoding='utf-8') as f:
        f.write(json.dumps(rec)+"\n")

app = FastAPI(title="BECK Hardened")

class CheckoutRequest(BaseModel):
    customer_email: str | None = None
    metadata: dict | None = None

@app.post("/create-checkout-session")
async def create_checkout(req: CheckoutRequest):
    if not stripe.api_key or not stripe.api_key.startswith("sk_"):
        raise HTTPException(400, "STRIPE_SECRET_KEY must be sk_")
    if not PRICE_ID:
        raise HTTPException(400, "Set STRIPE_PRICE_ID in .env")
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": PRICE_ID, "quantity": 1}],
        mode="payment",
        client_reference_id="BUYLIST-49",
        customer_email=req.customer_email,
        success_url="https://dreamledger.example.com/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="https://dreamledger.example.com/cancel",
        metadata=req.metadata or {"sku_id":"BUYLIST-49"}
    )
    return {"checkout_url": session.url, "session_id": session.id}

@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    raw_body = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload=raw_body, sig_header=stripe_signature, secret=WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(400, f"Invalid sig: {e}")
    if is_event_processed(event.id):
        return JSONResponse(200, {"status":"duplicate_ignored"})
    if event.type == "checkout.session.completed":
        session = event.data.object
        sku = session.get("client_reference_id") or session.get("metadata",{}).get("sku_id")
        if not sku: return JSONResponse(200, {"status":"no_sku"})
        try:
            verified = stripe.checkout.Session.retrieve(session.id)
            paid = verified.payment_status == "paid"
        except Exception as e:
            return JSONResponse(200, {"status":"verify_failed","error":str(e)})
        if not paid: return JSONResponse(200, {"status":"not_paid"})
        mark_event_processed(event.id, session.id, sku)
        proof = {"schema":"dreamledger/settlement/v1","event_id":event.id,"session_id":session.id,"sku":sku,"amount_nzd":verified.amount_total/100.0,"verified_at":datetime.now(timezone.utc).isoformat()}
        p = EVIDENCE_DIR / f"SETTLEMENT-{sku}-{session.id}.json"
        p.write_text(json.dumps(proof, indent=2), encoding='utf-8')
        return JSONResponse(200, {"status":"settled","proof":str(p),"sha256":sha256_text(p.read_text(encoding='utf-8'))})
    return JSONResponse(200, {"status":"ignored"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
