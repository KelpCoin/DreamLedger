# Agent Bridge Toll Road — 200 Monetization Paths

**Canonical for agents/operators.** Bridge as toll road: discovery free-ish, work metered, gauntlet paid, routes leased.

## Pricing posture
- Micro-tolls: **~$0.01–$0.10** per event (default **$0.02**)
- Route lease: **~$5–$200/mo** by exclusivity/SLA
- Gauntlet: **~$0.50–$5** per human decision (packs cheaper)
- Settlement for human goods remains **Stripe**; bridge meters **access & decisions**
- Never claim revenue without payment evidence

## Productize order
1. Meter authenticated work (events/jobs) at $0.02
2. Sell named **route leases** (pipelines)
3. Sell **Gauntlet-as-a-Service** packs
4. Sell trust/attestation
5. Small cut on **agent-originated** commerce

## 1–40 MICRO_TOLL
1. **[MICRO_TOLL]** Charge $0.02 per authenticated bridge event ingest
2. **[MICRO_TOLL]** Charge $0.05 per structured event with proof schema validation
3. **[MICRO_TOLL]** Charge $0.01 per GET /api/offers scrape beyond free tier (100/day)
4. **[MICRO_TOLL]** Charge $0.03 per agent job claim (lease start)
5. **[MICRO_TOLL]** Charge $0.02 per job heartbeat renewal
6. **[MICRO_TOLL]** Charge $0.10 per job complete with proof hash
7. **[MICRO_TOLL]** Charge $0.05 per correlation-id lookup across event history
8. **[MICRO_TOLL]** Charge $0.02 per rate-limit burst token
9. **[MICRO_TOLL]** Charge $0.01 per silo-scoped discovery query
10. **[MICRO_TOLL]** Charge $0.08 per cross-silo route (mtg→commerce etc.)
11. **[MICRO_TOLL]** Charge $0.02 per webhook delivery attempt through bridge
12. **[MICRO_TOLL]** Charge $0.15 per failed-then-retry lease (congestion pricing)
13. **[MICRO_TOLL]** Charge $0.01 per manifest poll after free 10/hour
14. **[MICRO_TOLL]** Charge $0.25 per human-approval gate invocation (gauntlet step)
15. **[MICRO_TOLL]** Charge $0.05 per agent identity attestation check
16. **[MICRO_TOLL]** Charge $0.02 per HMAC signature verify
17. **[MICRO_TOLL]** Charge $0.10 per durable note write to control ledger
18. **[MICRO_TOLL]** Charge $0.03 per read of control_bridge_notes beyond free window
19. **[MICRO_TOLL]** Charge $0.50 per emergency priority lane skip-the-queue
20. **[MICRO_TOLL]** Charge $0.02 per geo/region tag on a route
21. **[MICRO_TOLL]** Night-offpeak $0.01 vs peak $0.04 per event (time-of-day toll)
22. **[MICRO_TOLL]** Volume ladder: first 1k events free, then $0.02
23. **[MICRO_TOLL]** Prepaid packet of 10,000 events at $150 ($0.015 effective)
24. **[MICRO_TOLL]** Postpaid monthly settle with 10% premium vs prepaid
25. **[MICRO_TOLL]** Per-seat agent token: $9/mo includes 5k events
26. **[MICRO_TOLL]** Per-org bridge key: $49/mo includes 50k events
27. **[MICRO_TOLL]** Overage $0.03/event after plan cap
28. **[MICRO_TOLL]** Soft-cap warning webhook free; hard-cap block until top-up
29. **[MICRO_TOLL]** Charge $0.02 per idempotent replay (still costs infra)
30. **[MICRO_TOLL]** Charge $0.20 per non-idempotent duplicate (penalty toll)
31. **[MICRO_TOLL]** Charge $0.05 per schema-version negotiation
32. **[MICRO_TOLL]** Charge $0.01 per health check after free 100/day
33. **[MICRO_TOLL]** Charge $0.10 per public→private surface promotion
34. **[MICRO_TOLL]** Charge $0.02 per CUBE cell address resolution
35. **[MICRO_TOLL]** Charge $0.07 per multi-agent fan-out (1→N next_agents)
36. **[MICRO_TOLL]** Charge $0.02 × N for N downstream agent notifies
37. **[MICRO_TOLL]** Charge $0.12 per court/gauntlet review request
38. **[MICRO_TOLL]** Charge $0.30 per court verdict sealed to ledger
39. **[MICRO_TOLL]** Charge $0.05 per evidence attachment under 1MB
40. **[MICRO_TOLL]** Charge $0.25 per evidence attachment 1–10MB

