import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ops" / "demand"
SILOS = ROOT / "public" / "silos"
MAX_ACTIVE = int(os.getenv("MAX_ACTIVE_SILOS", "12"))
UA = "DreamLedger-DemandRadar/1.0"

HYPOTHESES = [
    {"slug":"stripe-reconciliation","name":"Stripe Production Reconciliation","tag":"B2B / Trust","price":"NZ$1,500+","queries":["stripe reconciliation production", "stripe webhook duplicate payment"],"pitch":"Find mismatches between Stripe payments, orders, entitlements and fulfillment before they become expensive."},
    {"slug":"ai-saas-verification","name":"AI SaaS Production Verification","tag":"B2B / Verification","price":"NZ$1,500+","queries":["AI generated SaaS production bugs", "AI software production verification"],"pitch":"A fixed-scope evidence report for AI-built software that claims to work in production."},
    {"slug":"webhook-reliability","name":"Webhook Reliability Rescue","tag":"Developer / Reliability","price":"NZ$79+","queries":["webhook reliability stripe discord", "webhook duplicate events idempotency"],"pitch":"Diagnose duplicate events, ordering bugs, signature failures and missing fulfillment."},
    {"slug":"supabase-production-hardening","name":"Supabase Production Hardening","tag":"Developer / Database","price":"NZ$299+","queries":["Supabase RLS production security", "Supabase PostgreSQL production problems"],"pitch":"Focused production checks for RLS, grants, migrations, data integrity and exposed APIs."},
    {"slug":"discord-automation","name":"Discord Automation Starter","tag":"Digital Product","price":"NZ$79","queries":["Discord webhook automation", "Discord Stripe integration"],"pitch":"A compact starter implementation for turning payment and business events into reliable Discord actions."},
    {"slug":"commander-deck-diagnostic","name":"Commander Deck Diagnostic","tag":"Gaming / Service","price":"NZ$29","queries":["Commander deck upgrade help", "MTG Commander deck diagnostic"],"pitch":"A practical diagnostic that identifies weaknesses, priorities and the cheapest useful upgrades."},
    {"slug":"game-economy-audit","name":"Game Economy Audit","tag":"Game / B2B","price":"NZ$299+","queries":["game economy balancing sinks", "game economy inflation balancing"],"pitch":"Audit currency sources, sinks, scarcity, progression and player incentives before an economy runs away."},
    {"slug":"qr-microsite","name":"QR Microsite Starter","tag":"Commerce / Web","price":"NZ$49+","queries":["QR code landing page business", "QR code microsite conversion"],"pitch":"Fast campaign microsites with measurable destinations instead of a QR code pointing at a dead homepage."},
    {"slug":"production-incident-pack","name":"Production Incident Pack","tag":"B2B / Ops","price":"NZ$199+","queries":["production incident checklist SaaS", "SaaS incident response checklist"],"pitch":"A compact evidence-first incident pack for small software teams that need to establish what actually broke."},
    {"slug":"payment-attribution","name":"Payment Attribution Check","tag":"Commerce / Analytics","price":"NZ$149+","queries":["Stripe payment attribution checkout metadata", "Stripe conversion attribution problems"],"pitch":"Trace a payment from checkout through attribution, fulfillment and evidence without trusting the browser redirect."},
    {"slug":"digital-offer-audit","name":"Digital Offer Audit","tag":"Commerce / Conversion","price":"NZ$149+","queries":["digital product offer conversion audit", "landing page checkout conversion problems"],"pitch":"Find the gaps between what a page promises, what checkout sells and what the buyer actually receives."},
    {"slug":"small-saas-healthcheck","name":"Small SaaS Healthcheck","tag":"B2B / Audit","price":"NZ$299+","queries":["small SaaS production audit", "SaaS health check security payments"],"pitch":"A fixed-scope healthcheck across deployment, payments, database state, monitoring and customer delivery."},
]


