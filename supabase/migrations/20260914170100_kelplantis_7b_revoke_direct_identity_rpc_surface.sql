-- Token-bound browser RPCs are the public boundary.
-- Raw player-id variants must not be callable by anon/authenticated clients.
revoke all on function public.kelplantis_claim_parcel(uuid,text) from anon, authenticated;
grant execute on function public.kelplantis_claim_parcel(uuid,text) to service_role;
revoke all on function public.kelplantis_set_soul_anchor(uuid,boolean,jsonb,integer,integer) from anon, authenticated;
grant execute on function public.kelplantis_set_soul_anchor(uuid,boolean,jsonb,integer,integer) to service_role;
revoke all on function public.kelplantis_inspect_soul_anchor(uuid,uuid) from anon, authenticated;
grant execute on function public.kelplantis_inspect_soul_anchor(uuid,uuid) to service_role;
