"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");

const PORT = process.env.PORT || 3000;
const STATIC = path.join(__dirname, "frontend");
const STATE_FILE = "./state.json";

// Load / init state
function loadState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch (_) {
        return { users: {}, usersByEmail: {}, sessions: {}, skuVault: [], userSingles: [], orders: [], processedEvents: [], reservedSkus: {}, auditLog: [], telemetry: [] };
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
    return crypto.pbkdf2Sync(pass, salt, 10000, 64, "sha512").toString("hex") === hash;
}
function generateToken() { return crypto.randomBytes(32).toString("hex"); }

function getSessionUser(req, state) {
    const match = (req.headers.cookie || "").match(/session=([^;]+)/);
    if (!match) return null;
    const userId = state.sessions[match[1]];
    return userId ? state.users[userId] : null;
}

// MIME types
const mimeTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const method = req.method.toUpperCase();

    // Serve static files for GET requests only
    if (method === "GET") {
        const safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
        const filePath = path.join(STATIC, safe === "/" ? "index.html" : safe);
        try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath);
                res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
                res.end(fs.readFileSync(filePath));
                return;
            }
        } catch (_) {}
    }

    // Health
    if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", engine: "dreamledger", version: "2.0.0" }));
        return;
    }

    // Signup
    if (pathname === "/signup" && method === "POST") {
        let body = "";
        req.on("data", c => body += c);
        req.on("end", async () => {
            const params = new URLSearchParams(body);
            const username = params.get("username");
            const password = params.get("password");
            if (!username || !password) { res.writeHead(400); res.end(); return; }
            try {
                await withState((state) => {
                    if (state.usersByEmail[username]) throw new Error("User exists");
                    const userId = crypto.randomUUID();
                    state.users[userId] = { email: username, passwordHash: hashPassword(password), avatar: { hair: "", eyes: "", mouth: "", clothes: "" }, createdAt: new Date().toISOString() };
                    state.usersByEmail[username] = userId;
                    const token = generateToken();
                    state.sessions[token] = userId;
                    res.setHeader("Set-Cookie", `session=${token}; Path=/`);
                    res.writeHead(302, { Location: "/" });
                    res.end();
                });
            } catch (err) { res.writeHead(400); res.end(err.message); }
        });
        return;
    }

    // Login
    if (pathname === "/login" && method === "POST") {
        let body = "";
        req.on("data", c => body += c);
        req.on("end", async () => {
            const params = new URLSearchParams(body);
            const username = params.get("username");
            const password = params.get("password");
            if (!username || !password) { res.writeHead(400); res.end(); return; }
            try {
                await withState((state) => {
                    const userId = state.usersByEmail[username];
                    if (!userId || !verifyPassword(password, state.users[userId].passwordHash)) throw new Error("Invalid");
                    const token = generateToken();
                    state.sessions[token] = userId;
                    res.setHeader("Set-Cookie", `session=${token}; Path=/`);
                    res.writeHead(302, { Location: "/" });
                    res.end();
                });
            } catch (err) { res.writeHead(401); res.end(err.message); }
        });
        return;
    }

    // Logout
    if (pathname === "/logout") {
        const match = (req.headers.cookie || "").match(/session=([^;]+)/);
        if (match) await withState((state) => { delete state.sessions[match[1]]; });
        res.setHeader("Set-Cookie", "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
    }

    // Profile (requires login)
    if (pathname === "/profile") {
        const state = loadState();
        const user = getSessionUser(req, state);
        if (!user) { res.writeHead(302, { Location: "/login" }); res.end(); return; }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><head><title>Profile</title></head><body><h1>Your Profile</h1><p>${user.email}</p><a href="/logout">Logout</a></body></html>`);
        return;
    }

    // Avatar update (requires login)
    if (pathname === "/update-avatar" && method === "POST") {
        const state = loadState();
        const user = getSessionUser(req, state);
        if (!user) { res.writeHead(302, { Location: "/login" }); res.end(); return; }
        let body = "";
        req.on("data", c => body += c);
        req.on("end", async () => {
            const params = new URLSearchParams(body);
            const hair = params.get("hair") || "";
            const eyes = params.get("eyes") || "";
            const mouth = params.get("mouth") || "";
            const clothes = params.get("clothes") || "";
            await withState((state) => {
                const userId = state.usersByEmail[user.email];
                if (userId) state.users[userId].avatar = { hair, eyes, mouth, clothes };
            });
            res.writeHead(302, { Location: "/profile" });
            res.end();
        });
        return;
    }

    // MTG Marketplace (simple list)
    if (pathname === "/mtg") {
        const state = loadState();
        let html = `<!DOCTYPE html><html><head><title>MTG Marketplace</title><style>body{font-family:system-ui;padding:2rem;background:#0a0c0f;color:#e8edf2}h2{color:#d97706}.deck{border:1px solid #d97706;margin:1rem 0;padding:1rem}</style></head><body><h1>MTG Marketplace</h1>`;
        for (const s of state.skuVault.filter(x => x.status === "active")) {
            html += `<div class="deck"><h2>${s.name}</h2><p>Price: $${s.price} NZD</p><p>Stock: ${s.availableStock}</p><a href="/buy?sku=${s.sku}"><button>Buy Now</button></a></div>`;
        }
        html += `<p><a href="/">Home</a></p></body></html>`;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
        return;
    }

    // Fallback 404
    res.writeHead(404);
    res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => console.log(`DreamLedger running on port ${PORT}`));
