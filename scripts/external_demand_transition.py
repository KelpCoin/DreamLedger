import hashlib
import html
import json
from datetime import datetime, timezone
from pathlib import Path

PULSE = Path("webapp/pulse")
PULSE.mkdir(parents=True, exist_ok=True)

def run():
    seed_dir = Path("data/external-demand-seeds")
    seeds = []
    for path in sorted(seed_dir.glob("*.json"), reverse=True):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
            if item.get("truth_status") == "UNVERIFIED" and item.get("value_status") == "VALUE_CONFIRMED" and float(item.get("economic_stake_usd") or 0) >= 10000000:
                seeds.append(item)
        except Exception:
            continue
    if not seeds:
        return None

    signal = max(seeds, key=lambda x: float(x.get("economic_stake_usd") or 0))
    now = datetime.now(timezone.utc)
    key = hashlib.sha256(json.dumps(signal, sort_keys=True).encode()).hexdigest()[:16]
    filename = f"{now.date().isoformat()}-demand-transition-{signal['solicitation']}-{key}.html"
    target = PULSE / filename
    if not target.exists():
        incumbent = signal.get("incumbent_signal") or {}
        target.write_text("""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>777 Demand Transition: {title}</title>
<meta name="robots" content="index,follow">
<meta name="description" content="Source-bound high-value procurement transition signal with explicit economic stake, deadline and incumbent evidence.">
</head><body><main>
<p><a href="/">DreamLedger</a> / 777 Demand Transition</p>
<h1>{title}</h1>
<p><strong>Observed:</strong> {observed} · <strong>Source:</strong> SAM.gov</p>
<h2>External demand transition</h2>
<ul>
<li>Buyer: {buyer}</li>
<li>Solicitation: {solicitation}</li>
<li>Economic stake: US$ {value:,.0f}</li>
<li>Response deadline: {deadline}</li>
<li>Set-aside: {set_aside}</li>
<li>NAICS: {naics}</li>
</ul>
<p><a href="{source_url}">Open the primary SAM.gov opportunity</a></p>
<h2>Incumbency transition signal</h2>
<p>Public Air Force base-contract evidence identifies {incumbent_name} on an existing Construct Concrete Targets IDIQ with an estimated value of US$ {incumbent_value:,.0f} and an expiration of {incumbent_expiry}. This is a pursuit-transition signal, not proof that the incumbent will bid, win, or purchase intelligence.</p>
<h2>Buyer-side contact surface</h2>
<p>Primary contracting contact: {contact} · {contact_email}</p>
<h2>Commercial route</h2>
<p>VALUE_CONFIRMED plus an economic stake at or above US$10M, buyer-capacity evidence and an imminent response deadline qualifies this event for the high-ticket pursuit-intelligence surface. Payment, buyer, fulfillment and revenue remain UNVERIFIED.</p>
<h2>Truth boundary</h2>
<p>Status: UNVERIFIED. This page records external procurement evidence only.</p>
</main></body></html>""".format(
            title=html.escape(signal["title"]),
            observed=now.isoformat(),
            buyer=html.escape(signal["buyer"]),
            solicitation=html.escape(signal["solicitation"]),
            value=float(signal["economic_stake_usd"]),
            deadline=html.escape(signal["response_deadline"]),
            set_aside=html.escape(signal.get("set_aside","not established")),
            naics=html.escape(signal.get("naics","not established")),
            source_url=html.escape(signal["source_url"], quote=True),
            incumbent_name=html.escape(incumbent.get("contractor","not established")),
            incumbent_value=float(incumbent.get("existing_estimated_value_usd") or 0),
            incumbent_expiry=html.escape(str(incumbent.get("existing_expiration","unknown"))),
            contact=html.escape(signal.get("primary_contact","not established")),
            contact_email=html.escape(signal.get("primary_contact_email","not established"))
        ), encoding="utf-8")
    return signal, target

if __name__ == "__main__":
    result = run()
    if result:
        signal, target = result
        print(f"EXTERNAL_DEMAND_TRANSITION={signal['event_id']}|{signal['title']}|USD={signal['economic_stake_usd']}")
        print(f"PULSE={target}")
        print("TRUTH=UNVERIFIED")