## 41–80 ROUTE_LEASE (pipelines per route)
41. **[ROUTE_LEASE]** Lease named route /rail/{tenant}/{purpose} for $20/mo
42. **[ROUTE_LEASE]** Lease exclusive route ID for $99/mo
43. **[ROUTE_LEASE]** Lease shared route (contended) for $9/mo
44. **[ROUTE_LEASE]** Lease burst capacity 100 concurrent leases for $40/mo
45. **[ROUTE_LEASE]** Lease 900s TTL job pipeline slot pack (10 slots) $15/mo
46. **[ROUTE_LEASE]** Lease Worker-A only lane $25/mo
47. **[ROUTE_LEASE]** Lease Worker-A+B dual verification lane $60/mo
48. **[ROUTE_LEASE]** Lease BRIDGE_PROVEN_CANDIDATE seal lane $80/mo
49. **[ROUTE_LEASE]** Lease discovery-only route (no write) $5/mo
50. **[ROUTE_LEASE]** Lease write-enabled route $30/mo
51. **[ROUTE_LEASE]** Lease silo-locked route (mtg only) $18/mo
52. **[ROUTE_LEASE]** Lease multi-silo passport route $55/mo
53. **[ROUTE_LEASE]** Lease ephemeral 24h route for hackathon $3
54. **[ROUTE_LEASE]** Lease weekend event route $12
55. **[ROUTE_LEASE]** Lease permanent vanity route slug $200 one-time + $10/mo
56. **[ROUTE_LEASE]** Sublease marketplace: tenants resell capacity (platform 15%)
57. **[ROUTE_LEASE]** Route bond: $50 refundable if no abuse 90 days
58. **[ROUTE_LEASE]** Congestion multiplier 2× when queue depth high
59. **[ROUTE_LEASE]** Reserved capacity 99.5% availability $150/mo
60. **[ROUTE_LEASE]** Best-effort unmetered off-peak lease $8/mo
61. **[ROUTE_LEASE]** Pipeline stage toll: LEASE_ISSUED $0.02
62. **[ROUTE_LEASE]** Pipeline stage toll: WORKER_A_RESULT $0.03
63. **[ROUTE_LEASE]** Pipeline stage toll: WORKER_B_RESULT $0.05
64. **[ROUTE_LEASE]** Pipeline stage toll: BRIDGE_PROVEN $0.10
65. **[ROUTE_LEASE]** Sell pipeline templates (checkout/fulfil/refund) $29 each
66. **[ROUTE_LEASE]** Custom pipeline design workshop $299
67. **[ROUTE_LEASE]** Lease webhook egress IP allowlist slot $12/mo
68. **[ROUTE_LEASE]** Lease signed callback URL registration $6/mo
69. **[ROUTE_LEASE]** Lease dead-letter queue access $15/mo
70. **[ROUTE_LEASE]** Lease replay window 7-day $20/mo
71. **[ROUTE_LEASE]** Lease replay window 30-day $45/mo
72. **[ROUTE_LEASE]** Lease audit export API $35/mo
73. **[ROUTE_LEASE]** Lease multi-region route pin $70/mo
74. **[ROUTE_LEASE]** Lease canary route (10% traffic) $10/mo
75. **[ROUTE_LEASE]** Lease shadow route (mirror, no side effects) $8/mo
76. **[ROUTE_LEASE]** Lease quarantine route for risky agents $22/mo
77. **[ROUTE_LEASE]** Lease partner white-label route namespace $120/mo
78. **[ROUTE_LEASE]** Lease academic/research discounted route $3/mo
79. **[ROUTE_LEASE]** Lease nonprofit route with attestation $4/mo
80. **[ROUTE_LEASE]** Lease government/procurement route with SLA $200/mo

