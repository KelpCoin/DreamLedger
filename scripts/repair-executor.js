// scripts/repair-executor.js
// DreamLedger Repair Executor
// Executes repair intents against Stripe with explicit safety gates

const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BASE = path.join(__dirname, '..', '.dreamledger');
const ACTIONS_FILE = path.join(BASE, 'repair-actions.jsonl');
const EXEC_LOG = path.join(BASE, 'repair-execution-log.jsonl');
const STATE_FILE = path.join(BASE, 'state.json');

const DRY_RUN = process.env.REPAIR_DRY_RUN !== 'false';
const EXECUTE = process.env.EXECUTE_REPAIRS === 'true';

function ensure(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
}

function log(file, obj) {
    ensure(file);
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

function readActions() {
    if (!fs.existsSync(ACTIONS_FILE)) return [];

    const lines = fs.readFileSync(ACTIONS_FILE, 'utf8').trim().split('\n');
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function updateState(summary) {
    let state = {};
    if (fs.existsSync(STATE_FILE)) {
        try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
    }
    state.last_execution = new Date().toISOString();
    state.last_execution_summary = summary;
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function executeAction(action) {
    if (action.target === 'stripe.price.update_intent') {
        if (DRY_RUN) return { dry_run: true, action };

        const products = await stripe.products.list({ limit: 100 });
        const product = products.data.find(p => p.name === action.drift_product);

        if (!product) return { error: 'PRODUCT_NOT_FOUND', action };

        const newPrice = await stripe.prices.create({
            unit_amount: Math.round(action.desired_price * 100),
            currency: 'usd',
            product: product.id
        });

        await stripe.products.update(product.id, {
            default_price: newPrice.id
        });

        return { success: true, product: product.id, price: newPrice.id };
    }

    if (action.target === 'stripe.product.create_intent') {
        if (DRY_RUN) return { dry_run: true, action };

        const product = await stripe.products.create({
            name: action.drift_product || 'auto-created-product'
        });

        const price = await stripe.prices.create({
            unit_amount: Math.round(action.desired_price * 100),
            currency: 'usd',
            product: product.id
        });

        await stripe.products.update(product.id, {
            default_price: price.id
        });

        return { success: true, product: product.id, price: price.id };
    }

    return { ignored: true, action };
}

async function main() {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('Missing STRIPE_SECRET_KEY');
        process.exit(1);
    }

    if (!EXECUTE) {
        console.log('EXECUTE_REPAIRS is not enabled. Exiting safely.');
        return;
    }

    const actions = readActions();

    if (actions.length === 0) {
        updateState({ status: 'no_actions' });
        console.log('No actions to execute');
        return;
    }

    const results = [];

    for (const action of actions) {
        const result = await executeAction(action);
        results.push(result);
        log(EXEC_LOG, result);
    }

    updateState({
        status: 'execution_complete',
        executed: results.length
    });

    console.log(`Executed ${results.length} repair actions (dryRun=${DRY_RUN})`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});