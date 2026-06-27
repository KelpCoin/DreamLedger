const fs = require("fs");
const BASE = "D:/DreamLedger";
const CATALOG = BASE + "/Site/public/catalog.json";
const REVENUE = BASE + "/Daemon/Revenue";
const PROOF = BASE + "/Proof";
const LOCK = new Map();

function readCatalog() {
    const raw = fs.readFileSync(CATALOG, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
}
function writeCatalog(items) {
    const tmp = CATALOG + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
    fs.renameSync(tmp, CATALOG);
}

function markPaid(eventId, sessionId) {
    if (LOCK.get(eventId)) return false;
    LOCK.set(eventId, true);
    try {
        let items = readCatalog();
        let p = items.find(x => x.id === eventId);
        if (!p) return false;
        if (p.status === "PAID") return true;
        p.status = "PAID";
        p.paid_at = new Date().toISOString();
        p.stripe_session_id = sessionId;
        writeCatalog(items);
        const revFile = `${REVENUE}/rev_${eventId}.json`;
        if (fs.existsSync(revFile)) {
            let r = JSON.parse(fs.readFileSync(revFile, "utf8"));
            if (r.status !== "PAID") {
                r.status = "PAID";
                r.paid_at = new Date().toISOString();
                r.stripe_session_id = sessionId;
                fs.writeFileSync(revFile, JSON.stringify(r, null, 2));
            }
        }
        fs.writeFileSync(`${PROOF}/paid_${eventId}.txt`, `PAID\nEVENT=${eventId}\nSESSION=${sessionId}\nTIME=${new Date().toISOString()}`);
        return true;
    } finally {
        LOCK.delete(eventId);
    }
}
module.exports = { markPaid, readCatalog };