## 81–120 GAUNTLET (as a service)
81. **[GAUNTLET]** Single human-approval ticket $1
82. **[GAUNTLET]** Pack: 20 approvals $15
83. **[GAUNTLET]** Unlimited seat $79/mo (fair use)
84. **[GAUNTLET]** Rush: 15-minute SLA $5/ticket
85. **[GAUNTLET]** Async: 24h SLA $0.50/ticket
86. **[GAUNTLET]** Dual-control (two humans) $3/ticket
87. **[GAUNTLET]** Policy pack: spend limits $25
88. **[GAUNTLET]** Policy pack: geo-block $15
89. **[GAUNTLET]** Policy pack: SKU allowlist $15
90. **[GAUNTLET]** Policy pack: agent identity allowlist $20
91. **[GAUNTLET]** Pre-built gauntlet ecommerce checkout $49
92. **[GAUNTLET]** Pre-built gauntlet refund authorization $39
93. **[GAUNTLET]** Pre-built gauntlet data export $39
94. **[GAUNTLET]** Pre-built gauntlet production deploy $59
95. **[GAUNTLET]** Audit log export $10/mo
96. **[GAUNTLET]** SSO integration setup $199 one-time
97. **[GAUNTLET]** Slack/Discord approval bot $29/mo
98. **[GAUNTLET]** Email magic-link approver $19/mo
99. **[GAUNTLET]** Mobile push approver $25/mo
100. **[GAUNTLET]** On-call rotation scheduler $35/mo
101. **[GAUNTLET]** Declined decision still $0.25 (decisioning cost)
102. **[GAUNTLET]** Appeal of deny $2
103. **[GAUNTLET]** Training mode (shadow, no block) $9/mo
104. **[GAUNTLET]** Simulation suite for agent builders $49
105. **[GAUNTLET]** White-label gauntlet UI $99/mo
106. **[GAUNTLET]** Compliance evidence pack for auditors $150/report
107. **[GAUNTLET]** Managed human operators $500/mo retainer
108. **[GAUNTLET]** Agent-to-agent spend proposals $0.40/review
109. **[GAUNTLET]** Model tool-use permission $0.20/review
110. **[GAUNTLET]** PII-access requests $0.60/review
111. **[GAUNTLET]** Bank/payout changes $2/review
112. **[GAUNTLET]** Production secret access $3/review
113. **[GAUNTLET]** Business-hours-only cheaper tier
114. **[GAUNTLET]** 24/7 coverage premium +50%
115. **[GAUNTLET]** Trust rating API $0.01/query
116. **[GAUNTLET]** Gauntlet-passed receipt $1
117. **[GAUNTLET]** Enterprise custom SLA $1k+/mo
118. **[GAUNTLET]** SDK self-host edge license $199 one-time
119. **[GAUNTLET]** Red-team / pen-test day $1,500
120. **[GAUNTLET]** Policy marketplace (20% take)

## 121–150 TRUST_TOLL
121. **[TRUST_TOLL]** $0.10 per proof.schema.json validation
122. **[TRUST_TOLL]** $0.50 per payment-evidence attestation vs Stripe
123. **[TRUST_TOLL]** $1 per ledgered-claim certification
124. **[TRUST_TOLL]** $0.05 per offer integrity check
125. **[TRUST_TOLL]** Merchant surface trust score $20/mo
126. **[TRUST_TOLL]** Agent identity trust score $10/mo
127. **[TRUST_TOLL]** Domain verification badge $5 one-time
128. **[TRUST_TOLL]** $0.02 per third-party crawl of agent contracts
129. **[TRUST_TOLL]** Institutional agent API key $300/mo
130. **[TRUST_TOLL]** Certified settlement report PDF $25
131. **[TRUST_TOLL]** Monthly silo trust digest $40
132. **[TRUST_TOLL]** Incident attestation letter $75
133. **[TRUST_TOLL]** Auditor read-only seat $150/mo
134. **[TRUST_TOLL]** Verified agent merchants directory $30/mo
135. **[TRUST_TOLL]** Escrow signal API $0.15/query
136. **[TRUST_TOLL]** Dispute evidence package $40
137. **[TRUST_TOLL]** Historical proof re-verify $0.20
138. **[TRUST_TOLL]** Anomaly watchdog alerts $25/mo
139. **[TRUST_TOLL]** High-risk route bond listing $100/mo
140. **[TRUST_TOLL]** Reputation repair after incidents $200
141. **[TRUST_TOLL]** Signed cross-agent references $5
142. **[TRUST_TOLL]** KYC/KYB before token issuance $2–20
143. **[TRUST_TOLL]** Sanctions screen add-on $0.08/check
144. **[TRUST_TOLL]** Age/region compliance gate $0.05
145. **[TRUST_TOLL]** Proof retention beyond 90d $0.001/proof/day
146. **[TRUST_TOLL]** Cold storage retrieval $2/request
147. **[TRUST_TOLL]** Legal hold on records $50/mo per matter
148. **[TRUST_TOLL]** Lawful process response $150/hr
149. **[TRUST_TOLL]** Trust API 99.9% SLA $200/mo
150. **[TRUST_TOLL]** Public transparency log $15/mo

