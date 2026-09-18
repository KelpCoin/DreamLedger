# Blend progress: PHINHAVEN game + membership tiers + TCG/digital arbitrage pipelines

**Date:** 2026-09-18  
**Environment:** Designed for air-gapped / local-first construction. No live connectors required to author, review, or unit-test these artifacts.  
**Revenue boundary (unchanged):** Game activity is NOT DreamLedger business revenue. Patreon/Discord/crypto/TCG work is design + pipeline scaffolding only. No fabricated payments, no claimed sales, no auto-execution against live markets.

## 1. PHINHAVEN Floor 1 — The Shallows (continued)

Carry-forward from `PROOF/PHINHAVEN-FLOOR1-SHALLOWS-AVATAR-PROGRESS-2026-09-18.md`.

### Content outline (air-gapped design only)

- **Name:** The Shallows
- **Tone:** shallow coastal / tidal pools / kelp fringe; low danger, high readability for first-session players.
- **Loop targets (MVP vertical slice):**
  - Enter sanctuary → link / create avatar → enter The Shallows
  - Move, one resource node type, one enemy family, one mini-boss or clear condition
  - Return or die with clear inventory consequence
  - Persistent world-response flag after first clear (authoritative)
- **Cosmetic hook:** linked avatar appearance (own-only) surfaces in the Shallows sprite; tier cosmetics (below) can later tint or unlock variants without combat power.

### Appearance contract (still open jsonb, still defensive)

Recommended optional keys the client may read if present:

```json
{
  "primary_color": "#4ecdc4",
  "label": "display name override",
  "cosmetic_ids": ["founder_banner_01"],
  "source": "linked_avatar"
}
```

Client rule: missing keys → existing hue system. Never trust client-supplied appearance for other players.

## 2. Membership marriage: Patreon + Discord → PHINHAVEN access / cosmetics

Goal: one coherent entitlement model that can later map external memberships into game-facing non-power cosmetics and community roles. Design only; no live webhook wiring in this packet.

### Tier ladder (proposed, adjustable)

| Tier key          | External sources (examples)      | Intended PHINHAVEN grant                         | Discord role hint   |
|-------------------|----------------------------------|--------------------------------------------------|---------------------|
| free              | none                             | base play, default hue                           | @Citizen            |
| supporter         | Patreon $X / Discord boost       | one cosmetic tint or title                       | @Supporter          |
| founder           | early Patreon / special offer    | founder banner + exclusive label                 | @Founder            |
| haven_keeper      | higher Patreon                   | additional cosmetics + priority social hub flair | @HavenKeeper        |

Rules:

- Cosmetics and titles only for the first commercial surface (aligned with master contract §11).
- No combat power, no currency mint, no inventory bypass from tiers.
- Entitlement is recorded in an authoritative table; Discord/Patreon are *sources of truth signals*, not the game authority.

### Minimal entitlement schema (offline-friendly)

```sql
-- Design sketch only. Not applied by this commit.
CREATE TABLE IF NOT EXISTS public.phinhaven_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  tier_key text NOT NULL,
  source text NOT NULL,          -- 'patreon' | 'discord' | 'stripe' | 'manual' | 'test'
  external_ref text,             -- member id / event id
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cosmetic_ids text[] DEFAULT '{}',
  meta jsonb DEFAULT '{}'::jsonb,
  UNIQUE (player_id, tier_key, source)
);
```

Idempotency: same external_ref + source must not double-grant.

### Discord role mapping (config, not live bot)

```json
{
  "roles": {
    "supporter": { "discord_role_id": "REPLACE_ME", "tier_key": "supporter" },
    "founder": { "discord_role_id": "REPLACE_ME", "tier_key": "founder" },
    "haven_keeper": { "discord_role_id": "REPLACE_ME", "tier_key": "haven_keeper" }
  },
  "sync_mode": "pull_on_login_or_webhook",
  "never_grant_power": true
}
```

## 3. Air-gapped TCG / digital arbitrage pipeline (design)

Reusable pipeline shape for MTG (and similar TCG) price observation → signal → human or gated action. Built so the logic can run fully offline against recorded snapshots.

### Pipeline stages

1. **Ingest** — local CSV / JSON snapshots of ask/bid / sold prices (no live API required for development).
2. **Normalize** — card identity key (set + collector number + condition + language).
3. **Spread compute** — buy venue vs sell venue, fees, shipping, time risk.
4. **Score** — expected edge after costs; confidence from sample size / volatility.
5. **Alert** — only when score ≥ threshold and data freshness OK.
6. **Gate** — human approval or hard policy before any external action.
7. **Ledger** — every considered opportunity and outcome recorded for later review.

### Decision rules (example, tunable offline)

```text
IF (sell_price - buy_price - fees - shipping) / buy_price >= min_edge
AND sample_count >= min_samples
AND data_age_hours <= max_age
AND condition_match == true
THEN emit_alert(opportunity)
ELSE ignore
```

Default starting knobs (change freely):

- min_edge: 0.12 (12%)
- min_samples: 3
- max_age_hours: 24

### Alert schema (shared)

```json
{
  "alert_id": "uuid",
  "kind": "tcg_arbitrage",
  "created_at": "ISO-8601",
  "card_key": "SET-COLLECTOR-CONDITION",
  "buy_venue": "string",
  "sell_venue": "string",
  "buy_price": 0.0,
  "sell_price": 0.0,
  "fees_estimate": 0.0,
  "edge_ratio": 0.0,
  "confidence": 0.0,
  "data_age_hours": 0,
  "status": "open|acknowledged|acted|expired|rejected",
  "notes": ""
}
```

Crypto / digital arbitrage can reuse the same stages with different normalizers (pair, venue, fee schedule). Same alert envelope, different `kind`.

### Local runner sketch (Python, offline)

```python
# airgap_tcg_pipeline.py — design only
# Inputs: local snapshots under ./data/snapshots/
# Outputs: ./out/alerts.jsonl and ./out/ledger.jsonl

def load_snapshots(path):
    ...

def normalize(card_row):
    ...

def score_opportunity(buy, sell, fees):
    edge = (sell - buy - fees) / buy if buy else 0
    return edge

def emit_alert(opp):
    # append JSON line; never auto-executes trades
    ...

def main():
    for snap in load_snapshots("./data/snapshots"):
        for opp in find_opportunities(snap):
            if score_opportunity(...) >= MIN_EDGE:
                emit_alert(opp)
```

No network calls required for the offline path.

## 4. How the pieces marry

- **Game (The Shallows)** gives a reason for people to care about identity/cosmetics.
- **Patreon / Discord tiers** grant those cosmetics and community roles without power creep.
- **TCG / digital arbitrage pipelines** are a separate operator tool: same alert/ledger discipline, can later fund or inform commerce, but remain gated and auditable.
- **Alerts** are the common language across membership events, game world-responses, and market signals.

Nothing in this packet claims a live sale, a live bot, or a completed Godot runtime.

## 5. Next air-gapped build steps

1. Flesh The Shallows encounter table (1 enemy family, 1 resource, clear condition) as pure data files.
2. Write a tiny offline test harness for the TCG pipeline against synthetic snapshots.
3. Freeze the entitlement schema and a sample seed for free / supporter / founder.
4. Keep Discord/Patreon role IDs as config placeholders until a human connects them.
5. Only after canonical runtime recovery: implement the own-appearance RPC and client fallback for real.

## 6. Visibility

Written to the canonical repo so progress is on disk for all operators.
