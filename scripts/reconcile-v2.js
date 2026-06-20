// scripts/reconcile-v2.js
// DreamLedger reconciliation engine (v2 safe write)
// Compares desired product state vs Stripe live state and logs drift

const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BASE = path.join(__dirname, '..', '.dreamledger');
const DESIRED_FILE = path.join(BASE, 'desired-products.json');
const LEDGER_FILE = path.join(BASE, 'ledger.jsonl');
const STATE_FILE = path.join(BASE, 'state.json');

function logEvent(event) {
    fs.mkdirSync(BASE, { recursive: true });
    fs.appendFileSync(LEDGER_FILE, JSON.stringify({
        ts: new Date().toISOString(),
        ...event
    }) + '\n');
}

async function fetchStripeProducts() {
    const products = await stripe.products.list({ active: true, limit: 100 });

    const enriched = [];

    for (const p of products.data) {
        const prices = await stripe.prices.list({ product: p.id, active: true, limit: 1 });
        enriched.push({
            id: p.id,
            name: p.name,
            price: prices.data?.[0]?.unit_amount || 0
        });
    }

    return enriched;
}

async function reconcile() {
    if (!fs.existsSync(DESIRED_FILE)) {
        console.log('No desired-products.json found');
        return;
    }

    const desired = JSON.parse(fs.readFileSync(DESIRED_FILE, 'utf8')).products;
    const live = await fetchStripeProducts();

    const drift = [];

    for (const d of desired) {
        const match = live.find(l => l.name === d.name);

        if (!match) {
            drift.push({
                type: 'MISSING_PRODUCT',
                product: d.name,
                expected_price: d.price
            });
            continue;
        }

        const expected = d.price * 100;
        if (match.price !== expected) {
            drift.push({
                type: 'PRICE_MISMATCH',
                product: d.name,
                expected_price: expected,
                actual_price: match.price
            });
        }
    }

    if (drift.length > 0) {
        logEvent({ type: 'reconcile.drift', drift });

        fs.writeFileSync(STATE_FILE, JSON.stringify({
            last_reconcile: new Date().toISOString(),
            drift_count: drift.length
        }, null, 2));

        console.log(`Drift detected: ${drift.length}`);
    } else {
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            last_reconcile: new Date().toISOString(),
            drift_count: 0,
            status: 'clean'
        }, null, 2));

        console.log('No drift detected');
    }
}

reconcile().catch(err => {
    console.error(err);
    process.exit(1);
});