const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { readCatalog } = require("./revenueStateEngine");

async function createCheckoutSession(req, res) {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: "missing event_id" });
    const items = readCatalog();
    const product = items.find(x => x.id === event_id);
    if (!product) return res.status(404).json({ error: "product not found" });
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{
            price_data: {
                currency: "usd",
                product_data: { name: product.title },
                unit_amount: product.price
            },
            quantity: 1
        }],
        metadata: { event_id },
        success_url: "https://dreamledger.org/success",
        cancel_url: "https://dreamledger.org/cancel"
    });
    res.json({ url: session.url });
}
module.exports = { createCheckoutSession };
