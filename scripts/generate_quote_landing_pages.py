#!/usr/bin/env python3
from pathlib import Path
import html, json

ROOT=Path("public")
cases=[
("construction","Construction Supplier Quote Comparison","Compare builder, subcontractor and materials quotes side by side.","construction suppliers, materials, subcontractor quotes"),
("manufacturing","Manufacturing Supplier Quote Comparison","Normalize supplier pricing, MOQ, lead time and payment terms before a purchasing decision.","manufacturing procurement, supplier quotes"),
("lighting","Lighting Supplier Quote Comparison","Turn lighting supplier quotations into one structured comparison with commercial gaps exposed.","lighting procurement, supplier quotations"),
("electrical","Electrical Supplier Quote Comparison","Compare electrical-material supplier quotes without losing unit, quantity, lead-time or payment-term differences.","electrical procurement, supplier quotes"),
("import","Import Supplier Quote Comparison","Compare overseas supplier quotes while preserving currencies, MOQs, freight notes and unknowns.","import sourcing, supplier quotations"),
("hospitality","Hospitality Supplier Quote Comparison","Compare food, beverage, equipment and service supplier quotations in one decision packet.","hospitality procurement, supplier quotes"),
("packaging","Packaging Supplier Quote Comparison","Normalize packaging supplier quotes across quantities, unit prices, MOQs and lead times.","packaging procurement, supplier quotes"),
("ecommerce","E-commerce Supplier Quote Comparison","Compare manufacturer and wholesale quotations before placing the next purchase order.","ecommerce sourcing, supplier quotes"),
("wholesale","Wholesale Supplier Quote Comparison","Turn multiple wholesale quotations into an auditable side-by-side comparison.","wholesale procurement, supplier quotes"),
("operations","Operations Procurement Quote Comparison","Compare recurring supplier quotations and expose missing commercial terms before approval.","operations procurement, supplier comparison"),
]
template=lambda slug,title,desc,keywords:f'''<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} | DreamLedger</title><meta name="description" content="{html.escape(desc)}"><meta name="keywords" content="{html.escape(keywords)}"><link rel="canonical" href="https://dreamledger.org/quote-comparison/{slug}"><meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(desc)}"><meta property="og:type" content="website"><style>body{{margin:0;background:#090909;color:#eee;font:16px/1.55 system-ui,sans-serif}}main{{max-width:820px;margin:auto;padding:48px 20px 90px}}.k{{color:#d5b45c;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:12px}}h1{{font-size:46px;line-height:1.05;margin:16px 0}}.card{{border:1px solid #333;background:#111;padding:24px;margin:24px 0}}.price{{font-size:30px;font-weight:900;color:#d5b45c}}a{{color:#d5b45c}}li{{margin:10px 0}}</style></head><body><main><div class="k">DreamLedger · Automated procurement</div><h1>{html.escape(title)}</h1><p>{html.escape(desc)}</p><div class="card"><div class="price">NZ$49 one-time</div><p>Upload 2–5 supplier quotes and the purchase requirements after payment. The system extracts, normalizes, compares, preserves unknowns, builds an evidence-backed decision packet and delivers it digitally.</p><ul><li>PDF, CSV, JSON or Markdown inputs</li><li>Supplier, totals, MOQ, lead time and payment terms</li><li>Source hashes and extraction evidence</li><li>No invented values when quotes are incomplete</li><li>Zero operator fulfilment for the paid service</li></ul><p><a href="https://buy.stripe.com/14AdN97LD6pLfuLdVadwc32?utm_source=organic&utm_medium=search&utm_campaign=quote_comparison&utm_content={slug}">Start the NZ$49 quote comparison</a></p></div><p><a href="/quote-comparison">See the core quote comparison service</a></p></main></body></html>'''
for slug,title,desc,keywords in cases:
    (ROOT/"quote-comparison").mkdir(parents=True,exist_ok=True)
    (ROOT/"quote-comparison"/f"{slug}.html").write_text(template(slug,title,desc,keywords),encoding="utf-8")
(ROOT/"quote-comparison"/"index.html").write_text(template("index","Supplier Quote Comparison","Compare 2–5 supplier quotations automatically and receive a decision-ready evidence packet.","supplier quote comparison, procurement, RFQ, bid comparison"),encoding="utf-8")
sitemap=["https://dreamledger.org/quote-comparison/"]+[f"https://dreamledger.org/quote-comparison/{slug}" for slug,_,_,_ in cases]
(ROOT/"quote-comparison-sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f"<url><loc>{u}</loc><changefreq>weekly</changefreq></url>" for u in sitemap)+"</urlset>\n",encoding="utf-8")
print("GENERATED",len(sitemap),"quote comparison acquisition pages")
