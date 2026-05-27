const http = require("http");
const fs = require("fs");
const url = require("url");
const Stripe = require("stripe");

const PORT = process.env.PORT || 8080;
const STATE_FILE = "./state.json";

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

function loadState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch {
        return {
            skuVault: [
                { sku: "SKU-0001", name: "Atraxa Poison", price: 25, availableStock: 3, reservedStock: 0, soldStock: 0, status: "active" },
                { sku: "SKU-0002", name: "Kaalia Angels", price: 40, availableStock: 1, reservedStock: 0, soldStock: 0, status: "active" }
            ],
            orders: [],
            processedEvents: [],
            reservedSkus: {}
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

function htmlPage(title, body) {
    return <!DOCTYPE html><html><head><meta charset="UTF-8"><title></title><style>body{font-family:system-ui;background:#0a0c0f;color:#e8edf2;padding:2rem}</style></head><body><div style="max-width:900px;margin:0 auto"></div></body></html>;
}

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const state = loadState();

    if (pathname === "/") {
        const cta = "<div style=\"text-align:center;margin-top:80px\"><h2> MTG Marketplace</h2><p>Buy and sell Magic: The Gathering decks and singles.</p><a href=\"/mtg\"><button style=\"background:#f5c542;padding:1rem 2rem;border:none;border-radius:50px\">Enter MTG </button></a></div>";
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(htmlPage("DreamLedger", cta));
        return;
    }

    if (pathname === "/mtg") {
        let vaultHtml = "";
        for (const s of state.skuVault.filter(s => s.status === "active")) {
            vaultHtml += "<div style=\"border:2px solid gold;margin:1rem;padding:1rem\"><h3>" + s.name + "</h3><p>Price: $" + s.price + " NZD</p><p>Stock: " + s.availableStock + "</p><a href=\"/buy?sku=" + s.sku + "\"><button>Buy Now</button></a></div>";
        }
        const full = htmlPage("Happy Homarid", "<h2>Vault</h2>" + vaultHtml);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(full);
        return;
    }

    if (pathname === "/buy" && req.method === "GET") {
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

    if (pathname === "/webhook" && req.method === "POST") {
        let raw = "";
        req.on("data", c => raw += c);
        req.on("end", async () => {
            let event;
            const sig = req.headers["stripe-signature"];
            try {
                event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
            } catch (err) {
                res.writeHead(401); res.end();
                return;
            }
            const eventId = event.id;
            await withState((state) => {
                if (state.processedEvents.includes(eventId)) return;
                state.processedEvents.push(eventId);
                if (event.type === "checkout.session.completed") {
                    const orderId = event.data.object.metadata.orderId;
                    const order = state.orders.find(o => o.orderId === orderId);
                    if (!order || order.status === "paid") return;
                    order.status = "paid";
                    const skuItem = state.skuVault.find(x => x.sku === order.sku);
                    if (skuItem) {
                        skuItem.reservedStock--;
                        skuItem.soldStock++;
                    }
                    delete state.reservedSkus[order.sku];
                }
            });
            res.writeHead(200); res.end("ok");
        });
        return;
    }

    if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", engine: "happy-homarid", version: "2.0.0" }));
        return;
    }

    res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => console.log("Running on port " + PORT));
