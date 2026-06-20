from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict
import uuid

app = FastAPI(title="DreamLedger MTG Silo API")

# -------------------------
# IN-MEMORY STATE (MVP ONLY)
# -------------------------
users = {}
listings = {}
trades = {}

# -------------------------
# MODELS
# -------------------------
class User(BaseModel):
    email: str

class Listing(BaseModel):
    user_id: str
    card_name: str
    price_nzd: float

class Trade(BaseModel):
    from_user: str
    to_user: str
    offer: str

# -------------------------
# USERS
# -------------------------
@app.post("/api/users")
def create_user(user: User):
    user_id = str(uuid.uuid4())
    users[user_id] = {"email": user.email, "reputation": 0}
    return {"user_id": user_id, "email": user.email}

@app.get("/api/users")
def get_users():
    return users

# -------------------------
# LISTINGS (NO FEES - MTG SILO RULE)
# -------------------------
@app.post("/api/listings")
def create_listing(listing: Listing):
    listing_id = str(uuid.uuid4())
    listings[listing_id] = listing.dict()
    listings[listing_id]["id"] = listing_id
    listings[listing_id]["fee"] = 0  # enforced zero-fee silo
    return listings[listing_id]

@app.get("/api/listings")
def get_listings():
    return listings

# -------------------------
# TRADES
# -------------------------
@app.post("/api/trades")
def create_trade(trade: Trade):
    trade_id = str(uuid.uuid4())
    trades[trade_id] = trade.dict()
    trades[trade_id]["status"] = "pending"
    return trades[trade_id]

@app.get("/api/trades")
def get_trades():
    return trades
