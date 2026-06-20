// scripts/discord-alerts.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const STATE_FILE = path.join(__dirname, '..', '.dreamledger', 'state.json');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
    console.error('Missing DISCORD_WEBHOOK_URL');
    process.exit(1);
}

async function sendDriftAlert(driftEvents) {
    const fields = driftEvents.map(ev => ({
        name: `${(ev.severity || 'MEDIUM').toUpperCase()} - ${ev.product || 'unknown'}`,
        value: `Issue: ${ev.issue || 'unknown'}\nDesired: $${ev.desired_price || 'N/A'}\nLive: $${ev.live_price || 'N/A'}`,
    }));

    const embed = {
        title: '🚨 DreamLedger Drift Detected',
        color: 0xff0000,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'DreamLedger Reconciliation Engine' },
    };

    await axios.post(WEBHOOK_URL, { embeds: [embed] });
}

async function sendHeartbeat(state) {
    const embed = {
        title: '✅ DreamLedger Healthy',
        color: 0x00ff00,
        description: `Last reconcile: ${state.last_reconcile || 'unknown'}\nDrift: ${state.drift_count || 0} events`,
        timestamp: new Date().toISOString(),
    };

    await axios.post(WEBHOOK_URL, { embeds: [embed] });
}

(async () => {
    if (!fs.existsSync(STATE_FILE)) {
        console.log('No state file yet; skipping.');
        return;
    }

    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    if (state.last_drift && state.last_drift.length > 0) {
        await sendDriftAlert(state.last_drift);
        console.log('Drift alert sent.');
    } else if (process.argv.includes('--heartbeat')) {
        await sendHeartbeat(state);
        console.log('Heartbeat sent.');
    } else {
        console.log('No alert condition met.');
    }
})();