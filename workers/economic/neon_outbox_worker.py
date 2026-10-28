#!/usr/bin/env python3
"""OPTIONAL Cloud Neon commerce performer for EXISTING scheduled worker.

OFF by default. Never process payments directly. Must use a validated
payment-to-outbox transaction and independently reviewed idempotent delivery
adapter before enabling. Do not claim buyer delivery from SMTP acceptance.
"""
import hashlib
import ipaddress
import json
import os
import re
import sys
import uuid
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

HASH = re.compile(r"^[0-9a-f]{64}$")
IDENT = re.compile(r"^[a-zA-Z0-9_.:-]{1,160}$")
SILO = re.compile(r"^[a-z0-9_-]{1,64}$")

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("DELIVERY_REDIRECT_REFUSED")

def config(env):
    if env.get("BECK_NEON_COMMERCE_ENABLED") != "1":
        return None
    required = ("NEON_DATABASE_URL","BECK_DELIVERY_ADAPTER_URL",
      "BECK_DELIVERY_ADAPTER_TOKEN","BECK_DELIVERY_ALLOWED_HOST",
      "BECK_DELIVERY_ALLOWED_SILO","BECK_DELIVERY_IDEMPOTENCY_CONTRACT")
    if any(not env.get(k) for k in required):
        raise ValueError("NEON_CLOUD_WORKER_CONFIG_HOLD")
    if env["BECK_DELIVERY_IDEMPOTENCY_CONTRACT"] != "verified-v1":
        raise ValueError("DELIVERY_ADAPTER_UNATTESTED_HOLD")
    silo=env["BECK_DELIVERY_ALLOWED_SILO"]
    if not SILO.fullmatch(silo):
        raise ValueError("INVALID_WORKER_SILO_HOLD")
    url=urlsplit(env["BECK_DELIVERY_ADAPTER_URL"])
    host=env["BECK_DELIVERY_ALLOWED_HOST"]
    if url.scheme!="https" or url.hostname!=host or url.port not in (None,443) \
      or url.username or url.password or url.fragment or not url.path.startswith("/"):
        raise ValueError("DELIVERY_ORIGIN_REFUSED")
    if host in ("localhost","localhost.localdomain") or not host or "." not in host:
        raise ValueError("LOCAL_OR_AMBIGUOUS_DELIVERY_HOST_REFUSED")
    try:
        ip=ipaddress.ip_address(host)
        if not ip.is_global:
            raise ValueError("PRIVATE_DELIVERY_IP_REFUSED")
    except ValueError as ex:
        if str(ex)=="PRIVATE_DELIVERY_IP_REFUSED":
            raise
    dsn=env["NEON_DATABASE_URL"]
    if not dsn.startswith(("postgresql://","postgres://")) or not (
       "sslmode=verify-full" in dsn or "sslmode=require" in dsn):
        raise ValueError("NEON_TLS_MISSING_HOLD")
    return {"silo":silo, "url":env["BECK_DELIVERY_ADAPTER_URL"],
      "token":env["BECK_DELIVERY_ADAPTER_TOKEN"],
      "worker_id":"becko-"+env.get("GITHUB_RUN_ID",uuid.uuid4().hex)[:60]}

def receipt(value,key):
    if not isinstance(value,dict) or value.get("delivery_key")!=key \
      or value.get("buyer_delivery_verified") is not True \
      or value.get("status")!="DELIVERED":
        raise ValueError("BUYER_DELIVERY_NOT_ATTESTED_HOLD")
    digest=value.get("receipt_sha256")
    if not isinstance(digest,str) or not HASH.fullmatch(digest):
        raise ValueError("PROVIDER_RECEIPT_INVALID_HOLD")
    return digest

def deliver(cfg,row,trace):
    key=row["delivery_key"]
    payload=row["payload"]
    if not isinstance(key,str) or not IDENT.fullmatch(key) \
      or not isinstance(payload,dict) or payload.get("silo_id")!=cfg["silo"] \
      or not payload.get("delivery_ref"):
        raise ValueError("CROSS_SILO_OR_INVALID_DELIVERY_REFUSED")
    body=json.dumps({"delivery_key":key,"payload":payload,"trace_id":trace},
      sort_keys=True,separators=(",",":")).encode("utf-8")
    request=Request(cfg["url"],data=body,method="POST",headers={
      "Authorization":"Bearer "+cfg["token"],
      "Content-Type":"application/json",
      "X-Idempotency-Key":key,
      "X-Beck-Trace-Id":trace,
    })
    with build_opener(NoRedirect()).open(request,timeout=20) as response:
        if response.status!=200: raise ValueError("DELIVERY_PROVIDER_NOT_CONFIRMED")
        raw=response.read(32769)
        if len(raw)>32768: raise ValueError("DELIVERY_RECEIPT_TOO_LARGE")
        payload=json.loads(raw)
    return receipt(payload,key)

def run():
    cfg=config(os.environ)
    if cfg is None:
        print(json.dumps({"state":"DISABLED","reason":"NOT_OPERATOR_ENABLED",
                          "payments_changed":False}))
        return 0
    import psycopg
    from psycopg.rows import dict_row
    trace=uuid.uuid4().hex
    with psycopg.connect(os.environ["NEON_DATABASE_URL"],
                         connect_timeout=15,autocommit=True) as db:
        with db.cursor(row_factory=dict_row) as cur:
            cur.execute("select * from public.becko_claim_v1(%s,%s,%s,%s,%s)",
                        (cfg["worker_id"],cfg["silo"],3,5,300))
            tasks=cur.fetchall()
        for job in tasks:
            key=job["delivery_key"]
            try:
                digest=deliver(cfg,job,trace)
                with db.cursor() as cur:
                    cur.execute("select public.becko_confirm_v1(%s,%s,%s,%s)",
                      (key,cfg["worker_id"],job["lease_token"],digest))
                state="PROVIDER_ATTESTED_DELIVERED"
            except (HTTPError,URLError,OSError,TimeoutError,ValueError,KeyError,json.JSONDecodeError) as e:
                state="RETRY_SCHEDULED"
                try:
                    with db.cursor() as cur:
                        cur.execute("select public.becko_retry_v1(%s,%s,%s,%s,%s)",
                          (key,cfg["worker_id"],job["lease_token"],type(e).__name__,5))
                except Exception:
                    state="LEASE_OR_DATABASE_UNAVAILABLE_HOLD"
            print(json.dumps({"delivery_key_sha256":hashlib.sha256(key.encode()).hexdigest(),
                              "silo":cfg["silo"],"state":state,"trace_id":trace}))
    return 0

if __name__=="__main__":
    try: sys.exit(run())
    except Exception as error:
        print(json.dumps({"state":"HOLD","reason_class":type(error).__name__,
                          "production_payment_changes":False}))
        sys.exit(1)
