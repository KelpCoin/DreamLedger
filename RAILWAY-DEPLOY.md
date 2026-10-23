# Move DreamLedger to Railway (Agent Bridge + public site)

**Goal:** Get the Node engine live so Agent Bridge, toll routes, and the public site work for you, your husband, and your husband’s friend.

**Repo:** `KelpCoin/DreamLedger`  
**Start command:** `npm start` (runs `BEC-PRIME/start.js` with preloads)  
**Node:** >= 20

---

## 1. Create the Railway project (5 minutes)

1. Open **https://railway.app** and sign in with **GitHub** (same account that owns `KelpCoin/DreamLedger`).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select **KelpCoin/DreamLedger**.
4. Railway will detect Node and use `npm start` (also defined in `railway.json`).
5. Wait for the first deploy to finish. You get a public URL like `https://something.up.railway.app`.

If the build fails, open the deploy logs. Common fix: set **Root Directory** to `/` (repo root) and ensure the start command is `npm start`.

---

## 2. Environment variables (required for money + Bridge)

In Railway → your service → **Variables**, add the same secrets you used on Render. Do **not** commit these.

Minimum for Agent Bridge + commerce:

| Variable | Purpose |
|----------|---------|
| `PORT` | Railway sets this automatically — do not hardcode |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key (keep secret) |
| `STRIPE_SECRET_KEY` | Live or test secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (update after domain cutover) |
| Any other keys your toll / auth routes need | Copy from old Render dashboard if still accessible |

Redeploy after saving variables.

---

## 3. Confirm the engine is alive

In a browser or terminal:

```bash
curl -s https://YOUR-APP.up.railway.app/healthz
curl -s https://YOUR-APP.up.railway.app/version
```

You want JSON, not “Service Suspended”.

Then try the Bridge (expect 401/403 without a real key, not 503):

```bash
curl -s -w "\nHTTP:%{http_code}\n" -X POST "https://YOUR-APP.up.railway.app/api/toll/v1/bridge-events" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: railway-smoke-1" \
  -d '{"payload":{"smoke":true}}'
```

---

## 4. Attach dreamledger.org

1. Railway service → **Settings** → **Networking** → **Custom Domain** → add `dreamledger.org` (and `www` if you use it).
2. Railway shows the CNAME (or instructions).
3. In your DNS (Cloudflare or registrar):
   - Point `dreamledger.org` at Railway as instructed.
   - Remove old Render / onrender.com records.
4. Wait for DNS + TLS (usually a few minutes).

Then re-test:

```bash
curl -sI https://dreamledger.org/healthz
```

---

## 5. Stripe webhook (after domain is live)

1. Stripe Dashboard → Webhooks → add/update endpoint to  
   `https://dreamledger.org/...` (whatever path your app already uses).
2. Copy the new signing secret into Railway as `STRIPE_WEBHOOK_SECRET`.
3. Redeploy if needed.

---

## 6. Internal keys for the three of you

Once the site responds:

1. Issue free **internal** keys for Owner, Husband, Friend (or one shared internal key).
2. Each person posts one handoff event using schema `dreamledger.bridge.handoff.v1`  
   (see `AGENT_BUS/BRIDGE/OPERATOR-THREE-PERSON-READY.md`).
3. Confirm same payload → same receipt; different payload + same idempotency key → 409.

Public $19 pack stays closed until the 50c probe chain is proven.

---

## 7. Checklist

- [ ] Railway project linked to `KelpCoin/DreamLedger`
- [ ] Deploy succeeds (`npm start`)
- [ ] Env vars set (Supabase + Stripe minimum)
- [ ] `/healthz` and `/version` return JSON on Railway URL
- [ ] Custom domain `dreamledger.org` points at Railway
- [ ] Bridge POST returns non-503 (auth error is fine)
- [ ] Three internal keys or one shared internal key issued
- [ ] One handoff event posted by each person
- [ ] Stripe webhook updated for new host

---

## Notes

- `railway.json` in repo root sets start command to `npm start`.
- Static-only Cloudflare Pages restores HTML only; **Agent Bridge needs this Node process** — that is why Railway (or similar) is required for the Bridge.
- Do not put secrets in the repo or in chat.
- When Railway URL or `dreamledger.org` is live, re-run three smoke tests on the Bridge.
