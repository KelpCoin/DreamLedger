import os, uuid, json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
from passlib.context import CryptContext
from jose import jwt, JWTError

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

app = FastAPI(title="DreamLedger MTG Marketplace")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class UserRegister(BaseModel):
    email: EmailStr
    display_name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CardListing(BaseModel):
    card_name: str
    set_name: str = ""
    condition: str = ""
    price_nzd: float
    is_tradeable: bool = True

class TradeProposal(BaseModel):
    to_user_id: str
    offered_item: str
    requested_item: str

def get_user_from_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user = supabase.table("users").select("*").eq("id", payload["sub"]).execute()
        if not user.data:
            raise HTTPException(401, "User not found")
        return user.data[0]
    except JWTError:
        raise HTTPException(401, "Invalid token")

@app.post("/register")
def register(user: UserRegister):
    existing = supabase.table("users").select("id").eq("email", user.email).execute()
    if existing.data:
        raise HTTPException(400, "Email already registered")
    hashed = pwd_context.hash(user.password)
    supabase.table("users").insert({
        "email": user.email,
        "display_name": user.display_name,
        "password_hash": hashed
    }).execute()
    return {"msg": "Registration successful"}

@app.post("/login")
def login(user: UserLogin):
    resp = supabase.table("users").select("*").eq("email", user.email).execute()
    if not resp.data or not pwd_context.verify(user.password, resp.data[0]["password_hash"]):
        raise HTTPException(400, "Invalid credentials")
    token = jwt.encode({
        "sub": resp.data[0]["id"],
        "exp": datetime.utcnow() + timedelta(days=7)
    }, JWT_SECRET, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

@app.post("/listings")
def create_listing(listing: CardListing, user=Depends(get_user_from_token)):
    data = {
        "seller_id": user["id"],
        "card_name": listing.card_name,
        "set_name": listing.set_name,
        "condition": listing.condition,
        "price_nzd": listing.price_nzd,
        "is_tradeable": listing.is_tradeable
    }
    res = supabase.table("listings").insert(data).execute()
    return res.data[0]

@app.get("/listings")
def get_listings():
    res = supabase.table("listings").select("*").order("created_at", desc=True).execute()
    return res.data

@app.post("/trades")
def propose_trade(trade: TradeProposal, user=Depends(get_user_from_token)):
    recipient = supabase.table("users").select("id").eq("id", trade.to_user_id).execute()
    if not recipient.data:
        raise HTTPException(404, "Recipient not found")
    data = {
        "from_user_id": user["id"],
        "to_user_id": trade.to_user_id,
        "offered_item": trade.offered_item,
        "requested_item": trade.requested_item,
        "status": "pending"
    }
    res = supabase.table("trades").insert(data).execute()
    return res.data[0]

@app.get("/trades")
def get_my_trades(user=Depends(get_user_from_token)):
    res = supabase.table("trades").select("*").or_(
        f"from_user_id.eq.{user['id']},to_user_id.eq.{user['id']}"
    ).execute()
    return res.data

@app.post("/trades/{trade_id}/confirm")
def confirm_trade(trade_id: str, user=Depends(get_user_from_token)):
    trade = supabase.table("trades").select("*").eq("id", trade_id).single().execute()
    if not trade.data:
        raise HTTPException(404, "Trade not found")
    if trade.data["to_user_id"] != user["id"]:
        raise HTTPException(403, "Only the recipient can confirm")
    supabase.table("trades").update({"status": "completed"}).eq("id", trade_id).execute()
    return {"msg": "Trade confirmed"}

@app.get("/health")
def health():
    return {"status": "ok"}
