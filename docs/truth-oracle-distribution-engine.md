# Truth Oracle Distribution Engine

Status: CANDIDATE / READ-ONLY SPEC
Economic state: NZ$0 verified external revenue
Rule: testnet or simulated value never counts as revenue

Purpose
Turn Truth Oracle into a distribution engine: publish useful, evidence-backed public answers that attract search traffic, then offer fresher, personalized, threshold-based or real-time delivery through Discord/webhooks and paid reports.

Core loop
source collection -> normalization -> Truth Oracle verification -> freshness/evidence record -> public result -> traffic -> signup -> alert subscription -> paid delivery/report -> payment/fulfillment evidence -> DreamLedger -> CUBE learning

Initial verticals
1. Household savings: groceries, milk, eggs, fuel, power, broadband, mobile, insurance, subscriptions.
2. Shopping arbitrage: retailer price gaps, clearance, restock, historical price anomalies, shipping/currency differences.
3. MTG/TCG: NZ card price gaps, historical anomalies, buylist gaps, Commander demand vs price, collection audits.
4. Travel: airfare, nearby-airport/date arbitrage, hotel and rental price discrepancies.
5. Crypto/on-chain intelligence: stablecoin/exchange spreads, fees, funding, unlocks, liquidity and contract-event monitoring. Descriptive evidence only, not investment recommendations.
6. Agent/economic rails: externally observable bounty opportunities and settlement receipts, with testnet clearly separated from real-money outcomes.

Free layer
- Public permanent evidence pages.
- Search-oriented queries with a clear timestamp, source list, observed price/value, comparison and freshness.
- Examples: cheapest milk today; cheapest fuel in a region; MTG card price comparison; airfare price check.

Paid layer
- Real-time Discord/webhook alerts.
- Threshold alerts.
- Personalized watchlists.
- Higher-frequency refresh.
- Historical reports and audits.
- Bulk/collection analysis.
- Execution-ready opportunity reports where appropriate.

Evidence contract
Every published claim must retain source provenance, observed_at, freshness/expiry policy, verification status and evidence reference. Truth Oracle evidence is not automatically commercial truth. A paid event remains UNVERIFIED until actual settlement and fulfillment evidence exist.

CUBE role
CUBE treats each vertical as a candidate reusable commercial cell. It may sense demand, register adapters, collect observations, generate opportunities and route candidates. It must not mark revenue from traffic, clicks, testnet funds, model output or hypothetical savings.

Distribution metrics
Track impressions/visits, query usage, result views, CTA clicks, signup, alert activation, paid conversion, fulfillment, refund, retention and contribution. Do not optimize vanity traffic without conversion evidence.

Kill/hold rules
- No new production subsystem solely because the concept is interesting.
- No paid claim without verified evidence.
- No autonomous external outreach.
- No fake/test/simulated revenue.
- No mainnet spend or wallet funding without explicit approval.
- Prefer reuse of existing Truth Oracle, CUBE, DreamLedger, Discord and Stripe machinery.

First experiment
Build/verify the smallest public-to-paid path for one free price-intelligence query and one paid real-time alert. Do not build all verticals first.
