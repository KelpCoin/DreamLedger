create or replace function public.settlement_apply_marketplace_refund(p_event_id text,p_payment_intent_id text default null,p_charge_id text default null,p_amount_refunded_nzd numeric default 0,p_refund_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_payment public.marketplace_payments;
 v_order public.marketplace_orders;
 v_old_payment_status text;
 v_new_payment_status text;
 v_old_order_state text;
 v_fulfillment record;
 v_payout record;
begin
 select * into v_payment from public.marketplace_payments
 where (p_payment_intent_id is not null and stripe_payment_intent_id=p_payment_intent_id)
    or (p_charge_id is not null and stripe_charge_id=p_charge_id)
 order by created_at desc limit 1 for update;
 if not found then return jsonb_build_object('status','UNMATCHED','event_id',p_event_id); end if;
 select * into v_order from public.marketplace_orders where id=v_payment.order_id for update;
 if not found then raise exception 'marketplace order not found for payment %',v_payment.payment_id; end if;
 v_old_payment_status:=v_payment.status;
 v_old_order_state:=v_order.order_state;
 if p_amount_refunded_nzd <= 0 then return jsonb_build_object('status','IGNORED','reason','non-positive refund amount','order_id',v_order.id); end if;
 if p_amount_refunded_nzd >= v_payment.amount_nzd then v_new_payment_status:='refunded'; else v_new_payment_status:='partially_refunded'; end if;
 update public.marketplace_payments set status=v_new_payment_status,raw_event_id=p_event_id,updated_at=now() where payment_id=v_payment.payment_id;
 if v_new_payment_status='refunded' then
   if v_order.order_state not in ('refunded','dispute') then
     update public.marketplace_orders set order_state='refunded',payment_status='refunded',state_version=state_version+1,state_updated_at=now(),state_updated_by=null where id=v_order.id;
     insert into public.marketplace_order_state_events(order_id,from_state,to_state,state_version,actor_user_id,actor_organization_id,idempotency_key,reason)
     values(v_order.id,v_old_order_state,'refunded',v_order.state_version+1,null,null,'stripe_refund:'||p_event_id,coalesce(p_refund_reason,'Stripe charge.refunded')) on conflict do nothing;
   end if;
   for v_fulfillment in select * from public.marketplace_fulfillments where order_id=v_order.id for update loop
     if v_fulfillment.status in ('queued','accepted','in_progress','shipped') then
       update public.marketplace_fulfillments set status='cancelled',failure_reason=coalesce(p_refund_reason,'Stripe refund'),updated_at=now() where fulfillment_id=v_fulfillment.fulfillment_id;
       insert into public.marketplace_fulfillment_events(fulfillment_id,from_status,to_status,actor_user_id,evidence_ref,note)
       values(v_fulfillment.fulfillment_id,v_fulfillment.status,'cancelled',null,p_event_id,'Cancelled by full Stripe refund');
     end if;
   end loop;
   for v_payout in select * from public.marketplace_payouts where order_id=v_order.id for update loop
     if v_payout.status in ('pending','submitted') then update public.marketplace_payouts set status='reversed',updated_at=now() where payout_id=v_payout.payout_id; end if;
   end loop;
 end if;
 insert into public.marketplace_audit_events(actor_user_id,organization_id,entity_type,entity_id,action,from_state,to_state,idempotency_key,evidence_ref,metadata)
 values(null,v_order.seller_organization_id,'payment',v_payment.payment_id::text,'stripe_refund',v_old_payment_status,v_new_payment_status,'stripe_refund:'||p_event_id,p_event_id,jsonb_build_object('order_id',v_order.id,'payment_intent_id',p_payment_intent_id,'charge_id',p_charge_id,'amount_refunded_nzd',p_amount_refunded_nzd,'reason',p_refund_reason)) on conflict do nothing;
 return jsonb_build_object('status','APPLIED','payment_id',v_payment.payment_id,'order_id',v_order.id,'payment_status',v_new_payment_status);
end;
$$;
revoke execute on function public.settlement_apply_marketplace_refund(text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.settlement_apply_marketplace_refund(text,text,text,numeric,text) to service_role;
