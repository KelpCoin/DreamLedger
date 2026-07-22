// scripts/ingest-stripe.js
// Polls Stripe for recent events and writes them into DreamLedger ledger.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const LEDGER_FILE = path.join(__dirname, '..', '.dreamledger', 'ledger.jsonl');
const LAST_EVENT_FILE = path.join(__dirname, '..', '.dreamledger', 'last_stripe_event.json');

async function ingest() {
    let lastEventId = null;
    if (fs.existsSync(LAST_EVENT_FILE)) {
        try {
            lastEventId = JSON.parse(fs.readFileSync(LAST_EVENT_FILE, 'utf8')).id;
        } catch (e) {
            lastEventId = null;
        }
    }

    const params = { limit: 10, type: 'payment_intent.succeeded' };
    if (lastEventId) params.starting_after = lastEventId;

    const events = await stripe.events.list(params);

    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
    const ledgerStream = fs.createWriteStream(LEDGER_FILE, { flags: 'a' });

    let latestEventId = lastEventId;

    for (const event of events.data) {
        const obj = event.data && event.data.object ? event.data.object : {};

        const normalized = {
            ts: new Date().toISOString(),
            source: 'stripe',
            type: event.type,
            id: event.id,
            data: {
                amount: obj.amount || null,
                currency: obj.currency || null,
                product: obj.metadata?.product_id || null,
                status: obj.status || null,
                customer: obj.customer || null,
            }
        };

        ledgerStream.write(JSON.stringify(normalized) + '\n');
        latestEventId = event.id;
    }

    ledgerStream.end();

    if (latestEventId) {
        fs.mkdirSync(path.dirname(LAST_EVENT_FILE), { recursive: true });
        fs.writeFileSync(LAST_EVENT_FILE, JSON.stringify({ id: latestEventId, ts: new Date().toISOString() }, null, 2));
    }

    console.log(`Ingested ${events.data.length} Stripe events.`);
}

ingest().catch(err => { console.error(err); process.exit(1); });