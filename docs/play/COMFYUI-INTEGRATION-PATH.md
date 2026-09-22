# ComfyUI integration path — Phin Haven / First Garden

## Product order (do not invert)

1. **Sexy social lobby** (chat-first) — `public/phin-haven.html`  
2. **Optional dive** — `public/phin-haven-dive.html`  
3. **ComfyUI image pipeline** — avatar moods, garden backdrops, cosmetic previews  
4. Money stays on the market spine (Stripe). Play is not revenue.

## Why ComfyUI

- Local or self-hosted generative control for “the game looks the part”
- Workflow graphs for: garden stills, DreamMeez cosmetics, dive room art
- Keeps IP on your GPU box; cloud only stores approved outputs if desired

## Suggested pipeline

```
Chat mood / equip event
  → job note (bridge or local queue)
  → ComfyUI workflow (API: /prompt)
  → image write to approved path or CDN
  → client shows image in garden-art / avatar slot
```

## Minimal API shape (later)

| Endpoint | Role |
|----------|------|
| `POST /api/play/comfy/garden-mood` | Queue garden backdrop |
| `POST /api/play/comfy/avatar-preview` | Queue cosmetic still |
| `GET  /api/play/comfy/job/:id` | Poll status |

Auth: same agent/play token fence as other internal routes.  
Do **not** expose raw ComfyUI to the public internet.

## Today

- Garden mood button is **local emoji proof** only  
- Wire ComfyUI after first-sale pressure eases or when art is the bottleneck  
