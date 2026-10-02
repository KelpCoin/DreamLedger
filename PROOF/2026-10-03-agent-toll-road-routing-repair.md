# Agent Toll Road Live Routing Repair
Date: 2026-10-03

## Observed failure
The deployed Supabase Edge Function agent-toll-road was ACTIVE at version 11, but its public routes returned HTTP 404.

Supabase function-edge logs confirmed the requests reached function id e51a929c-0342-45c1-b320-7aa02f3cbe58 and returned 404 from the application path.

## Root cause
The function uses Hono. Supabase Edge Function routing prefixes the function name, so Hono must account for the function-name base path.

Observed implementation:
const app = new Hono();

Required implementation:
const app = new Hono().basePath('/agent-toll-road');

## Repair
The deployed function was updated to version 12 with the base path.
The same repair was committed to branch feat/toll-road-agent-bridge.

Git commit: 7dfd41c841c44863a4e2146e5902824ad8e404cf

## Verification
Live health endpoint now returns HTTP 200 with:
ok=true
service=agent-toll-road
payment_mode=DISABLED_UNCONFIGURED
quote_compare_mode=DISABLED
network=eip155:84532

The discovery endpoint now reaches application logic but returns HTTP 503 because the function cannot currently read agent_toll_products through its database connection.

This separates two blockers:
1. ROUTING = repaired and verified.
2. DATABASE/PAYMENT CONFIGURATION = still blocking paid discovery and commerce.

## Economic boundary
No payment was created.
No simulated buyer was created.
No revenue was claimed.
The verified revenue scoreboard remains NZ$0.00.

## Next smallest blocker
Restore authoritative database connectivity and inspect the required Toll Road tables/functions. Then inspect payment configuration. Do not enable production payment or claim settlement until both are verified.
