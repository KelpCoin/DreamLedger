-- Only the settlement consumer may advance paid -> fulfillment.
create or replace function public.transition_marketplace_order(p_order_id uuid,p_expected_version bigint,p_to_state text,p_actor_user_id uuid,p_actor_org_id uuid default null,p_idempotency_key text default null,p_reason text default null)
returns public.marketplace_orders language plpgsql security definer set search_path='' as $$
declare r public.marketplace_orders;old_state text;current_version bigint;buyer_org uuid;seller_org uuid;
begin
 if p_to_state not in('payment_pending','paid','fulfillment','complete','refund_requested','refunded','dispute') then raise exception 'invalid order state' using errcode='P0003';end if;
 if auth.role()<>'service_role' and p_actor_user_id is distinct from auth.uid() then raise exception 'actor identity does not match authenticated caller' using errcode='P0004';end if;
 if p_idempotency_key is not null and exists(select 1 from public.marketplace_order_state_events e where e.order_id=p_order_id and e.idempotency_key=p_idempotency_key) then select * into r from public.marketplace_orders where id=p_order_id;return r;end if;
 select order_state,state_version,buyer_organization_id,seller_organization_id into old_state,current_version,buyer_org,seller_org from public.marketplace_orders where id=p_order_id for update;
 if not found then raise exception 'order not found' using errcode='P0001';end if;
 if current_version<>p_expected_version then raise exception 'stale order version' using errcode='P0002';end if;
 if old_state=p_to_state then raise exception 'duplicate order transition without idempotency key' using errcode='P0003';end if;
 if p_to_state='fulfillment' then raise exception 'settlement authority required' using errcode='P0005';end if;
 if auth.role()<>'service_role' then
   if p_actor_org_id is null or(p_actor_org_id is distinct from buyer_org and p_actor_org_id is distinct from seller_org) then raise exception 'actor organization is not bound to order' using errcode='P0004';end if;
   if not exists(select 1 from public.marketplace_memberships m where m.organization_id=p_actor_org_id and m.user_id=p_actor_user_id and m.status='active' and m.role in('owner','admin','buyer','seller','moderator','operator')) then raise exception 'actor not authorized for order organization' using errcode='P0004';end if;
 end if;
 update public.marketplace_orders set order_state=p_to_state,state_version=state_version+1,state_updated_at=now(),state_updated_by=p_actor_user_id where id=p_order_id and state_version=p_expected_version returning * into r;
 if not found then raise exception 'concurrent modification' using errcode='P0002';end if;
 insert into public.marketplace_order_state_events(order_id,from_state,to_state,state_version,actor_user_id,actor_organization_id,idempotency_key,reason) values(p_order_id,old_state,p_to_state,r.state_version,p_actor_user_id,p_actor_org_id,p_idempotency_key,p_reason);
 return r;
end;$$;

create or replace function public.transition_marketplace_order_settlement(p_order_id uuid,p_expected_version bigint,p_to_state text,p_actor_user_id uuid,p_actor_org_id uuid,p_idempotency_key text,p_reason text,p_actor_role text)
returns public.marketplace_orders language plpgsql security definer set search_path='' as $$
declare r public.marketplace_orders;old_state text;current_version bigint;
begin
 if p_actor_role<>'settlement_consumer' then raise exception 'settlement authority required' using errcode='P0005';end if;
 if p_to_state<>'fulfillment' then raise exception 'settlement consumer may only advance fulfillment' using errcode='P0005';end if;
 select order_state,state_version into old_state,current_version from public.marketplace_orders where id=p_order_id for update;
 if not found then raise exception 'order not found' using errcode='P0001';end if;
 if current_version<>p_expected_version then raise exception 'stale order version' using errcode='P0002';end if;
 if old_state<>'paid' then raise exception 'invalid transition from non-paid order' using errcode='P0003';end if;
 update public.marketplace_orders set order_state='fulfillment',state_version=state_version+1,state_updated_at=now(),state_updated_by=p_actor_user_id where id=p_order_id and state_version=p_expected_version returning * into r;
 if not found then raise exception 'concurrent modification' using errcode='P0002';end if;
 insert into public.marketplace_order_state_events(order_id,from_state,to_state,state_version,actor_user_id,actor_organization_id,idempotency_key,reason) values(p_order_id,old_state,'fulfillment',r.state_version,p_actor_user_id,p_actor_org_id,p_idempotency_key,p_reason);
 return r;
end;$$;
revoke execute on function public.transition_marketplace_order_settlement(uuid,bigint,text,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.transition_marketplace_order_settlement(uuid,bigint,text,uuid,uuid,text,text,text) to service_role;
