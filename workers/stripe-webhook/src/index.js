import Stripe from "stripe";
export default {
    async fetch(request, env) {
        if (request.method !== "POST") return new Response("METHOD NOT ALLOWED", { status: 405 });
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });
        const body = await request.text();
        let event;
        try {
            const stripe = new Stripe(env.STRIPE_SECRET_KEY);
            event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            return new Response(`Signature verification failed: ${err.message}`, { status: 400 });
        }
        if (event.type !== "checkout.session.completed") return new Response("Ignored", { status: 200 });
        const session = event.data.object;
        const sku = session.metadata?.sku || "UNKNOWN";
        const eventId = event.id;
        const existing = await env.PROCESSED_EVENTS.get(eventId);
        if (existing && existing !== "PROCESSING") return new Response("Already processed", { status: 200 });
        await env.PROCESSED_EVENTS.put(eventId, JSON.stringify({
            state: "PROCESSING",
            started_at: new Date().toISOString()
        }), { expirationTtl: 900 });
        try {
            // In production, call a backend endpoint to create revenue atom and update Notion.
            // Here we just mark completed for demonstration.
            await env.PROCESSED_EVENTS.put(eventId, JSON.stringify({
                state: "COMPLETED",
                completed_at: new Date().toISOString()
            }), { expirationTtl: 2592000 });
            return new Response("REVENUE ATOM CREATED", { status: 200 });
        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500 });
        }
    }
}