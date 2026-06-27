const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { handleStripeWebhook } = require("./stripeWebhook");
const { createCheckoutSession } = require("./checkoutSession");
const { readCatalog } = require("./revenueStateEngine");

const app = express();

// Webhook must use raw body
app.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

// Normal middleware for other routes
app.use(express.json());
app.use(cors());
app.use(express.static("../public"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/catalog", (req, res) => {
    try {
        res.json(readCatalog());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/create-checkout-session", createCheckoutSession);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log("DreamLedger LIVE on port " + port));
