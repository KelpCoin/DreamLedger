// scripts/silo-expander.js
// Economy Silo Expansion Layer for DreamLedger

const fs = require('fs');
const path = require('path');
const { insertEvent } = require('./supabase-client');

const BASE = path.join(__dirname, '..', '.dreamledger');
const SILOS_FILE = path.join(BASE, 'silos.json');
const STATE_FILE = path.join(BASE, 'state.json');

function loadSilos() {
    if (!fs.existsSync(SILOS_FILE)) {
        return {
            silos: {
                dreamledger: true,
                happy_homarid: true,
                mtg_nz: true
            }
        };
    }
    return JSON.parse(fs.readFileSync(SILOS_FILE, 'utf8'));
}

function enrichEventWithSilo(event) {
    const silos = loadSilos().silos;

    let silo = 'dreamledger';
    const text = JSON.stringify(event).toLowerCase();

    if (text.includes('mtg') || text.includes('card') || text.includes('deck')) {
        silo = 'mtg_nz';
    }

    if (text.includes('homarid') || text.includes('happy')) {
        silo = 'happy_homarid';
    }

    return {
        ...event,
        silo
    };
}

async function routeToSilos(event) {
    const enriched = enrichEventWithSilo(event);

    await insertEvent(enriched);

    const state = fs.existsSync(STATE_FILE)
        ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
        : {};

    state.last_silo_event = enriched;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    return enriched;
}

module.exports = {
    routeToSilos
};