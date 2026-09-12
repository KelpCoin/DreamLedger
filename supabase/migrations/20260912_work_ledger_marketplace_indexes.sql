create index if not exists idx_orchestrator_tasks_waiting on public.orchestrator_tasks (status,waiting_kind,waiting_ref) where status in ('waiting_user','waiting_external');
create index if not exists idx_marketplace_orders_checkout_state on public.marketplace_orders (checkout_session_id,order_state,state_version);
