create or replace function public.beck_create_objective(p_objective text,p_silo_id text default 'BECK') returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if coalesce(pg_catalog.btrim(p_objective),'')='' then raise exception 'objective required'; end if;
 insert into public.jobs(type,status,payload,beck_lifecycle,beck_success_condition_hash)
 values('beck_objective','pending',pg_catalog.jsonb_build_object('objective',p_objective,'silo_id',coalesce(p_silo_id,'BECK'),'economic_status','NOT_YET_PROVEN'),'active',public.beck_success_condition_hash())
 returning id into v_id;
 return v_id;
end $$;