## 151–180 COMMERCE_PLATFORM
151. **[COMMERCE_PLATFORM]** 0% on human offers; 2% on agent-originated checkouts
152. **[COMMERCE_PLATFORM]** $0.30 flat on agent checkouts under $10
153. **[COMMERCE_PLATFORM]** Agent checkout session toll $0.05
154. **[COMMERCE_PLATFORM]** Agent-ready storefront certification $99
155. **[COMMERCE_PLATFORM]** Extra product meters beyond 20: $1/product/mo
156. **[COMMERCE_PLATFORM]** Priority in agent offer ranking $20/mo
157. **[COMMERCE_PLATFORM]** Sponsored silo on horizontal rails $50/mo
158. **[COMMERCE_PLATFORM]** Affiliate 10% of first month route lease
159. **[COMMERCE_PLATFORM]** Pipeline template marketplace 15% take
160. **[COMMERCE_PLATFORM]** Gauntlet policy marketplace 20% take
161. **[COMMERCE_PLATFORM]** Discord kit + $5 bridge onboarding fee
162. **[COMMERCE_PLATFORM]** Diagnostic + $2 bridge receipt add-on
163. **[COMMERCE_PLATFORM]** Billboard + $5 agent-discoverable flag
164. **[COMMERCE_PLATFORM]** Seller audit + $3 publish trust score
165. **[COMMERCE_PLATFORM]** Bridge Console UI $29/user/mo
166. **[COMMERCE_PLATFORM]** Multi-tenant admin $99/mo
167. **[COMMERCE_PLATFORM]** Integration services $150/hr
168. **[COMMERCE_PLATFORM]** Fixed packages $499 / $1,499 / $4,999
169. **[COMMERCE_PLATFORM]** Training course $79
170. **[COMMERCE_PLATFORM]** Corporate workshop half-day $1,200
171. **[COMMERCE_PLATFORM]** Support 4h response $49/mo
172. **[COMMERCE_PLATFORM]** Dedicated Slack connect $99/mo
173. **[COMMERCE_PLATFORM]** Custom SLA with credits $250+/mo
174. **[COMMERCE_PLATFORM]** NZ-only processing premium $40/mo
175. **[COMMERCE_PLATFORM]** BYO-Supabase connector support $60/mo
176. **[COMMERCE_PLATFORM]** On-prem appliance license $2,000/year
177. **[COMMERCE_PLATFORM]** OEM embed revenue share 10%
178. **[COMMERCE_PLATFORM]** Conference demo+billboard package
179. **[COMMERCE_PLATFORM]** Hackathon free→paid conversion funnels
180. **[COMMERCE_PLATFORM]** Gov RFP projects using bridge as validation layer

## 181–200 EXPAND (anything & everything)
181. **[EXPAND]** HTTP proxy hop through bridge $0.01/req
182. **[EXPAND]** Short redirect /r/{code} $0.005/click
183. **[EXPAND]** LLM prompt relay + gauntlet $0.02 + model cost
184. **[EXPAND]** Agent memory slot 1MB $1/mo
185. **[EXPAND]** Scheduled bridge pings $0.01/run
186. **[EXPAND]** Multi-agent room $0.05/agent/session
187. **[EXPAND]** Auction congestion rights for hot routes
188. **[EXPAND]** Prepaid Black Friday capacity futures
189. **[EXPAND]** Optional compute-intensity surcharge
190. **[EXPAND]** Tip jar route humans→agent operators $1+
191. **[EXPAND]** Bounty board tasks via bridge 8% take
192. **[EXPAND]** Failed-fulfil insurance pool $0.005/event
193. **[EXPAND]** Naming rights on public stage names $500/year
194. **[EXPAND]** Observability capture $0.10
195. **[EXPAND]** Synthetic monitoring probes $15/mo per URL
196. **[EXPAND]** White-label status page $10/mo
197. **[EXPAND]** Incident war-room channel $25/day
198. **[EXPAND]** Merge tenant route graphs (M&A) $500 service
199. **[EXPAND]** Graceful route sunset + archive $20
200. **[EXPAND]** Legacy protocol adapter premium $0.04/call

---
Machine JSON: `AGENT_BUS/BRIDGE-TOLL-200.json`
