const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");
const Stripe = require("stripe");

const PORT = process.env.PORT || 8080;
const STATE_FILE = "./state.json";
const STATIC_DIR = path.join(__dirname, "frontend");

const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const SECRETS_FILE = "D:\\HappyHomarid\\secrets.json";
let secrets;
if (!isProd) {
    try {
        secrets = JSON.parse(fs.readFileSync(SECRETS_FILE, "utf8"));
    } catch (e) {
        console.error("Missing secrets file:", SECRETS_FILE);
        process.exit(1);
    }
} else {
    secrets = {
        stripeKey: process.env.STRIPE_SECRET_KEY,
        baseUrl: process.env.BASE_URL,
        wisePayLink: process.env.WISE_PAY_LINK,
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    };
    if (!secrets.stripeKey || !secrets.baseUrl) {
        console.error("Missing env vars");
        process.exit(1);
    }
}
const stripe = new Stripe(secrets.stripeKey);
const BASE_URL = secrets.baseUrl;
const STRIPE_WEBHOOK_SECRET = secrets.stripeWebhookSecret;
const WISE_PAY_LINK = secrets.wisePayLink;

function loadState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch {
        return {
            users: {}, usersByEmail: {}, sessions: {},
            skuVault: [
                { sku: "SKU-0001", name: "Atraxa Poison", price: 25, availableStock: 3, reservedStock: 0, soldStock: 0, status: "active" },
                { sku: "SKU-0002", name: "Kaalia Angels", price: 40, availableStock: 1, reservedStock: 0, soldStock: 0, status: "active" }
            ],
            userSingles: [], orders: [], processedEvents: [], reservedSkus: {}, auditLog: [], telemetry: []
        };
    }
}
function saveState(state) {
    const tmp = STATE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STATE_FILE);
}
let writeQueue = Promise.resolve();
function withState(fn) {
    writeQueue = writeQueue.then(async () => {
        const state = loadState();
        await fn(state);
        saveState(state);
    }).catch(console.error);
    return writeQueue;
}
function hashPassword(pass) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(pass, salt, 10000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
}
function verifyPassword(pass, stored) {
    const [salt, hash] = stored.split(":");
    const derived = crypto.pbkdf2Sync(pass, salt, 10000, 64, "sha512").toString("hex");
    return derived === hash;
}
function generateToken() { return crypto.randomBytes(32).toString("hex"); }
function parseForm(body) { return Object.fromEntries(new URLSearchParams(body)); }
function getSessionUser(req, state) {
    const match = (req.headers.cookie || "").match(/session=([^;]+)/);
    if (!match) return null;
    const userId = state.sessions[match[1]];
    return userId ? state.users[userId] : null;
}
function reserveSku(state, sku, orderId) {
    if (state.reservedSkus[sku]) return false;
    state.reservedSkus[sku] = { orderId, timestamp: Date.now() };
    return true;
}
setInterval(() => {
    const state = loadState();
    const now = Date.now();
    let changed = false;
    for (const [sku, res] of Object.entries(state.reservedSkus)) {
        if (now - res.timestamp > 15 * 60 * 1000) {
            delete state.reservedSkus[sku];
            const item = state.skuVault.find(x => x.sku === sku);
            if (item && item.reservedStock > 0) {
                item.reservedStock--;
                item.availableStock++;
                changed = true;
            }
        }
    }
    if (changed) saveState(state);
}, 60000);

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const state = loadState();
    const currentUser = getSessionUser(req, state);

    // Static frontend
    if (pathname === "/" || /\.(html|css|js|png|jpg|svg|ico)$/.test(pathname)) {
        let filePath = path.join(STATIC_DIR, pathname === "/" ? "index.html" : pathname);
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath);
        const ct = { ".html":"text/html",".css":"text/css",".js":"application/javascript",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon" }[ext] || "text/plain";
        res.writeHead(200, { "Content-Type": ct });
        res.end(fs.readFileSync(filePath));
        return;
    }

    // Auth
    if (pathname === "/signup" && req.method === "POST") {
        let body = ""; req.on("data", c => body += c); req.on("end", async () => {
            const { username, password } = parseForm(body);
            if (!username || !password) { res.writeHead(400); res.end(); return; }
            await withState((state) => {
                if (state.usersByEmail[username]) throw new Error("User exists");
                const userId = crypto.randomUUID();
                state.users[userId] = { email: username, passwordHash: hashPassword(password), avatar: { hair:"", eyes:"", mouth:"", clothes:"" }, createdAt: new Date().toISOString() };
                state.usersByEmail[username] = userId;
                const token = generateToken();
                state.sessions[token] = userId;
                res.setHeader("Set-Cookie", `session=${token}; Path=/`);
                res.writeHead(302, { Location: "/" });
                res.end();
            }).catch(() => { res.writeHead(400); res.end(); });
        }); return;
    }
    if (pathname === "/login" && req.method === "POST") {
        let body = ""; req.on("data", c => body += c); req.on("end", async () => {
            const { username, password } = parseForm(body);
            await withState((state) => {
                const userId = state.usersByEmail[username];
                if (!userId || !verifyPassword(password, state.users[userId].passwordHash)) throw new Error("Invalid");
                const token = generateToken();
                state.sessions[token] = userId;
                res.setHeader("Set-Cookie", `session=${token}; Path=/`);
                res.writeHead(302, { Location: "/" });
                res.end();
            }).catch(() => { res.writeHead(401); res.end(); });
        }); return;
    }
    if (pathname === "/logout") {
        const match = (req.headers.cookie || "").match(/session=([^;]+)/);
        if (match) await withState((state) => { delete state.sessions[match[1]]; });
        res.setHeader("Set-Cookie", "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
    }
    if (pathname === "/update-avatar" && req.method === "POST" && currentUser) {
        let body = ""; req.on("data", c => body += c); req.on("end", async () => {
            const { hair, eyes, mouth, clothes } = parseForm(body);
            await withState((state) => {
                const userId = state.usersByEmail[currentUser.email];
                if (userId) state.users[userId].avatar = { hair, eyes, mouth, clothes };
                res.writeHead(302, { Location: "/profile" });
                res.end();
            });
        }); return;
    }
    if (pathname === "/profile") {
        if (!currentUser) { res.writeHead(302, { Location: "/login" }); res.end(); return; }
        const a = currentUser.avatar;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><head><title>DreamLedger - Profile</title></head><body><h1>Your Profile</h1><p>${currentUser.email}</p><div style="font-size:3rem">${a.hair} ${a.eyes} ${a.mouth}<br>${a.clothes}</div><form method="POST" action="/update-avatar"><label>Hair: <select name="hair"><option></option><option></option><option></option></select></label><br><label>Eyes: <select name="eyes"><option></option><option></option><option></option></select></label><br><label>Mouth: <select name="mouth"><option></option><option></option><option></option></select></label><br><label>Clothes: <select name="clothes"><option></option><option></option><option></option></select></label><br><button>Update Avatar</button></form><a href="/">Home</a> | <a href="/logout">Logout</a></body></html>`);
        return;
    }

    // MTG Marketplace
    if (pathname === "/mtg") {
        let vaultHtml = "";
        for (const s of state.skuVault.filter(s => s.status === "active")) {
            vaultHtml += `<div style="border:2px solid gold;margin:1rem;padding:1rem"><h3>${s.name}</h3><p>Price: $${s.price} NZD</p><p>Stock: ${s.availableStock}</p><a href="/buy?sku=${s.sku}"><button>Buy Now</button></a> | <a href="/buy-wise?sku=${s.sku}"><button>Wise</button></a></div>`;
        }
        const authBar = currentUser ? `<p>Logged in as ${currentUser.email} | <a href="/add-single">List Single</a> | <a href="/logout">Logout</a></p>` : `<p><a href="/signup">Signup</a> | <a href="/login">Login</a></p>`;
        const full = `<!DOCTYPE html><html><head><title>Happy Homarid Vault</title><style>body{font-family:system-ui;background:#0a0c0f;color:#e8edf2;padding:2rem}</style></head><body>${authBar}<h2>Official Store Decks</h2>${vaultHtml || "<p>No decks yet</p>"}</body></html>`;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(full);
        return;
    }

    // Health
    if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", engine: "dreamledger", version: "2.0.0" }));
        return;
    }

    // Stripe checkout (simplified but functional)
    if (pathname === "/buy" && req.method === "GET" && stripe) {
        const sku = parsed.query.sku;
        let orderId, item;
        try {
            await withState(async (state) => {
                item = state.skuVault.find(x => x.sku === sku && x.status === "active");
                if (!item || item.availableStock <= 0) throw new Error("Out of stock");
                if (state.reservedSkus[sku]) throw new Error("Reserved");
                orderId = "ord_" + Date.now();
                state.reservedSkus[sku] = { orderId, timestamp: Date.now() };
                item.availableStock--;
                item.reservedStock++;
                state.orders.push({ orderId, sku, status: "pending", amount: item.price });
            });
        } catch (err) {
            res.writeHead(409); res.end(err.message);
            return;
        }
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{ quantity: 1, price_data: { currency: "nzd", product_data: { name: item.name }, unit_amount: Math.round(item.price * 100) } }],
            success_url: BASE_URL + "/mtg?success=1", cancel_url: BASE_URL + "/mtg?cancel=1",
            metadata: { orderId }
        });
        res.writeHead(302, { Location: session.url });
        res.end();
        return;
    }

    // Add single
    if (pathname === "/add-single" && req.method === "GET") {
        if (!currentUser) { res.writeHead(302, { Location: "/login" }); res.end(); return; }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><head><title>List a Single</title></head><body><h1>Sell a Single</h1><form method="POST"><input name="name" placeholder="Card Name" required><br><input name="price" step="0.01" type="number" required><br><button type="submit">List</button></form></body></html>`);
        return;
    }
    if (pathname === "/add-single" && req.method === "POST" && currentUser) {
        let body = ""; req.on("data", c => body += c); req.on("end", async () => {
            const { name, price } = parseForm(body);
            if (!name || !price) { res.writeHead(400); res.end(); return; }
            await withState((state) => {
                state.userSingles.push({ id: Date.now().toString(), name, price: parseFloat(price), seller: currentUser.email, created: new Date().toISOString() });
                res.writeHead(302, { Location: "/mtg" });
                res.end();
            });
        }); return;
    }

    // Buy-wise
    if (pathname === "/buy-wise" && req.method === "GET") {
        const sku = parsed.query.sku;
        const state = loadState();
        const item = state.skuVault.find(x => x.sku === sku && x.status === "active");
        if (!item) { res.writeHead(404); res.end("Not found"); return; }
        const orderId = "wise_" + Date.now();
        await withState((state) => {
            state.purchaseLog.push({ sku, type: "wise_redirect", orderId });
        }).catch(() => {});
        res.writeHead(302, { Location: WISE_PAY_LINK });
        res.end();
        return;
    }

    res.writeHead(404); res.end();
});

server.listen(PORT, () => console.log(`DreamLedger running on port ${PORT}`));
