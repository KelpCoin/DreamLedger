# Blockers to a truly autonomous revenue engine

**Written to GitHub for operator + every LLM on the bus.**  
**Date:** 2026-09-22  
**Meter truth:** verified external revenue remains **NZ$0** until live external settle + fulfil + fossil.

This file atomizes failure modes and missing links. It does not claim the engine is autonomous.

---

## Top blockers (read these first)

| Rank | Blocker | Class |
|------|---------|--------|
| 1 | **No external paying demand** (strangers not buying) | World / distribution |
| 2 | **Live Stripe secret not proven in Actions** for Settlement Sync | Operator secrets |
| 3 | **Webhook → production not proven end-to-end** for fulfil | Operator / infra |
| 4 | **Human still required for demand pulse** (post links) | Autonomy gap |
| 5 | **Face still partly manual** vs compiler-owned | Scale / drift |
| 6 | **Local multi-LLM autonomy unproven** | LOCAL_AUTONOMY_UNPROVEN |
| 7 | **Performance Wall not yet production-wired** from live webhook | Integration |
| 8 | **Multi-offer settlement** (NZ$29 + NZ$50 + more) incomplete | Config |
| 9 | **Sentinel feeds not live** (demand/intent) | Observability |
| 10 | **Chat mistaken for continuity** without AGENT_BUS writes | Process |

---

## Atomized blocker list (1–250)

### A. Demand & distribution (1–40)

1. No consistent owned-channel posting cadence  
2. Share pack not executed this week  
3. Cold spam avoided correctly but warm channels unused  
4. Truth Oracle surface not driving storefront CTAs  
5. SEO / discoverability weak for Kiwi commercial queries  
6. No email list of external prospects  
7. No partner cross-posts  
8. Social proof empty (honest NZ$0)  
9. Brand unclear to strangers in 5 seconds  
10. Single CTA buried in multi-silo noise  
11. Payment links not pinned where humans look  
12. Agent-commerce discovery not marketed to agent builders  
13. No paid ads (may be intentional) without organic substitute  
14. Referral loop absent  
15. Press / community mentions absent  
16. NZ-local marketplace attention not captured  
17. Discord/community not converting to checkout  
18. Game attention not routed to settle lobe  
19. Billboard value prop not believed without traffic claims (correctly constrained)  
20. Diagnostic audience (MTG) not repeatedly reached  
21. Timezone posting suboptimal  
22. Link rot across old docs vs approved catalog  
23. Multiple conflicting Stripe URLs in circulation historically  
24. Trust friction: new domain, thin social proof  
25. Price anchoring vs Trade Me / Shopify expectations unclear  
26. “What do I get?” not wall-shaped in buyer mind yet  
27. No abandoned-checkout recovery (Intent notes not wired)  
28. No retargeting pixel policy  
29. Agent handoff checkout_url not used in the wild  
30. Demand Sentinel not ingesting live analytics  
31. Oracle queries not converted to D-SEARCH notes  
32. Share events not tracked as D-SHARE  
33. Returning visitors not tagged D-RETURN  
34. HOT corroboration band never computed on real data  
35. Distribution still human-gated (Ball C)  
36. No autonomous poster with approval policy  
37. Fear of spam correctly blocks bad channels but also blocks volume  
38. Household network exhausted  
39. International buyers face currency/trust friction  
40. Offer story not repeated enough to compound  

### B. Checkout & Stripe (41–70)

41. Buyer must complete hosted Checkout successfully  
42. Live mode required (test does not count)  
43. Correct Payment Link must match approved catalog  
44. Amount/currency mismatch rejects settlement  
45. Card declines / bank 3DS drop-offs  
46. Mobile checkout friction  
47. Success URL may not explain Performance Wall key clearly  
48. Email delivery of key not automated  
49. Customer confusion: what is a “tile” / “diagnostic”  
50. Addon flows (image) increase friction  
51. Stripe Dashboard misconfiguration risk  
52. Multiple plinks in wild vs single settlement target  
53. NZD-only may limit some buyers  
54. No subscription MRR path as primary (optional)  
55. Refunds/chargebacks not fully playbooked for wall  
56. Tax/invoice expectations for B2B  
57. Stripe Radar false positives  
58. Session expiry before pay  
59. Cross-device checkout abandon  
60. Wallet pay UX not optimized  
61. Clear statement of deliverable pre-pay incomplete on some faces  
62. Legal/policy links not always adjacent to CTA  
63. Accessibility of checkout CTA  
64. Locale/language limited  
65. Self-pay temptation pollutes experiments  
66. Team members testing with live mode by mistake  
67. Webhook endpoint URL wrong in Stripe  
68. Webhook secret rotated without host update  
69. Events selected incompletely in Stripe webhook config  
70. API version drift on Stripe objects  

