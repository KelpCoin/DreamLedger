const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { markPaid } = require("./revenueStateEngine");

async function handleStripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (e) {
        return res.status(400).send("invalid signature");
    }
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const eventId = session.metadata?.event_id;
        if (eventId) {
            markPaid(eventId, session.id);
        }
    }
    res.json({ received: true });
}
module.exports = { handleStripeWebhook };
