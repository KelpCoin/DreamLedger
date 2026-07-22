import Stripe from "stripe";

export default {
    async fetch(request, env) {
        if (request.method !== "POST") {
            return new Response("METHOD NOT ALLOWED", { status: 405 });
        }
        const sig = request.headers.get("stripe-signature");
        if (!sig) {
            return new Response("Missing signature", { status: 400 });
        }
        const body = await request.text();
        let event;
        try {
            const stripe = new Stripe(env.STRIPE_SECRET_KEY);
            event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            return new Response(`Signature verification failed: ${err.message}`, { status: 400 });
        }

        if (event.type !== "checkout.session.completed") {
            return new Response("Ignored", { status: 200 });
        }

        const session = event.data.object;
        const sku = session.metadata?.sku || "UNKNOWN";
        const eventId = event.id;

        // Idempotency via KV
        const existing = await env.PROCESSED_EVENTS.get(eventId);
        if (existing && existing !== "PROCESSING") {
            return new Response("Already processed", { status: 200 });
        }

        // Mark processing with timestamp
        await env.PROCESSED_EVENTS.put(eventId, JSON.stringify({
            state: "PROCESSING",
            started_at: new Date().toISOString()
        }), { expirationTtl: 900 }); // 15 min TTL

        try {
            // Create Revenue Atom  call your backend API or write to GitHub
// For production, implement createRevenueAtom(sku, amount, currency, eventId)
// that writes to revenue/atoms/REV-{sku}-{timestamp}.json and appends to ledger.
            const atom = {
                event: "REVENUE_RECEIVED",
                sku,
                amount: session.amount_total / 100,
                currency: session.currency,
                stripe_event_id: eventId,
                timestamp: new Date().toISOString()
            };

            // Update Notion (pseudocode  would use Notion API)
            // await updateNotion(env, sku, atom);

            // Mark completed
            await env.PROCESSED_EVENTS.put(eventId, JSON.stringify({
                state: "COMPLETED",
                completed_at: new Date().toISOString(),
                atom
            }), { expirationTtl: 2592000 }); // 30 days

            return new Response("REVENUE ATOM CREATED", { status: 200 });
        } catch (err) {
            // Leave in PROCESSING state, Stripe will retry
            return new Response(`Error: ${err.message}`, { status: 500 });
        }
    }
}

