# DreamLedger → Railway — Simple handover

**Read this only.** Do the steps in order. Stop if something fails and fix that step before moving on.

You need:
- GitHub login (the one that owns KelpCoin/DreamLedger)
- Railway account (sign in with that same GitHub)
- Stripe secret key (from Stripe dashboard)
- Supabase URL + service role key (from Supabase dashboard)
- Access to DNS for dreamledger.org (usually Cloudflare)

---

## STEP 1 — Create the Railway project

1. Open your phone or computer browser.
2. Go to: **https://railway.app**
3. Click **Login** and choose **GitHub**.
4. Use the same GitHub account that owns the DreamLedger repo.
5. After login, click **New Project**.
6. Click **Deploy from GitHub repo**.
7. If it asks to install Railway on GitHub, click **Configure** / **Install** and allow access to **KelpCoin/DreamLedger** (or all repos).
8. Select the repo **KelpCoin/DreamLedger**.
9. Wait. Railway will start building. This can take 2–5 minutes.
10. When it finishes, you will see a service card. Click it.
11. Look for a public URL that ends in **`.up.railway.app`**.  
    Example: `https://dreamledger-production-xxxx.up.railway.app`
12. Copy that URL and keep it somewhere (Notes app is fine).

**Checkpoint:** Open that `.up.railway.app` URL in a browser.  
- If you see a page or JSON (not “Service Suspended”), Step 1 is done.  
- If the deploy failed, open the **Deployments** tab → click the failed deploy → read the red error. Most common fix: leave Root Directory empty and Start Command as `npm start`.

---

## STEP 2 — Add secret keys (Stripe + database)

The “database” is already Supabase. You only copy the keys into Railway.

1. In Railway, click your service.
2. Click the tab called **Variables**.
3. Click **+ New Variable** (or “Add variable”).
4. Add these one by one (name on the left, value on the right):

| Variable name | Where to get the value |
|---------------|------------------------|
| `NODE_ENV` | Type exactly: `production` |
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Same place → `service_role` key (secret — do not share) |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Can leave empty for now; add later after domain works |

5. After adding them, Railway usually redeploys by itself. If not, open **Deployments** and click **Redeploy**.
6. Wait until the new deploy is **Success**.

**Checkpoint:** Open  
`https://YOUR-APP.up.railway.app/healthz`  
in the browser. You want a small JSON response (e.g. `{"status":"ok"}`), not an error page.

---

## STEP 3 — Add the custom domain (dreamledger.org)

### 3A — Tell Railway about the domain

1. In Railway → your service → **Settings**.
2. Scroll to **Networking** (sometimes called Public Networking).
3. Click **Custom Domain** or **Add Domain**.
4. Type: `dreamledger.org`
5. Click Add / Confirm.
6. Railway will show a **CNAME target** — something like `xxxx.up.railway.app` or a specific host name.  
   **Copy that exact target.** You need it for DNS.
7. Optional: also add `www.dreamledger.org` the same way if you use www.

### 3B — Change DNS (Cloudflare example)

1. Open **https://dash.cloudflare.com** and select the domain **dreamledger.org**.
2. Click **DNS** → **Records**.
3. Find any record for `dreamledger.org` or `@` that points to Render / `onrender.com` / an old IP.  
   **Delete** or **Edit** it.
4. Click **Add record**:
   - Type: **CNAME**
   - Name: `@` (or `dreamledger.org` — whatever Cloudflare shows for the root)
   - Target: the value Railway gave you in 3A
   - Proxy status: start with **DNS only** (grey cloud). You can turn orange proxy on later if you want.
5. If you use www: add another CNAME for `www` → same Railway target (or as Railway instructed).
6. Save.

Wait 2–15 minutes. Railway’s domain page will change from “Pending” to active when the certificate is ready.

**Checkpoint:** In a browser open  
`https://dreamledger.org/healthz`  
You want the same JSON as the Railway URL.  
If it still shows “Service Suspended”, DNS is still pointing at the old Render service — check the DNS record again.

---

## STEP 4 — Tell me it’s live

Send one of these:

- The Railway URL: `https://….up.railway.app`  
- Or: “dreamledger.org is up”

Then the next person (or me) can run the Bridge smoke tests.

---

## STEP 5 — After the site is up (Bridge for the three of you)

1. Issue **internal** keys (not the paid $19 keys) for:
   - You
   - Your husband
   - Your husband’s friend
2. Each person posts one test event using the handoff schema in  
   `AGENT_BUS/BRIDGE/OPERATOR-THREE-PERSON-READY.md`.
3. Only after that, work on the 50c probe and the $19 public pack  
   (`AGENT_BUS/BRIDGE/MONETISATION-EVENT-PACK-19.md`).

---

## What I cannot do for you

- Log into Railway, Stripe, Supabase, or Cloudflare
- Paste your secret keys
- Change your DNS

Those four things require your login. Everything else is already written in the repo.

---

## If you get stuck

| Problem | What to check |
|---------|----------------|
| Deploy fails | Deployments → failed build log. Start command must be `npm start`. |
| Site still “Suspended” | DNS still points at Render. Fix Step 3B. |
| /healthz not found | Variables missing or deploy not finished. Redo Step 2. |
| Don’t know Stripe key | Stripe → Developers → API keys → Secret key. |
| Don’t know Supabase keys | Supabase → Project Settings → API. |

---

## One-line summary

Railway project from GitHub → paste Stripe + Supabase variables → add custom domain in Railway → point DNS at Railway → test `/healthz` → then Bridge keys for the three of you.
