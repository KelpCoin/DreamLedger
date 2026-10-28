# Substack ingester: setup

## What it does
Every 3 hours on a small cloud box: fetches the RSS feed of each publication you list (publicly exposed content only; paywalled posts arrive as previews), dedupes, strips HTML, flags suspicious text, and when there is something new writes a **bundle** (`articles.jsonl`, `digest.md`, `SHA256SUMS.txt`) to `outbox/`. The digest lists new articles, feed problems, your watchlist counts and rising terms (recent 7 days vs prior 28; withheld until there is enough history).

## PRIVATE / no website publishing
- All chosen feeds, cached posts, article records, digests, watchlists, research derivatives and knowledge-base files are **personal research**. Never put them under DreamLedger's `public/` folder, in public GitHub source history, a web-served output directory, a public workflow artifact, or a customer-facing SKU.
- The CLI now refuses research state, feed config, bundle imports and BECK evidence exports to the public repository or a known public webroot. Set `BECK_PUBLIC_WEBROOT` if your private server has an additional web-served folder.
- With no explicit `--db` and `--outbox`, local polling defaults to `~/.local/share/beck/substack-ingest/`. Supply an explicit, private `--config` path. The systemd unit already uses `/etc/substack-ingest/config.json` and `/var/lib/substack-ingest/` on its server.
- **Truth Oracle exception:** an original article/report may only be drafted for separate, source-verified human editorial review, with author-rights assessment and explicit Biggie + Peggy approval of that particular publication or sale. There is no automatic handoff from ingestion into publishing, checkout or product generation.
- This standalone code module currently resides in a public GitHub repository, but research content is neither tracked there nor included in the public website deploy.

## What it deliberately does NOT do
* No LLM in the cloud: summarising happens on your side from the bundle (use bec_engine's structured gate with a local model), so no API keys or article text go to third parties.
* No scraping behind paywalls and no login. Check each publication's terms; keep the articles for personal reading and analysis, do not republish them.
* No fully hands-free hop into an air-gapped machine. That hop is the courier step you already use (USB), by design.

## Install (VPS, Linux)
1. `useradd -r -m ingest`; copy this folder's `substack_ingest/` to `/opt/substack-ingest/`.
2. `mkdir -p /etc/substack-ingest /var/lib/substack-ingest && chown ingest /var/lib/substack-ingest`. Create `/opt/substack-ingest/.venv` with `python3 -m venv /opt/substack-ingest/.venv`, then ` /opt/substack-ingest/.venv/bin/pip install -r /opt/substack-ingest/requirements.txt`. `defusedxml` is mandatory and fails closed if missing.
3. Make sure the installed `substack_ingest` source and `requirements.txt` are readable by the `ingest` user. Copy `config.example.json` to `/etc/substack-ingest/config.json`; replace the feeds with publications you actually read: `https://<publication>.substack.com/feed` (custom-domain publications usually serve `/feed` too; open it in a browser to confirm it is XML).
4. Copy `substack-ingest.service` and `.timer` to `/etc/systemd/system/`; `systemctl enable --now substack-ingest.timer`.
5. First run now: `systemctl start substack-ingest` then `ls /var/lib/substack-ingest/outbox`; `journalctl -u substack-ingest`.
6. Firewall: no inbound ports needed except SSH. This service only makes outbound HTTPS calls.

## One-shot real RSS compatibility check (required before production polling)
`/opt/substack-ingest/.venv/bin/python -m substack_ingest probe --url https://www.oneusefulthing.org/feed --out /var/lib/substack-ingest/live-probe.json`
This downloads one public RSS feed, compares the XML item count to parsed and imported records, verifies the temporary three-file bundle, and writes only metadata. It uses no cookie, no paywall bypass, and saves no real article text in the proof. On failure, inspect the error and DO NOT enable automatic feed polling. A CI workflow can perform the same single public request without any user machine access.

## BECK quarantine adapter (after VERIFIED local import)
Run `python -m substack_ingest beck-export --kb <folder> --out <folder>/beck-research-evidence.json`. This produces only aggregate counts, content-hash evidence and `may_trigger_checkout_or_publication:false`; no raw article text is passed to Gauntlet/Arbitrator. Research is an untrusted hint, not permission to create a SKU or spend money.

## Getting bundles to you without touching it
Pick one:
* **Syncthing** (or rclone) syncing `outbox/` to your home PC: fully automatic. Then on the home PC `python -m substack_ingest import <bundle> --kb <folder>` (verifies hashes first), or carry bundles to the air-gapped machine by USB and run the same command there.
* **Manual**: `scp -r` the newest bundle folder when you want it.
* Email delivery of `digest.md` is not built (credentials in the cloud, untested path). Ask if you want it.

## Failure points, two fallbacks each
| Failure | Fallback 1 | Fallback 2 |
|---|---|---|
| Feed down/changed | exponential backoff (5 min doubling, cap 6 h) | shown under "Feed problems" in the digest; remove or fix the URL |
| Feed returns garbage/huge/XML bomb | rejected (5 MB cap, DTD/ENTITY refused) | counted as a failure, backoff as above |
| Redirect to internal address | every hop re-checked, non-public IPs refused | egress firewall on the VPS (block 169.254.0.0/16, 10/8, etc.) |
| Duplicate/edited posts | dedupe by feed+guid | `text_sha256` stored so you can spot edits later |
| Bundle corrupted in transit | `verify` refuses it | re-sync from the VPS outbox (kept until you delete) |
| VPS dies | timer restarts after reboot (`Persistent=true`) | state is one SQLite file + outbox: copy it to a new box |

## Security notes (read)
* Imported article text is **untrusted input**. Flagged items (injection-pattern, hidden characters) are marked in the digest and in the KB front matter (`untrusted: true`). Never feed article text to an agent that has tools or secrets without a schema gate and human review.
* DNS rebinding between the guard's lookup and the connection is not fully closed in stdlib; the egress firewall in the table is the real backstop.
* Rising terms are word counts over a handful of newsletters: a prompt for you to look, not evidence of a trend.

## Operational limits and trust boundaries
- SHA-256 manifests detect accidental edits but DO NOT authenticate the author or cloud box. For adversarial tampering, use signed manifests with pinned owner keys and a trusted signing environment; not implemented.
- The application revalidates DNS on redirects but does not pin the resolved address to the socket; enforce network egress blocking private, loopback, metadata and link-local destinations in the VPS firewall.
- No cloud subscription credentials or `substack.sid` cookie. Paid posts remain public-feed previews only.
- All KB content is untrusted, even if keyword flags are empty. Do not pass external post text or newsletter prose to any executor with secrets/tool permissions.
- No automatic installation of a VPS, Syncthing pair, Windows task, email delivery or paid endpoint is performed by this repository.
