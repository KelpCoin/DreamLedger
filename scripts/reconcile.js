// scripts/reconcile.js
// DreamLedger reconciliation engine: compares desired state vs Stripe live state and emits drift events.

const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BASE_DIR = path.join(__dirname, '..', '.dreamledger');
const DESIRED_FILE = path.join(BASE_DIR, 'desired-products.json');
const LEDGER_FILE = path.join(BASE_DIR, 'ledger.jsonl');
const STATE_FILE = path.join(BASE_DIR, 'state.json');

function ensureDir(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
}

async function loadDesired() {
    if (!fs.existsSync(DESIRED_FILE)) return null;
    return JSON.parse(fs.readFileSync(DESIRED_FILE, 'utf8'));
}

async function loadLiveStripe() {
    const products = await stripe.products.list({ active: true, limit: 100 });

    const live = [];

    for (const p of products.data) {
        const prices = await stripe.prices.list({ product: p.id, active: true, limit: 1 });
        const price = prices.data[0];

        live.push({
            id: p.id,
            name: p.name,
            price_cents: price ? price.unit_amount : null,
            currency: price ? price.currency : null
        });
    }

    return live;
}

function appendLedger(events) {
    ensureDir(LEDGER_FILE);
    const stream = fs.createWriteStream(LEDGER_FILE, { flags: 'a' });

    for (const e of events) {
        stream.write(JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n');
    }

    stream.end();
}

function writeState(statePatch) {
    ensureDir(STATE_FILE);
    let state = {};

    if (fs.existsSync(STATE_FILE)) {
        try {
            state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch {}
    }

    state = { ...state, ...statePatch };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function diff(desired, live) {
    const drift = [];

    if (!desired || !desired.products) return drift;

    for (const d of desired.products) {
        const match = live.find(l => l.name === d.name);

        if (!match) {
            drift.push({
                type: 'reconcile.drift',
                severity: 'high',
                issue: 'MISSING_IN_STRIPE',
                product: d.name,
                desired_price: d.price
            });
            continue;
        }

        const desiredCents = Math.round(d.price * 100);

        if (match.price_cents !== desiredCents) {
            drift.push({
                type: 'reconcile.drift',
                severity: 'medium',
                issue: 'PRICE_MISMATCH',
                product: d.name,
                desired_price: d.price,
                live_price: match.price_cents / 100,
                stripe_product_id: match.id
            });
        }
    }

    return drift;
}

async function main() {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('Missing STRIPE_SECRET_KEY');
        process.exit(1);
    }

    const desired = await loadDesired();
    const live = await loadLiveStripe();

    const drift = diff(desired, live);

    if (drift.length === 0) {
        writeState({ last_reconcile: new Date().toISOString(), status: 'clean' });
        console.log('No drift detected');
        return;
    }

    appendLedger(drift);

    writeState({
        last_reconcile: new Date().toISOString(),
        status: 'drift_detected',
        last_drift_count: drift.length
    });

    console.log(`Reconciliation complete. Drift events: ${drift.length}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});