def get(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def github_count(query):
    token = os.getenv("GITHUB_TOKEN", "")
    headers = {"Accept":"application/vnd.github+json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    url = "https://api.github.com/search/issues?" + urllib.parse.urlencode({"q":query,"per_page":1})
    try:
        data = get(url, headers=headers)
        return int(data.get("total_count", 0)), "github"
    except Exception as e:
        return 0, "github_error:" + str(e)[:100]


def hn_count(query):
    url = "https://hn.algolia.com/api/v1/search?" + urllib.parse.urlencode({"query":query,"tags":"story","hitsPerPage":1})
    try:
        data = get(url)
        return int(data.get("nbHits", 0)), "hackernews"
    except Exception as e:
        return 0, "hn_error:" + str(e)[:100]


def stack_signal(query):
    url = "https://api.stackexchange.com/2.3/search/advanced?" + urllib.parse.urlencode({"order":"desc","sort":"relevance","q":query,"site":"stackoverflow","pagesize":1})
    try:
        data = get(url)
        return (1 if data.get("items") else 0), "stackoverflow"
    except Exception as e:
        return 0, "stack_error:" + str(e)[:100]


def score(h):
    source_total = sum(x["count"] for x in h["signals"])
    source_hits = sum(1 for x in h["signals"] if x["count"] > 0)
    return source_total + source_hits * 100


def render_page(h):
    subject = urllib.parse.quote(h["name"] + " early access")
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{h['pitch']}"><title>{h['name']} | DreamLedger</title><style>body{{margin:0;background:#07080c;color:#f6f2e8;font:16px system-ui,sans-serif}}main{{max-width:760px;margin:0 auto;padding:48px 22px}}.tag{{color:#e2b95f;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}}h1{{font-size:clamp(42px,9vw,76px);line-height:.9;letter-spacing:-.06em;margin:14px 0}}p{{color:#aeb2bd;line-height:1.6}}.card{{border:1px solid #282e3a;border-radius:18px;padding:24px;margin-top:28px;background:#10131b}}.cta{{display:inline-block;margin-top:18px;padding:13px 18px;border-radius:9px;background:#e2b95f;color:#0b0b08;font-weight:900;text-decoration:none}}small{{color:#707785}}</style></head><body><main><div class="tag">{h['tag']} · demand probe</div><h1>{h['name']}</h1><p>{h['pitch']}</p><div class="card"><strong>Early access</strong><p>This is an actively tested offer. If you want the first version, describe the problem you need solved.</p><a class="cta" href="mailto:hello@dreamledger.org?subject={subject}">Request access</a><p><small>Indicative price: {h['price']}. No payment is taken on this probe.</small></p></div><p><a href="/silos/" style="color:#e2b95f">Back to demand-tested offers</a></p></main></body></html>'''


def render_index(active):
    cards = []
    for h in active:
        cards.append(f'<article><div class="tag">{h["tag"]}</div><h2><a href="/silos/{h["slug"]}/">{h["name"]}</a></h2><p>{h["pitch"]}</p><strong>{h["price"]}</strong><small> · score {h["score"]}</small></article>')
    return '''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demand-tested offers | DreamLedger</title><style>body{margin:0;background:#07080c;color:#f6f2e8;font:15px system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:40px 20px}.tag{color:#e2b95f;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{font-size:clamp(42px,8vw,72px);letter-spacing:-.06em;line-height:.9}p{color:#aeb2bd;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}article{border:1px solid #282e3a;border-radius:16px;padding:20px;background:#10131b}h2{font-size:24px}a{color:#f6f2e8;text-decoration:none}small{color:#707785}</style></head><body><main><div class="tag">DreamLedger · demand radar</div><h1>Problems first. Products second.</h1><p>These are live demand probes selected from public signals. A probe graduates only when people show intent. This surface does not claim revenue.</p><div class="grid">''' + ''.join(cards) + '</div></main></body></html>'


def main():
    results=[]
    for original in HYPOTHESES:
        h = dict(original)
        signals=[]
        for q in h["queries"]:
            g, gs = github_count(q); signals.append({"source":gs,"query":q,"count":g})
            hn, hs = hn_count(q); signals.append({"source":hs,"query":q,"count":hn})
            st, ss = stack_signal(q); signals.append({"source":ss,"query":q,"count":st})
        h["signals"]=signals
        h["score"]=score(h)
        results.append(h)
    results.sort(key=lambda x:x["score"], reverse=True)
    active=results[:MAX_ACTIVE]
    for h in active:
        path=SILOS/h["slug"]
        path.mkdir(parents=True, exist_ok=True)
        (path/"index.html").write_text(render_page(h), encoding="utf-8")
    SILOS.mkdir(parents=True, exist_ok=True)
    (SILOS/"index.html").write_text(render_index(active), encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    payload={"generated_at":datetime.now(timezone.utc).isoformat(),"max_active":MAX_ACTIVE,"active":active,"all":results}
    (OUT/"latest.json").write_text(json.dumps(payload, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"generated_at":payload["generated_at"],"active":[{"slug":x["slug"],"score":x["score"]} for x in active]}, indent=2))

if __name__ == "__main__":
    main()