### C. Webhook & fulfilment (71–110)

71. Signature verification must pass every time  
72. Handler must return 2xx quickly  
73. Idempotency on event.id / session id  
74. Performance Wall not wired in production handler yet  
75. Specialized billboard path still needs allocation truth  
76. Human review gate on some billboard content  
77. Image fetch/moderation latency  
78. Finite canvas exhaustion (long-term)  
79. MTG diagnostic engine availability  
80. Report generation timeout  
81. Discord kit delivery automation incomplete for all cases  
82. Physical SKUs correctly blocked but block “full catalog autonomy”  
83. Cubby TTL seal job not scheduled in prod  
84. Key shown once — recovery UX missing  
85. Claim rate limits not configured  
86. Cubby storage backend not chosen for prod (SQLite local only)  
87. No CDN for large digital payloads  
88. Payload_ref broken links  
89. Inline text size limits  
90. Multi-claim vs single-claim policy undecided per SKU  
91. VOID path for fraud  
92. Partial fulfilment ambiguity  
93. Webhook retries causing duplicate emails  
94. Async queue not provisioned  
95. Render cold start delays webhook  
96. Host env missing STRIPE_WEBHOOK_SECRET  
97. Marketplace webhook route drift vs compiled surface  
98. Proof scripts not run on schedule  
99. Fulfilment registry out of date vs approved offers  
100. operator_required true on products that should be wall-default  
101. Wall schema not migrated to Supabase  
102. Claim UI route `/wall/claim` not shipped on live face  
103. Success page doesn’t deep-link wall  
104. Email provider not connected  
105. SMS not available (optional)  
106. Buyer support path for “key lost”  
107. Timezone on expires_at edge cases  
108. Clock skew sealing early  
109. Backup fulfil if wall mint fails after charge  
110. Observability: no alert on fulfil fail after paid  

### D. Settlement meter & evidence dam (111–140)

111. Settlement Sync must run with live secret  
112. GitHub Actions environment settlement-read  
113. Artifact retention / retrieval discipline  
114. matching_paid_sessions stays 0 until stranger pays (expected)  
115. Wrong plink configured in workflow  
116. Parallel job for NZ$29 not configured  
117. Airtable optional confusion  
118. Fossil writer not automatic after wall claim  
119. Independent verification step still human  
120. BusinessTruth fields not updated by wall alone  
121. Loop registry instances_completed not auto-incremented  
122. Risk of manually bumping revenue (forbidden)  
123. Test sessions contaminating mental model  
124. Reconciliation JSON not reviewed  
125. Hash proof not archived long-term  
126. Multi-currency future not handled  
127. Partial capture edge cases  
128. Disputes after FOSSIL_SEALED  
129. Attribution email missing on session  
130. Entitlement not mapped to avatar cosmetics  
131. Cross-silo proof contamination risk  
132. Dam rules known but not enforced in every UI  
133. Agents claiming revenue in chat  
134. Green CI ≠ money  
135. Compiler PASS ≠ money  
136. Sentinel PASS ≠ money  
137. Checkpoint progress ≠ money  
138. Pending writes ≠ money  
139. HOT demand band ≠ money  
140. First-sale thread stages ≠ money until sealed with proof  

### E. Catalog, compiler, faces (141–170)

141. Manual face vs compiled website divergence  
142. Render deploy lag  
143. Public index hand-edited as source of truth  
144. CTA cards not compiler-emitted  
145. Silo slots empty (correct) mistaken for inventory  
146. Candidates mass not gauntlet-promoted carefully  
147. Approval gate bypass risk  
148. AutoRevenue packs historical noise  
149. Forbidden public tokens regression  
150. Phone-first policy not always reflected live  
151. Agent-commerce.json stale vs catalog  
152. Well-known discovery incomplete  
153. Multi-face registry not deployed  
154. Dreamledger.org composition MANUAL_LEGACY  
155. Compiler not in CI for every main push  
156. bec compile not operator muscle memory  
157. Gauntlet false confidence  
158. Offer schema drift  
159. Price display patch lag  
160. Silo isolation bugs  
161. Horizontal market UX still iterating  
162. Search/filter weak  
163. Fee messaging vs actual Stripe fees  
164. Trust badges absent  
165. Performance wall not in marketing copy  
166. Figure-eight not visible to buyers (ok) but ops forget dam  
167. Too many SKUs distract from Ball C  
168. New silo temptation before first sale  
169. Floor 2 expansion temptation  
170. Architecture churn vs distribution  

