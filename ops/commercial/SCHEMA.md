# Minimum commercial schema

Relational intent (Postgres/Supabase or SQLite air-gap mirror).

## Tables

### offers
`offer_id`, `sku`, `name`, `price_nzd`, `currency`, `status`, `stripe_payment_link_url`, `created_at`

### orders
`order_id`, `offer_id`, `buyer_reference`, `amount`, `currency`, `status`,  
`stripe_checkout_session_id`, `stripe_payment_intent_id`, `created_at`

Statuses: `draft` → `checkout_active` → `payment_pending` → `payment_succeeded` → `fulfilling` → `fulfilled` | `failed` | `refunded`

### payments
`payment_id`, `order_id`, `stripe_payment_intent_id`, `stripe_charge_id`,  
`amount`, `currency`, `status`, `livemode`, `event_id`, `created_at`

### evidence
`evidence_id`, `source` (stripe|delivery|internal), `source_event_id`,  
`event_type`, `payload_hash`, `observed_at`, `verified_at`, `verification_method`

### fulfillments
`fulfillment_id`, `order_id`, `method`, `status`, `delivered_at`, `evidence_id`

### economic_events
`economic_event_id`, `event_type`, `order_id`, `payment_id`,  
`amount`, `currency`, `evidence_ids` (json), `finalized_at`,  
`counts_as_verified_external_revenue` (bool, default false until livemode + external)

### actions (ActionPass-lite)
`action_id`, `mission_id`, `agent_id`, `action_type`, `parameters_hash`,  
`maximum_spend`, `currency`, `expires_at`, `approved_by`, `status`,  
`created_at`, `executed_at`, `result_id`

No crypto token required for MVP — DB row + actuator check is enough.
