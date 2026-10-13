-- Transaction lifecycle RPCs. All state transitions are atomic and append evidence to the ledger.
begin;
alter table public.marketplace_listings add column if not exists idempotency_key text;
create unique index if not exists marketplace_listings_idempotency_unique on public.marketplace_listings(idempotency_key) where idempotency_key is not null;
alter table public.marketplace_offers add column if not exists idempotency_key text;
create unique index if not exists marketplace_offers_idempotency_unique on public.marketplace_offers(idempotency_key) where idempotency_key is not null;

create or replace function public.marketplace_submit_listing(p_idempotency_key text,p_seller_party_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.marketplace_listings%rowtype; seller public.marketplace_parties%rowtype; item public.marketplace_listings%rowtype; t text; d text; c text; lt text; pm text;
begin
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select * into prior from public.marketplace_listings where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('listing_id',prior.id,'state',prior.status,'duplicate',true); end if;
  select * into seller from public.marketplace_parties where id=p_seller_party_id and status='active' and party_type in ('business','human');
  if not found then raise exception 'active seller party required'; end if;
  t:=trim(coalesce(p_payload->>'title','')); d:=trim(coalesce(p_payload->>'description','')); c:=lower(trim(coalesce(p_payload->>'category',''))); lt:=coalesce(p_payload->>'listing_type','goods'); pm:=coalesce(p_payload->>'pricing_model','fixed');
  if length(t) not between 4 and 180 or length(d) not between 10 and 12000 or length(c) not between 2 and 80 then raise exception 'invalid listing title, description, or category'; end if;
  if lt not in ('goods','service','digital_work','agent_capability','surplus_lot') then raise exception 'invalid listing_type'; end if;
  if pm not in ('fixed','quote','subscription','usage','auction','free') then raise exception 'invalid pricing_model'; end if;
  insert into public.marketplace_listings(idempotency_key,seller_party_id,listing_type,title,description,category,price_minor,currency,pricing_model,quantity,unit,location,attributes,status,publication_gate)
  values(p_idempotency_key,seller.id,lt,t,d,c,nullif(p_payload->>'price_minor','')::bigint,upper(coalesce(p_payload->>'currency','NZD')),pm,nullif(p_payload->>'quantity','')::numeric,p_payload->>'unit',coalesce(p_payload->'location','{}'::jsonb),coalesce(p_payload->'attributes','{}'::jsonb),'pending_review',jsonb_build_object('review_required',true,'public_claims_verified',false))
  returning * into item;
  perform public.marketplace_append_ledger_event(p_idempotency_key||':submitted','LISTING_SUBMITTED','listing',item.id,'business',seller.id::text,'OBSERVED',jsonb_build_object('status','pending_review','seller_trust_state',seller.trust_state));
  return jsonb_build_object('listing_id',item.id,'state','pending_review','duplicate',false,'message','Listing submitted for review; not yet public.');
end; $$;

create or replace function public.marketplace_submit_offer(p_idempotency_key text,p_seller_party_id uuid,p_rfq_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.marketplace_offers%rowtype; seller public.marketplace_parties%rowtype; rfq public.marketplace_rfqs%rowtype; item public.marketplace_offers%rowtype; t text;
begin
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select * into prior from public.marketplace_offers where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('offer_id',prior.id,'state',prior.status,'duplicate',true); end if;
  select * into seller from public.marketplace_parties where id=p_seller_party_id and status='active';
  if not found then raise exception 'active supplier party required'; end if;
  select * into rfq from public.marketplace_rfqs where id=p_rfq_id and status='published' and (response_deadline is null or response_deadline>now());
  if not found then raise exception 'RFQ is not open for responses'; end if;
  t:=trim(coalesce(p_payload->>'title',''));
  if length(t) not between 4 and 180 or coalesce((p_payload->>'amount_minor')::bigint,-1)<0 then raise exception 'valid offer title and amount_minor required'; end if;
  insert into public.marketplace_offers(idempotency_key,rfq_id,seller_party_id,buyer_party_id,title,scope,amount_minor,currency,delivery_terms,validity_until,evidence_ids,status)
  values(p_idempotency_key,p_rfq_id,seller.id,rfq.buyer_party_id,t,coalesce(p_payload->'scope','{}'::jsonb),(p_payload->>'amount_minor')::bigint,upper(coalesce(p_payload->>'currency','NZD')),coalesce(p_payload->'delivery_terms','{}'::jsonb),nullif(p_payload->>'validity_until','')::timestamptz,'{}'::uuid[],'submitted')
  returning * into item;
  perform public.marketplace_append_ledger_event(p_idempotency_key||':submitted','SUPPLIER_OFFER_SUBMITTED','offer',item.id,'business',seller.id::text,'OBSERVED',jsonb_build_object('rfq_id',p_rfq_id,'amount_minor',item.amount_minor,'currency',item.currency));
  return jsonb_build_object('offer_id',item.id,'state','submitted','duplicate',false);
end; $$;

create or replace function public.marketplace_accept_offer(p_idempotency_key text,p_buyer_party_id uuid,p_offer_id uuid,p_authorization jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.marketplace_orders%rowtype; buyer public.marketplace_parties%rowtype; offer public.marketplace_offers%rowtype; agreement public.marketplace_agreements%rowtype; ord public.marketplace_orders%rowtype; terms jsonb; th text;
begin
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select * into prior from public.marketplace_orders where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('order_id',prior.id,'state',prior.state,'payment_state',prior.payment_state,'duplicate',true); end if;
  if coalesce(p_authorization->>'confirmed','false')<>'true' or coalesce(length(trim(p_authorization->>'authorized_by')),0)<3 then raise exception 'explicit human authorization required'; end if;
  select * into buyer from public.marketplace_parties where id=p_buyer_party_id and status='active';
  if not found then raise exception 'active buyer party required'; end if;
  select * into offer from public.marketplace_offers where id=p_offer_id and status='submitted' and (validity_until is null or validity_until>now()) for update;
  if not found then raise exception 'offer is unavailable'; end if;
  if offer.buyer_party_id is null or offer.buyer_party_id<>buyer.id then raise exception 'offer is not assigned to this buyer'; end if;
  terms:=jsonb_build_object('offer_id',offer.id,'title',offer.title,'scope',offer.scope,'amount_minor',offer.amount_minor,'currency',offer.currency,'delivery_terms',offer.delivery_terms,'validity_until',offer.validity_until);
  th:=encode(digest(convert_to(terms::text,'UTF8'),'sha256'),'hex');
  insert into public.marketplace_agreements(offer_id,buyer_party_id,seller_party_id,version,terms,terms_hash,buyer_accepted_at,seller_accepted_at,human_authorization,status)
  values(offer.id,buyer.id,offer.seller_party_id,1,terms,th,now(),now(),jsonb_build_object('confirmed',true,'authorized_by',left(p_authorization->>'authorized_by',160),'authorized_at',now(),'authorization_source',left(coalesce(p_authorization->>'source','marketplace_ui'),80)),'accepted') returning * into agreement;
  insert into public.marketplace_orders(agreement_id,buyer_party_id,seller_party_id,amount_minor,currency,payment_state,fulfillment_state,idempotency_key,state)
  values(agreement.id,buyer.id,offer.seller_party_id,offer.amount_minor,offer.currency,'UNPAID','NOT_STARTED',p_idempotency_key,'CREATED') returning * into ord;
  update public.marketplace_offers set status='accepted' where id=offer.id;
  perform public.marketplace_append_ledger_event(p_idempotency_key||':authorized','ORDER_AUTHORIZED','order',ord.id,'human',p_authorization->>'authorized_by','AUTHORIZED',jsonb_build_object('agreement_id',agreement.id,'offer_id',offer.id,'amount_minor',ord.amount_minor,'currency',ord.currency,'terms_hash',th));
  return jsonb_build_object('order_id',ord.id,'agreement_id',agreement.id,'state','CREATED','payment_state','UNPAID','duplicate',false,'message','Offer accepted; payment has not been taken. Proceed to checkout separately.');
end; $$;

create or replace function public.marketplace_prepare_checkout(p_order_id uuid,p_buyer_party_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.marketplace_orders%rowtype;
begin
  select * into ord from public.marketplace_orders where id=p_order_id and buyer_party_id=p_buyer_party_id for update;
  if not found then raise exception 'order not found for this buyer'; end if;
  if ord.payment_state='SETTLED' then return jsonb_build_object('order_id',ord.id,'state',ord.state,'payment_state',ord.payment_state,'already_settled',true); end if;
  if ord.state not in ('CREATED','PAYMENT_PENDING') then raise exception 'order is not eligible for checkout'; end if;
  update public.marketplace_orders set state='PAYMENT_PENDING',payment_state='PENDING',updated_at=now() where id=ord.id returning * into ord;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'CHECKOUT_PREPARED','order',ord.id,'human',p_buyer_party_id::text,'PAYMENT_PENDING',jsonb_build_object('amount_minor',ord.amount_minor,'currency',ord.currency));
  return jsonb_build_object('order_id',ord.id,'amount_minor',ord.amount_minor,'currency',ord.currency,'payment_state',ord.payment_state);
end; $$;

create or replace function public.marketplace_attach_checkout_session(p_order_id uuid,p_session_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.marketplace_orders%rowtype;
begin
  select * into ord from public.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if ord.payment_state='SETTLED' then return jsonb_build_object('order_id',ord.id,'payment_state','SETTLED','already_settled',true); end if;
  if ord.payment_state<>'PENDING' then raise exception 'checkout must be prepared before attaching session'; end if;
  update public.marketplace_orders set payment_provider='stripe',payment_reference=p_session_id,updated_at=now() where id=ord.id returning * into ord;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'STRIPE_CHECKOUT_SESSION_CREATED','order',ord.id,'system','stripe','PAYMENT_PENDING',jsonb_build_object('session_id',p_session_id,'amount_minor',ord.amount_minor,'currency',ord.currency));
  return jsonb_build_object('order_id',ord.id,'session_id',p_session_id,'payment_state','PENDING');
end; $$;

create or replace function public.marketplace_settle_checkout(p_provider text,p_event_id text,p_order_id uuid,p_session_id text,p_amount_minor bigint,p_currency char(3),p_payload_hash text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.marketplace_orders%rowtype; inserted_count integer;
begin
  insert into public.marketplace_webhook_inbox(provider,event_id,event_type,payload_hash,payload,processing_state,processed_at)
  values(p_provider,p_event_id,'checkout.session.completed',p_payload_hash,coalesce(p_payload,'{}'::jsonb),'received',null)
  on conflict(provider,event_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count=0 then return jsonb_build_object('duplicate',true,'event_id',p_event_id); end if;
  select * into ord from public.marketplace_orders where id=p_order_id and payment_provider=p_provider and payment_reference=p_session_id for update;
  if not found then update public.marketplace_webhook_inbox set processing_state='dead_letter',last_error='order/session reference not found' where provider=p_provider and event_id=p_event_id; return jsonb_build_object('matched',false,'state','UNMATCHED'); end if;
  if p_amount_minor<>ord.amount_minor or upper(p_currency)<>upper(ord.currency) then
    update public.marketplace_webhook_inbox set processing_state='dead_letter',last_error='settled amount/currency mismatch' where provider=p_provider and event_id=p_event_id;
    perform public.marketplace_append_ledger_event('stripe-mismatch:'||p_event_id,'PAYMENT_MISMATCH','order',ord.id,'stripe',p_event_id,'UNMATCHED',jsonb_build_object('expected_amount_minor',ord.amount_minor,'observed_amount_minor',p_amount_minor,'expected_currency',ord.currency,'observed_currency',p_currency));
    return jsonb_build_object('matched',false,'state','UNMATCHED');
  end if;
  if ord.payment_state='SETTLED' then update public.marketplace_webhook_inbox set processing_state='processed',processed_at=now() where provider=p_provider and event_id=p_event_id; return jsonb_build_object('duplicate_settlement',true,'order_id',ord.id); end if;
  update public.marketplace_orders set payment_state='SETTLED',state='PAID',updated_at=now() where id=ord.id;
  update public.marketplace_webhook_inbox set processing_state='processed',processed_at=now() where provider=p_provider and event_id=p_event_id;
  perform public.marketplace_append_ledger_event('stripe-settled:'||p_event_id,'PAYMENT_SETTLED','order',ord.id,'stripe',p_event_id,'SETTLED',jsonb_build_object('session_id',p_session_id,'amount_minor',p_amount_minor,'currency',upper(p_currency),'payload_hash',p_payload_hash));
  return jsonb_build_object('matched',true,'state','SETTLED','order_id',ord.id);
end; $$;

create or replace function public.marketplace_record_delivery(p_order_id uuid,p_idempotency_key text,p_manifest jsonb,p_evidence_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.marketplace_orders%rowtype; f public.marketplace_fulfillments%rowtype;
begin
  select * into ord from public.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if ord.payment_state<>'SETTLED' then raise exception 'delivery cannot be recorded before settled payment'; end if;
  if coalesce(array_length(p_evidence_ids,1),0)<1 then raise exception 'at least one delivery evidence item required'; end if;
  insert into public.marketplace_fulfillments(order_id,fulfillment_type,delivered_at,deliverable_manifest,evidence_ids,status)
  values(ord.id,coalesce(p_manifest->>'fulfillment_type','digital_or_service'),now(),coalesce(p_manifest,'{}'::jsonb),p_evidence_ids,'delivered')
  on conflict(order_id) do update set delivered_at=excluded.delivered_at,deliverable_manifest=excluded.deliverable_manifest,evidence_ids=excluded.evidence_ids,status='delivered',updated_at=now()
  returning * into f;
  update public.marketplace_orders set fulfillment_state='DELIVERED',state='DELIVERED',updated_at=now() where id=ord.id;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'ORDER_DELIVERED','order',ord.id,'business',ord.seller_party_id::text,'DELIVERED',jsonb_build_object('fulfillment_id',f.id,'manifest',f.deliverable_manifest,'evidence_ids',p_evidence_ids),p_evidence_ids);
  return jsonb_build_object('order_id',ord.id,'fulfillment_id',f.id,'state','DELIVERED');
end; $$;

create or replace function public.marketplace_accept_delivery(p_order_id uuid,p_buyer_party_id uuid,p_idempotency_key text,p_accept boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.marketplace_orders%rowtype; f public.marketplace_fulfillments%rowtype; state_text text;
begin
  select * into ord from public.marketplace_orders where id=p_order_id and buyer_party_id=p_buyer_party_id for update;
  if not found then raise exception 'order not found for this buyer'; end if;
  select * into f from public.marketplace_fulfillments where order_id=ord.id for update;
  if not found or f.status<>'delivered' then raise exception 'delivery is not ready for acceptance'; end if;
  if p_accept then state_text:='ACCEPTED'; update public.marketplace_fulfillments set status='accepted',accepted_at=now(),updated_at=now() where id=f.id; update public.marketplace_orders set fulfillment_state='ACCEPTED',state='ACCEPTED',updated_at=now() where id=ord.id;
  else state_text:='DISPUTED'; update public.marketplace_fulfillments set status='disputed',updated_at=now() where id=f.id; update public.marketplace_orders set fulfillment_state='DISPUTED',state='DISPUTED',updated_at=now() where id=ord.id; end if;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'BUYER_DELIVERY_DECISION','order',ord.id,'human',p_buyer_party_id::text,state_text,jsonb_build_object('accepted',p_accept,'reason',left(coalesce(p_reason,''),2000),'fulfillment_id',f.id));
  return jsonb_build_object('order_id',ord.id,'state',state_text);
end; $$;

revoke all on function public.marketplace_submit_listing(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.marketplace_submit_offer(text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.marketplace_accept_offer(text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.marketplace_prepare_checkout(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.marketplace_attach_checkout_session(uuid,text,text) from public,anon,authenticated;
revoke all on function public.marketplace_settle_checkout(text,text,uuid,text,bigint,char,text,jsonb) from public,anon,authenticated;
revoke all on function public.marketplace_record_delivery(uuid,text,jsonb,uuid[]) from public,anon,authenticated;
revoke all on function public.marketplace_accept_delivery(uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.marketplace_submit_listing(text,uuid,jsonb) to service_role;
grant execute on function public.marketplace_submit_offer(text,uuid,uuid,jsonb) to service_role;
grant execute on function public.marketplace_accept_offer(text,uuid,uuid,jsonb) to service_role;
grant execute on function public.marketplace_prepare_checkout(uuid,uuid,text) to service_role;
grant execute on function public.marketplace_attach_checkout_session(uuid,text,text) to service_role;
grant execute on function public.marketplace_settle_checkout(text,text,uuid,text,bigint,char,text,jsonb) to service_role;
grant execute on function public.marketplace_record_delivery(uuid,text,jsonb,uuid[]) to service_role;
grant execute on function public.marketplace_accept_delivery(uuid,uuid,text,boolean,text) to service_role;
commit;