### F. Autonomy, agents, bus (171–200)

171. Fully autonomous revenue requires unattended demand (missing)  
172. Fully autonomous revenue requires unattended settle (partial)  
173. Fully autonomous revenue requires unattended fulfil (partial)  
174. AGENT_BUS requires agents to write handoffs  
175. Supabase half of bus needs other connector  
176. Bridge auth token gating (correct) blocks casual probes  
177. LM Studio council LOCAL_AUTONOMY_UNPROVEN  
178. GPU split multi-model unproven  
179. Worker lease double-completion risk  
180. Heartbeat second cycle unproven  
181. Cloud LLM budget/auth for offline PC  
182. Orchestrator tick without objectives  
183. Agents expand scope instead of Ball C  
184. Parallel mythologies  
185. Chat-as-source-of-truth regression  
186. Grok session without GitHub push (process failure)  
187. Husband cannot see work without main commits  
188. Multi-LLM disagreement without gauntlet  
189. Tool policy may over-block useful posts  
190. Tool policy may under-block spend  
191. No agent allowed to declare sale  
192. Approval-gated external actions still human  
193. Billboard content approval human  
194. Secrets rotation human  
195. Domain/DNS human  
196. Legal entity / bank human  
197. Tax filing human  
198. Dispute response human  
199. Strategy priority human  
200. Trust/reputation human time  

### G. Platform, security, ops (201–230)

201. Render service health  
202. Cold starts  
203. Rate limits  
204. DDoS on claim endpoint  
205. Key brute force  
206. SQLite not for multi-instance wall  
207. Postgres migration not done for wall  
208. Backup/restore of cubbies  
209. GDPR/privacy for buyer email  
210. Log redaction of keys  
211. Secret scanning false sense of safety  
212. Dependency vulnerabilities  
213. Node version drift  
214. Actions runner outages  
215. GitHub secret mis-scope  
216. Environment protection rules  
217. Concurrent settlement runs  
218. Clock skew  
219. Observability gaps (no single pane)  
220. Alerting fatigue or absence  
221. Runbook incomplete for 3am fail  
222. Owner bus factor = 1  
223. Fifteen months unpaid → fatigue  
224. Scope addiction vs one sale  
225. Under-documenting for next LLM  
226. Over-documenting without distribution  
227. Local PC off kills local workers  
228. Network partitions  
229. Stripe regional outages  
230. Certificate expiry  

### H. Product & market fit residual (231–250)

231. Tile value unclear to non-internet-native buyers  
232. Diagnostic quality vs price perception  
233. Wall metaphor not explained at checkout  
234. Competitive alternatives free  
235. Attention markets expensive  
236. NZ market small  
237. Global market trust harder  
238. Agent-commerce early market  
239. Protocol soup (ACP/UCP) distraction  
240. Framework churn (LangGraph etc.) distraction  
241. Persistence work ≠ customers  
242. Perfect fulfilment with zero demand = still NZ$0  
243. Perfect demand with broken webhook = angry buyers  
244. Perfect webhook with no meter = unknown truth  
245. Perfect meter with no fossil = weak BusinessTruth  
246. Autonomy theater without Ball C  
247. Measuring commits instead of `cs_`  
248. Measuring handoffs instead of external pay  
249. Measuring architecture instead of distribution  
250. **The single finest gradient:** no external human or agent has yet completed a live paid purchase that the dam accepts as verified revenue  

---

## What is NOT a blocker (already present)

- Approved offers + Payment Links  
- Settlement workflow code  
- Fulfilment registry for tile + diagnostic (ready flags)  
- Figure-eight + Performance Wall design on disk  
- AGENT_BUS continuity protocol  
- Honest NZ$0 meter discipline  

---

## Minimum path through the gradient

1. Post primary Payment Link (collapse blockers 1–40 partially)  
2. Confirm secrets + webhook (41–110 critical subset)  
3. One stranger pays  
4. Wall or specialized fulfil  
5. Settlement Sync + fossil (111–140)  
6. Only then talk autonomy expansion  

**Truly autonomous** additionally requires unattended demand + unattended ops (171–200)—not claimed today.
