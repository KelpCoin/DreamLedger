-- Stripe Connect readiness contract for marketplace seller settlement.
begin;
alter table public.marketplace_parties add column if not exists stripe_account_id text;
alter table public.marketplace_parties add column if not exists stripe_charges_enabled boolean not null default false;
alter table public.marketplace_parties add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.marketplace_parties add column if not exists stripe_details_submitted boolean not null default false;
create unique index if not exists marketplace_stripe_account_unique on public.marketplace_parties(stripe_account_id) where stripe_account_id is not null;

create or replace function public.marketplace_prepare_checkout(p_order_id uuid,p_buyer_party_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ord public.marketplace_orders%rowtype; seller public.marketplace_parties%rowtype;
begin
  select * into ord from public.marketplace_orders where id=p_order_id and buyer_party_id=p_buyer_party_id for update;
  if not found then raise exception 'order not found for this buyer'; end if;
  if ord.payment_state='SETTLED' then return jsonb_build_object('order_id',ord.id,'state',ord.state,'payment_state',ord.payment_state,'already_settled',true); end if;
  if ord.state not in ('CREATED','PAYMENT_PENDING') then raise exception 'order is not eligible for checkout'; end if;
  select * into seller from public.marketplace_parties where id=ord.seller_party_id and status='active';
  if not found or seller.stripe_account_id is null or not seller.stripe_charges_enabled or not seller.stripe_payouts_enabled or not seller.stripe_details_submitted then
    raise exception 'seller Stripe Connect onboarding and payouts are not verified';
  end if;
  update public.marketplace_orders set state='PAYMENT_PENDING',payment_state='PENDING',updated_at=now() where id=ord.id returning * into ord;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'CHECKOUT_PREPARED','order',ord.id,'human',p_buyer_party_id::text,'PAYMENT_PENDING',jsonb_build_object('amount_minor',ord.amount_minor,'currency',ord.currency,'seller_account_id',seller.stripe_account_id));
  return jsonb_build_object('order_id',ord.id,'amount_minor',ord.amount_minor,'currency',ord.currency,'payment_state',ord.payment_state,'seller_stripe_account_id',seller.stripe_account_id,'application_fee_bps',500);
end; $$;
revoke all on function public.marketplace_prepare_checkout(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.marketplace_prepare_checkout(uuid,uuid,text) to service_role;
commit;
