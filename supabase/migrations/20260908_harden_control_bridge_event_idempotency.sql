alter table public.control_bridge_notes add column if not exists event_id text;
alter table public.control_bridge_notes add column if not exists correlation_id text;

create or replace function public.sync_control_bridge_event_keys()
returns trigger
language plpgsql
as $$
declare
  payload jsonb;
begin
  if new.note_type = 'STRUCTURED_EVENT' then
    begin
      payload := new.body::jsonb;
      new.event_id := nullif(payload->>'event_id', '');
      new.correlation_id := nullif(payload->>'correlation_id', '');
    exception when others then
      new.event_id := null;
      new.correlation_id := null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_control_bridge_event_keys on public.control_bridge_notes;
create trigger trg_sync_control_bridge_event_keys
before insert or update of note_type, body on public.control_bridge_notes
for each row execute function public.sync_control_bridge_event_keys();

update public.control_bridge_notes
set event_id = nullif((body::jsonb)->>'event_id', ''),
    correlation_id = nullif((body::jsonb)->>'correlation_id', '')
where note_type = 'STRUCTURED_EVENT';

create index if not exists idx_control_bridge_notes_type_created
on public.control_bridge_notes (note_type, created_at);

create index if not exists idx_control_bridge_notes_correlation_created
on public.control_bridge_notes (correlation_id, created_at)
where correlation_id is not null;

create unique index if not exists uq_control_bridge_structured_event_id
on public.control_bridge_notes (event_id)
where note_type = 'STRUCTURED_EVENT' and event_id is not null;
