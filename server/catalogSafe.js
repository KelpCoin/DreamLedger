const fs = require("fs");

const CATALOG = "D:/DreamLedger/Site/public/catalog.json";

function safeLoadCatalog(){
    try {
        const raw = fs.readFileSync(CATALOG, "utf8")
            .replace(/^\uFEFF/, "");

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        console.error("CATALOG_LOAD_ERROR:", e.message);
        return [];
    }
}

module.exports = { safeLoadCatalog };
