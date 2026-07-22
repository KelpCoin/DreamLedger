// scripts/repair-engine.js
// DreamLedger Repair Engine
// Consumes drift events from ledger and produces corrective actions (PR or Stripe patch intent)

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', '.dreamledger');
const LEDGER = path.join(BASE, 'ledger.jsonl');
const STATE = path.join(BASE, 'state.json');
const DESIRED = path.join(BASE, 'desired-products.json');
const ACTIONS = path.join(BASE, 'repair-actions.jsonl');

function ensure(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJSON(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function append(file, obj) {
    ensure(file);
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

function loadLedgerDrift() {
    if (!fs.existsSync(LEDGER)) return [];
    const lines = fs.readFileSync(LEDGER, 'utf8').trim().split('\n');
    return lines
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean)
        .filter(e => e.type === 'reconcile.drift');
}

function classify(drift) {
    if (drift.issue === 'MISSING_IN_STRIPE') return 'CREATE_STRIPE_RESOURCE';
    if (drift.issue === 'PRICE_MISMATCH') return 'UPDATE_PRICE';
    return 'UNKNOWN_FIX';
}

function buildAction(drift, desired) {
    const type = classify(drift);

    const base = {
        drift_product: drift.product,
        severity: drift.severity,
        issue: drift.issue,
        action_type: type
    };

    if (type === 'UPDATE_PRICE') {
        const match = desired?.products?.find(p => p.name === drift.product);
        return {
            ...base,
            target: 'stripe.price.update_intent',
            desired_price: match?.price || drift.desired_price
        };
    }

    if (type === 'CREATE_STRIPE_RESOURCE') {
        return {
            ...base,
            target: 'stripe.product.create_intent',
            desired_price: drift.desired_price
        };
    }

    return base;
}

function updateState(summary) {
    const state = readJSON(STATE, {});
    state.last_repair = new Date().toISOString();
    state.last_repair_summary = summary;
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

async function main() {
    const desired = readJSON(DESIRED, {});
    const driftEvents = loadLedgerDrift();

    if (driftEvents.length === 0) {
        updateState({ status: 'no_repair_needed' });
        console.log('No drift events to repair');
        return;
    }

    const actions = driftEvents.map(d => buildAction(d, desired));

    for (const a of actions) append(ACTIONS, a);

    updateState({
        status: 'repair_actions_emitted',
        count: actions.length
    });

    console.log(`Repair engine emitted ${actions.length} actions`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});