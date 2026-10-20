#!/usr/bin/env python3
"""Static fail-closed checks for the shared auction migration/API; no DB calls."""
from pathlib import Path
import sys

SQL = Path("supabase/migrations/20261021120000_shared_silo_auction_kernel.sql").read_text(encoding="utf-8")
DOC = Path("docs/SHARED-SILO-AUCTION-KERNEL.md").read_text(encoding="utf-8")
API = Path("api/auctions.js").read_text(encoding="utf-8")

checks = {
    "silo isolation key": "silo_id text not null" in SQL and "unique (silo_id, source_type, source_id)" in SQL,
    "row lock": "for update" in SQL.lower(),
    "authenticated caller": "auth.uid()" in SQL,
    "self bid rejected": "AUCTION_SELF_BIDDING_FORBIDDEN" in SQL,
    "time window enforced": "AUCTION_OUTSIDE_ACTIVE_WINDOW" in SQL,
    "minimum increment enforced": "AUCTION_BID_BELOW_MINIMUM" in SQL,
    "idempotency enforced": "unique (auction_id, bidder_id, idempotency_key)" in SQL,
    "replay path": "IDEMPOTENT_REPLAY" in SQL,
    "client direct bid writes revoked": "revoke insert, update, delete on public.marketplace_auction_bids from anon, authenticated" in SQL.lower(),
    "publication approval gate": "publication_approved_at is not null" in SQL,
    "bid acceptance does not mark payment settled": "'BID_ACCEPTED'" in SQL and "set status = 'paid'" not in SQL.lower(),
    "API uses caller JWT": "Authorization: auth" in API,
    "API has no service role key": "SUPABASE_SERVICE_ROLE_KEY" not in API,
    "API validates amount and idempotency": "BID_AMOUNT_INVALID" in API and "IDEMPOTENCY_KEY_INVALID" in API,
    "API fails closed without configuration": "AUCTION_BACKEND_NOT_CONFIGURED" in API,
    "payment truth boundary documented": "No paid status is inferred from the winning bid" in DOC,
    "not deployed disclosed": "not deployed" in DOC.lower(),
    "legacy MTG limitation disclosed": "does not rewrite those tables" in DOC.lower() and "mtg_auctions" in DOC.lower(),
}
failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f'{"PASS" if ok else "FAIL"} {name}')
if failed:
    print("AUCTION_CONTRACT=FAIL")
    sys.exit(1)
print(f"AUCTION_CONTRACT=PASS checks={len(checks)} revenue_claim=NONE database_mutation=NONE")
