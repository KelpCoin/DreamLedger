create or replace function public.kelplantis_broadcast_resource_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform realtime.broadcast_changes('kelplantis-depth-1',TG_OP,TG_OP,TG_TABLE_NAME,TG_TABLE_SCHEMA,case when TG_OP='DELETE' then null else NEW end,case when TG_OP='INSERT' then null else OLD end);
  return case when TG_OP='DELETE' then OLD else NEW end;
end;
$$;

drop trigger if exists kelplantis_resource_nodes_broadcast on public.kelplantis_resource_nodes;
create trigger kelplantis_resource_nodes_broadcast after insert or update or delete on public.kelplantis_resource_nodes for each row execute function public.kelplantis_broadcast_resource_change();
