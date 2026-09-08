# Discord Webhook Starter Kit

A small Node.js 20 service that receives a verified Stripe `checkout.session.completed` webhook and posts a concise payment notification to a Discord webhook.

## 5-minute setup

1. Copy `.env.example` to `.env`.
2. Set `STRIPE_WEBHOOK_SECRET` and `DISCORD_WEBHOOK_URL`.
3. Run `node server.js`.
4. Point the Stripe webhook endpoint at `/stripe/webhook`.
5. Use the included health endpoint to verify the service.

The server uses the raw request body for Stripe signature verification. It only posts events with `payment_status=paid` and ignores unrelated Stripe events.

## Files

- `server.js` - complete webhook receiver and Discord notifier.
- `.env.example` - required configuration.
- `package.json` - Node 20 package metadata and start script.
- `README.md` - setup instructions.

No npm dependencies are required. Node 20's built-in `fetch` is used for Discord and Stripe API calls.
