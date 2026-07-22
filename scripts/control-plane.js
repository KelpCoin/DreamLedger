// scripts/control-plane.js
// Control Plane Orchestrator for DreamLedger
// Replaces/centralises prior "TrevorLayer" concept (deprecated)

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', '.dreamledger');
const STATE_FILE = path.join(BASE, 'state.json');
const SILOS_FILE = path.join(BASE, 'silos.json');

function triggerRenderDeploy() {
    return { ok: true, target: 'render', action: 'deploy_triggered' };
}

function pushToSupabase(event) {
    return { ok: false, reason: 'not_configured', event };
}

function sendDiscordAlert(message) {
    console.log('[DISCORD_ALERT]', message);
    return { ok: true };
}

function loadSilos() {
    if (!fs.existsSync(SILOS_FILE)) {
        const defaultSilos = {
            silos: {
                dreamledger: true,
                happy_homarid: true,
                mtg_nz: true,
                amplify: false,
                deprecated_control_plane: false
            }
        };
        fs.mkdirSync(path.dirname(SILOS_FILE), { recursive: true });
        fs.writeFileSync(SILOS_FILE, JSON.stringify(defaultSilos, null, 2));
        return defaultSilos;
    }
    return JSON.parse(fs.readFileSync(SILOS_FILE, 'utf8'));
}

function readState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function routeEvent(event) {
    const silos = loadSilos();

    if (event.type === 'reconcile.drift') {
        sendDiscordAlert(`DRIFT DETECTED: ${event.product}`);
    }

    if (event.source === 'stripe') {
        pushToSupabase(event);
    }

    return {
        routed: true,
        silo_map: silos.silos
    };
}

function main() {
    const state = readState();

    if (state.status === 'clean') {
        triggerRenderDeploy();
    }

    console.log('Control plane active');
}

main();
