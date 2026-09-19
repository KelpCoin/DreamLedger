# Offline The Shallows session simulator

**File:** `PROOF/airgap/shallows_session_simulator.html`

## What it is

A single-file, air-gapped HTML demo of the Floor 1 loop:

- Enter The Shallows
- Explore / Gather Kelp Fronds / Fight Tide Skitters
- Clear at 6 fronds **or** 5 kills
- Death loses unbanked fronds, returns to sanctuary
- First clear logs a world-response message

No server. No accounts. No payments. Not the production client.

## How to run

Open the HTML file in any browser (double-click or `file://`). Works fully offline.

## Why it exists

Until a real Godot (or other) client is recovered or built, this is the smallest **playable** expression of the rules already written as design data. It does not close the production gap by itself; it proves the loop is coherent and gives operators something to click today.

## Relation to production

Production still needs:

1. Canonical client/runtime
2. Authoritative enter / combat / clear / progress RPCs
3. Own-only appearance fetch
4. Real persistence

This simulator uses the same numbers and clear rules as `the_shallows_encounters.json` so integration later has a fixed target.
