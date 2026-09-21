begin;

create unique index if not exists fulfillment_requests_entitlement_uq
  on public.fulfillment_requests(entitlement_id);

commit;
