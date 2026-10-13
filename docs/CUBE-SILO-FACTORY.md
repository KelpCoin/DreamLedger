# CUBE silo factory: MTG is the master

The only HTML shell is `public/mtg/index.html`. It loads `/silos/<slug>/silo.json`, reads the silo-isolated catalogue path from that manifest, and renders untrusted listing data through DOM APIs. The root `mtg/index.html` is a parity copy.

## Create a candidate

1. Create `silos/<slug>/silo.json` from the canonical manifest schema. Do not create a new HTML template.
2. Keep capability bindings as `ref:<capability-id>`; the registry at `runtime/cube/capability-registry.json` states whether each capability is implemented and verified.
3. Run `npm run silo:compile -- --manifest silos/<slug>/silo.json`.
4. Run `npm run verify:silo-factory`, `npm run verify:silo-capabilities`, and the MTG/commercial Gauntlets.
5. The compiler copies the MTG shell, changes only `data-silo`, creates an empty isolated catalogue, and creates compatibility aliases. It never copies inventory, payment links, sellers, or revenue claims.
6. Candidates remain build-gated and hidden from the active-only homepage directory until an explicit publication decision.

## Clone invariants

- MTG remains the master and has a 0 bps platform fee.
- Every other registered silo has a 500 bps fee.
- One silo, one manifest, one isolated catalogue, one CTA, one commercial wall.
- A catalogue starts empty. Only independently verified supply may populate it.
- A Stripe URL or a successful PaymentIntent is not proof of settled revenue, fulfillment, or delivery.
- Patreon/Discord membership and creator perks are capability adapters, not hardcoded silo templates. They remain disabled until verified event source, idempotent entitlement ledger, approval gate, role grant/revocation, and replay tests pass.
- The CUBE workflow can compile any manifest under `silos/<slug>/silo.json`; it writes generated artifacts to the working branch only, never auto-publishes main.

## Scaling

The factory is unbounded by a hand-authored page count. Scale means adding manifests backed by real demand and verified supply, not fabricating 1,000 live markets. Bulk generation must use Cube signal evidence and the same Gauntlet before publication. Failed candidates stay small; verified mechanisms may grow.

## Current truth

Music & Media is a build candidate with an empty catalogue. Capability refs exist in the registry, but several are explicitly unverified or not implemented. No external payment, buyer, fulfilled order, delivery proof, or revenue is claimed by this factory work.
