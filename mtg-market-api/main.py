import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta
from supabase import create_client

app = FastAPI(title="MTG Silo Marketplace API")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
JWT_SECRET = os.getenv("JWT_SECRET","dev-secret")

db = create_client(SUPABASE_URL, SUPABASE_KEY)

def log_event(event):
    path = f"D:\\BrownEyeCortex\\diagnostics\\mtg_api_{datetime.now().strftime('%Y%m%d')}.log"
    with open(path,"a",encoding="utf-8") as f:
        f.write(str(event) + "\n")

class User(BaseModel):
    email: str
    password: str

@app.get("/health")
def health():
    return {"status":"ok","time":str(datetime.utcnow())}

@app.post("/users/register")
def register(user: User):
    res = db.table("users").insert({
        "email": user.email,
        "password": user.password,
        "created_at": str(datetime.utcnow())
    }).execute()

    log_event({"action":"register","email":user.email})
    return {"status":"created","user":res.data}

@app.post("/users/login")
def login(user: User):
    res = db.table("users").select("*").eq("email",user.email).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="user not found")

    token = jwt.encode({
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }, JWT_SECRET, algorithm="HS256")

    log_event({"action":"login","email":user.email})
    return {"token":token}

@app.post("/listings/create")
def create_listing(payload: dict):
    payload["silo"] = "MTG"
    payload["fee"] = 0  # enforced rule

    res = db.table("listings").insert(payload).execute()
    log_event({"action":"create_listing","payload":payload})
    return {"status":"ok","listing":res.data}

@app.get("/listings/feed")
def feed():
    res = db.table("listings").select("*").eq("silo","MTG").execute()
    return {"listings":res.data}

@app.post("/trades/propose")
def propose_trade(payload: dict):
    res = db.table("trades").insert({
        "status":"pending",
        "data":payload
    }).execute()

    log_event({"action":"trade_propose","payload":payload})
    return {"status":"pending","trade":res.data}

@app.post("/trades/confirm")
def confirm_trade(payload: dict):
    res = db.table("trades").update({
        "status":"confirmed"
    }).eq("id",payload["id"]).execute()

    log_event({"action":"trade_confirm","id":payload["id"]})
    return {"status":"confirmed","trade":res.data}
