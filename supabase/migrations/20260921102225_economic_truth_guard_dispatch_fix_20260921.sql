begin;

drop trigger if exists trg_economic_truth_guards_cells on public.commerce_cells;
create trigger trg_economic_truth_guards_cells before insert or update on public.commerce_cells for each row execute function public.enforce_economic_truth_and_action_guards();

drop trigger if exists trg_economic_truth_guards_actions on public.economic_actions;
create trigger trg_economic_truth_guards_actions before insert or update on public.economic_actions for each row execute function public.enforce_economic_truth_and_action_guards();

drop trigger if exists trg_economic_truth_guards_events on public.economic_events;
create trigger trg_economic_truth_guards_events before insert or update on public.economic_events for each row execute function public.enforce_economic_truth_and_action_guards();

drop trigger if exists trg_economic_truth_guards_outcomes on public.economic_outcomes;
create trigger trg_economic_truth_guards_outcomes before insert or update on public.economic_outcomes for each row execute function public.enforce_economic_truth_and_action_guards();

commit;
