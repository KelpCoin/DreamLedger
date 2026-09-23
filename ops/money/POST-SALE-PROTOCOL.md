# Post-sale protocol — first external dollar

**Trigger:** Stripe shows a **live** paid Checkout Session from someone who is not a test of “does checkout work” counted as revenue theatre. Prefer a real stranger or warm buyer who intended to purchase.

---

## Within 1 hour

1. **Stripe** — open session; confirm `livemode`, amount, currency NZD, not refunded.  
2. **Settlement Sync** — run workflow; confirm session recognised **if** plink aligned. If paid but not recognised → fix alignment before claiming meter.  
3. **Fulfil**  
   - **Tile:** allocate placement → review content → publish or request fix from buyer.  
   - **Diagnostic:** generate/deliver report; optionally mint Performance Wall key.  
4. **Notify buyer** — short human email/DM: thanks + what happens next + support contact.  
5. **Fossil / proof pack** — payment ref + fulfilment evidence + timestamps (existing fossil path).  
6. **Bus** — handoff note: session id prefix only if public; never paste secrets. Bump balls revenue **only** after fossil rules say so.

---

## Same day ambition

- Ask for **one** referral or quote (optional, not pushy).  
- If tile: screenshot of board for social proof (with buyer OK if needed).  
- Log time-to-fulfil (minutes) — target &lt; 24h for digital, &lt; 72h for tile publish.

---

## Do not

- Announce “we’re revenue positive” on public site chrome  
- Count refunds  
- Skip fulfilment because “architecture isn’t ready” — path exists  

---

## If payment exists but fulfilment blocked

1. Tell the buyer the truth and ETA.  
2. Fix blocker.  
3. Deliver.  
4. Only then seal proof.
