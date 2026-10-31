# MTG Auction Independent Review Packet

**Not an independent review.** Source code copied from the current draft branch; third-party reviewer should treat this as untrusted implementation. This packet contains no credentials.

## Reviewer tasks

1. Attempt to break bidding concurrency, including the after-FOR-UPDATE clock check: two equal bids, end-time races, idempotency reuse, anti-sniping deadline extension, self-bidding, anonymous users, and integer overflow.
2. Attempt webhook replay and forged success: signature verification, event-type handling, payment intent/session metadata binding, refund amount and double-entry balance.
3. Inspect account boundary and checkout liability: no payout automation, no escrow claim, approvals before inventory publication, authorization for seller vs buyer.
4. Identify blockers that would prevent an NZ marketplace from handling buyer funds legally and safely. Recommend connected-account/direct-charge path if appropriate, subject to NZ advice.
5. Provide precise patch suggestions. Never activate payments, public posts, or production deployment without owner approval.

## Database bid-placement function
```sql
create or replace function public.mtg_auction_bid_v2(p_auction uuid,p_amount_cents bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); l public.mtg_auction_lots_v2%rowtype; oldbid public.mtg_auction_bids_v2%rowtype;
 b uuid; floor_price bigint; t timestamptz;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from auth.users where id=u and email_confirmed_at is not null)
 then raise exception 'VERIFIED_BUYER_EMAIL_REQUIRED'; end if;
 if p_request_id is null or p_amount_cents is null or p_amount_cents>100000000000 then raise exception 'INVALID_BID'; end if;
 select * into l from public.mtg_auction_lots_v2 where id=p_auction for update;
 if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
 -- Evaluate the deadline AFTER any wait on FOR UPDATE, never at function entry.
 t:=clock_timestamp();
 select * into oldbid from public.mtg_auction_bids_v2
 where auction_id=l.id and bidder_id=u and request_id=p_request_id;
 if found then
  if oldbid.amount_cents<>p_amount_cents then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
  return jsonb_build_object('bid_id',oldbid.id,'accepted_cents',oldbid.amount_cents,'idempotent',true);
 end if;
 if l.status<>'open' or l.starts_at>t or l.ends_at<=t then raise exception 'BIDDING_CLOSED'; end if;
 if l.seller_id=u then raise exception 'SELF_BIDDING_FORBIDDEN'; end if;
 if not exists(select 1 from public.mtg_inventory_v2 where id=l.inventory_id and status='reserved')
 or not exists(select 1 from public.mtg_seller_profiles_v2 where user_id=l.seller_id and status='verified')
 then raise exception 'SELLER_OR_STOCK_UNVERIFIED'; end if;
 floor_price:=case when l.high_bid_cents=0 then l.start_cents else l.high_bid_cents+l.increment_cents end;
 if p_amount_cents<floor_price then raise exception 'BID_TOO_LOW'; end if;
 insert into public.mtg_auction_bids_v2(auction_id,bidder_id,request_id,amount_cents)
 values(l.id,u,p_request_id,p_amount_cents) returning id into b;
 update public.mtg_auction_lots_v2 set high_bid_cents=p_amount_cents,high_bidder=u,version=version+1,
 ends_at=case when ends_at<t+interval '2 minutes' then least(original_ends_at+interval '1 hour',t+interval '2 minutes') else ends_at end
 where id=l.id;
 perform mtg_private.event(l.id,'bid_accepted',u,jsonb_build_object('bid_id',b,'amount_cents',p_amount_cents));
 return jsonb_build_object('bid_id',b,'accepted_cents',p_amount_cents,'idempotent',false);
end $$;
```

## Database paid-event reconciliation
```sql
create or replace function public.mtg_auction_reconcile_v2(
 p_event_id text,p_event_type text,p_session text,p_amount_cents bigint,p_currency text,p_payload_sha256 text,
 p_payment_intent text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.mtg_auction_orders_v2%rowtype; l public.mtg_auction_lots_v2%rowtype; outcome text:='held';
begin
  if p_event_id !~ '^evt_[A-Za-z0-9_]+$' or p_payload_sha256 !~ '^[0-9a-f]{64}$'
 then raise exception 'INVALID_EXTERNAL_EVENT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id,1));
 if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id) then
  if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id and payload_sha256<>p_payload_sha256)
  then raise exception 'EVENT_ID_PAYLOAD_CONFLICT'; end if;
  return jsonb_build_object('idempotent',true,'outcome',(select e.outcome from public.mtg_auction_external_v2 e where e.stripe_event_id=p_event_id));
 end if;
 select * into o from public.mtg_auction_orders_v2 where stripe_session=p_session for update;
 if found and p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and o.status='awaiting_checkout' and
 p_currency='nzd' and p_amount_cents=o.amount_cents and p_payment_intent like 'pi_%' then
  update public.mtg_auction_orders_v2 set status='paid',paid_at=now(),stripe_payment_intent=p_payment_intent where id=o.id;
  update public.mtg_auction_lots_v2 set status='paid',version=version+1 where id=o.auction_id;
  update public.mtg_inventory_v2 set status='sold' where id=(select inventory_id from public.mtg_auction_lots_v2 where id=o.auction_id);
  insert into public.mtg_auction_postings_v2(journal_id,account,side,amount_cents) values
   (p_event_id,'stripe_clearing','debit',o.amount_cents),
   (p_event_id,'unallocated_liability','credit',o.amount_cents);
  perform mtg_private.event(o.auction_id,'stripe_paid',null,jsonb_build_object('event_id',p_event_id,'amount_cents',o.amount_cents));
  outcome:='applied';
 end if;
 -- Never deduplicate a mismatched event as permanently held. Roll back and retry.
 if outcome<>'applied' then raise exception 'PAYMENT_EVENT_REQUIRES_RECONCILIATION'; end if;
 insert into public.mtg_auction_external_v2(stripe_event_id,event_type,stripe_session,payload_sha256,order_id,outcome)
 values(p_event_id,p_event_type,p_session,p_payload_sha256,case when found then o.id else null end,outcome);
 return jsonb_build_object('idempotent',false,'outcome',outcome);
end $$;
```

## Database refund reconciliation
```sql
create or replace function public.mtg_auction_refund_reconcile_v2(
 p_event_id text,p_payment_intent text,p_refunded_cents bigint,p_currency text,p_payload_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.mtg_auction_orders_v2%rowtype; outcome text:='held';
begin
 if p_event_id !~ '^evt_[A-Za-z0-9_]+$' or p_payment_intent !~ '^pi_[A-Za-z0-9_]+$'
 or p_payload_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REFUND_EVENT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id,1));
 if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id) then
  if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id and payload_sha256<>p_payload_sha256)
  then raise exception 'EVENT_ID_PAYLOAD_CONFLICT'; end if;
  return jsonb_build_object('idempotent',true,'outcome',(select e.outcome from public.mtg_auction_external_v2 e where e.stripe_event_id=p_event_id));
 end if;
 select * into o from public.mtg_auction_orders_v2 where stripe_payment_intent=p_payment_intent for update;
 if found and o.status in ('paid','shipped','delivered','disputed') and p_refunded_cents=o.amount_cents and p_currency='nzd' then
  update public.mtg_auction_orders_v2 set status='refunded',refunded_at=now() where id=o.id;
  update public.mtg_auction_lots_v2 set status='refunded',version=version+1 where id=o.auction_id;
  insert into public.mtg_auction_postings_v2(journal_id,account,side,amount_cents) values
   (p_event_id,'unallocated_liability','debit',o.amount_cents),
   (p_event_id,'stripe_clearing','credit',o.amount_cents);
  perform mtg_private.event(o.auction_id,'stripe_refunded',null,jsonb_build_object('event_id',p_event_id,'amount_cents',o.amount_cents));
  outcome:='applied';
 end if;
 -- Never deduplicate a mismatched event as permanently held. Roll back and retry.
 if outcome<>'applied' then raise exception 'REFUND_EVENT_REQUIRES_RECONCILIATION'; end if;
 insert into public.mtg_auction_external_v2(stripe_event_id,event_type,payload_sha256,order_id,outcome)
 values(p_event_id,'charge.refunded',p_payload_sha256,case when found then o.id else null end,outcome);
 return jsonb_build_object('idempotent',false,'outcome',outcome);
end $$;
```

## Stripe webhook handler (verbatim)
```typescript
// MTG Stripe webhook. Raw request signature verified before touching the external ledger.
// Never infer a paid order from a client redirect or a client-submitted ID.
// Built-in Deno runtime types, no JSR edge-runtime dependency.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const hash=async(raw:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async req=>{
 if(req.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
 const key=Deno.env.get("STRIPE_SECRET_KEY"),secret=Deno.env.get("MTG_AUCTION_STRIPE_WEBHOOK_SECRET"),
 base=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!key||!secret||!base||!service)return reply({error:"WEBHOOK_NOT_CONFIGURED"},503);
 const signature=req.headers.get("stripe-signature");
 if(!signature)return reply({error:"SIGNATURE_REQUIRED"},400);
 const raw=await req.text();if(raw.length>1024*1024)return reply({error:"PAYLOAD_TOO_LARGE"},413);
 const stripe=new Stripe(key,{apiVersion:"2025-06-30.basil"});
 let event:Stripe.Event;
 try{event=await stripe.webhooks.constructEventAsync(raw,signature,secret)}
 catch{return reply({error:"BAD_STRIPE_SIGNATURE"},400)}
 // This integration remains a TEST-only payment lane; no real-money recognition.
 if(event.livemode!==false||!key.startsWith("sk_test_"))
   return reply({error:"LIVE_AUCTION_EVENTS_NOT_AUTHORIZED"},503);
 // This endpoint is platform-MTG-only; Connect events have a separate owner.
 if(event.account)return reply({received:true,ignored:"connected_account"});
 const admin=createClient(base,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const payloadHash=await hash(raw);
 if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
  const s=event.data.object as Stripe.Checkout.Session;
  if(s.metadata?.silo!=="mtg"||!s.metadata?.mtg_order_id)return reply({received:true,ignored:"not_mtg_v2"});
  if(s.payment_status!=="paid")return reply({received:true,ignored:"not_paid"});
  const paymentIntent=typeof s.payment_intent==="string"?s.payment_intent:s.payment_intent?.id||null;
  const {data:mtgOrder,error:orderError}=await admin.from("mtg_auction_orders_v2")
    .select("id,stripe_session,amount_cents,currency")
    .eq("id",s.metadata.mtg_order_id).maybeSingle();
  if(orderError)return reply({error:"ORDER_LOOKUP_RETRY"},503);
  if(!mtgOrder||mtgOrder.stripe_session!==s.id)return reply({error:"MTG_ORDER_SESSION_RECONCILIATION_REQUIRED"},503);
  if(mtgOrder.amount_cents!==s.amount_total||mtgOrder.currency.toLowerCase()!==s.currency)
    return reply({error:"ORDER_AMOUNT_CURRENCY_MISMATCH"},409);
  const {data,error}=await admin.rpc("mtg_auction_reconcile_v2",{
   p_event_id:event.id,p_event_type:event.type,p_session:s.id,
   p_amount_cents:s.amount_total,p_currency:s.currency,p_payload_sha256:payloadHash,
   p_payment_intent:paymentIntent
  });
  if(error){console.error("MTG_RECONCILE_RETRY",error.code);return reply({error:"RECONCILIATION_RETRY"},503)}
  return reply({received:true,result:data});
 }
 if(event.type==="charge.refunded"){
  const c=event.data.object as Stripe.Charge;
  const paymentIntent=typeof c.payment_intent==="string"?c.payment_intent:c.payment_intent?.id||null;
  if(!paymentIntent)return reply({received:true,ignored:"no_payment_intent"});
  // Never record unrelated platform charges (other silos) in the MTG external ledger.
  const {data:mtgOrder,error:orderError}=await admin.from("mtg_auction_orders_v2")
    .select("id,amount_cents,currency").eq("stripe_payment_intent",paymentIntent).maybeSingle();
  if(orderError)return reply({error:"ORDER_LOOKUP_RETRY"},503);
  if(!mtgOrder)return reply({received:true,ignored:"not_an_mtg_auction_order"});
  const {data,error}=await admin.rpc("mtg_auction_refund_reconcile_v2",{
   p_event_id:event.id,p_payment_intent:paymentIntent,
   p_refunded_cents:c.amount_refunded,p_currency:c.currency,p_payload_sha256:payloadHash
  });
  if(error){console.error("MTG_REFUND_RETRY",error.code);return reply({error:"RECONCILIATION_RETRY"},503)}
  return reply({received:true,result:data});
 }
 return reply({received:true,ignored:"not_target_event"});
});

```

## Stripe checkout creation (verbatim)
```typescript
// Stripe Checkout creation for confirmed MTG auction winners only.
// Protected by JWT, trusted database order, and explicit release gate.
// Deno global types are supplied by the deployed Edge runtime and Deno CI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
 if(Deno.env.get("MTG_AUCTION_PAYMENTS_ENABLED")!=="true")return reply({error:"PAYMENTS_APPROVAL_GATE_CLOSED"},503);
 const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const pub=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
 const stripeKey=Deno.env.get("STRIPE_SECRET_KEY");
 // Until NZ legal/payment routing and connected-seller responsibility are signed off,
 // only Stripe TEST mode is permitted, regardless of the payment feature flag.
 if(Deno.env.get("MTG_AUCTION_PAYMENT_ENV")!=="test"||!stripeKey?.startsWith("sk_test_"))
   return reply({error:"LIVE_THIRD_PARTY_FUNDS_NOT_AUTHORIZED"},503);
 if(!base||!key||!pub||!stripeKey)return reply({error:"CONFIGURATION_INCOMPLETE"},503);
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer .+/.test(bearer))return reply({error:"LOGIN_REQUIRED"},401);
 const identity=createClient(base,pub,{global:{headers:{Authorization:bearer}}});
 const {data:{user},error:authError}=await identity.auth.getUser();
 if(authError||!user||!user.email_confirmed_at)return reply({error:"VERIFIED_EMAIL_REQUIRED"},403);
 let data:any;try{data=await req.json()}catch{return reply({error:"INVALID_JSON"},400)}
 const orderId=String(data?.order_id||"");
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(orderId))return reply({error:"INVALID_ORDER_ID"},422);
 const admin=createClient(base,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:order,error:dbError}=await admin.from("mtg_auction_orders_v2")
 .select("id,auction_id,buyer_id,seller_id,amount_cents,currency,status,stripe_session")
 .eq("id",orderId).eq("buyer_id",user.id).maybeSingle();
 if(dbError)return reply({error:"ORDER_READ_FAILED"},503);
 if(!order||order.status!=="awaiting_checkout")return reply({error:"ORDER_NOT_PAYABLE"},409);
 if(order.currency!=="NZD"||!Number.isSafeInteger(Number(order.amount_cents))||Number(order.amount_cents)<100)return reply({error:"PRICE_NOT_VERIFIED"},409);
 const {data:lot,error:lotError}=await admin.from("mtg_auction_lots_v2").select("id,status,title").eq("id",order.auction_id).single();
 if(lotError||lot?.status!=="awaiting_payment")return reply({error:"LOT_NOT_PAYABLE"},409);
 const stripe=new Stripe(stripeKey,{apiVersion:"2025-06-30.basil"});
 try{
  if(order.stripe_session){
   const existing=await stripe.checkout.sessions.retrieve(order.stripe_session);
   if(existing.status!=="open"||!existing.url)return reply({error:"CHECKOUT_EXPIRED_REVIEW_REQUIRED"},409);
   return reply({checkout_url:existing.url,session_id:existing.id});
  }
  // Order ID uniquely fences Stripe retries and replays.
  const session=await stripe.checkout.sessions.create({
   mode:"payment",client_reference_id:order.id,
   line_items:[{price_data:{currency:"nzd",unit_amount:Number(order.amount_cents),
    product_data:{name:lot.title||"MTG verified auction lot"}},quantity:1}],
   metadata:{mtg_order_id:order.id,mtg_auction_id:order.auction_id,silo:"mtg"},
   payment_intent_data:{metadata:{mtg_order_id:order.id,silo:"mtg"}},
   success_url:"https://dreamledger.org/mtg/auctions/?payment=processing",
   cancel_url:"https://dreamledger.org/mtg/auctions/?payment=cancelled"
  },{idempotencyKey:"mtg-v2-order-"+order.id+"-"+order.amount_cents});
  if(!session.url)return reply({error:"STRIPE_CHECKOUT_NO_URL"},503);
  const {error:bindError}=await admin.rpc("mtg_auction_bind_session_v2",{p_order:order.id,p_session:session.id});
  if(bindError)return reply({error:"CHECKOUT_BINDING_REQUIRES_REVIEW"},503);
  return reply({checkout_url:session.url,session_id:session.id});
 }catch(err){console.error("MTG_CHECKOUT_FAILURE",String((err as Error)?.message||"unknown"));return reply({error:"CHECKOUT_UNAVAILABLE"},503)}
});

```

## Context
- Current branch: fix/mtg-colour-auction-discovery-20261031
- Target database: Supabase DreamLedger, live SQL connection refused during checks.
- Tests: isolated Postgres 17 CI; this is not a Stripe end-to-end or production integration proof.
- Live payment is technically forbidden in this draft: feature flag plus MTG_AUCTION_PAYMENT_ENV=test and Stripe sk_test key required. Production real-money processing needs separate redesign/review.
- Public deployment: not authorized; Vercel production currently sourced from older billboard release branch.

## Independent review output
Return BLOCK / CONDITIONAL / READY, findings by severity, patch recommendations, and tests. BLOCK real-money operation if any high-severity issue remains.

## 2026-10-31 correction

Never permanently inbox a mismatched paid or refund event as `held`; the RPC now rolls back and requests provider retry. The bidder deadline is evaluated after the auction row lock. `OUTBID` is HTTP 409. CI exercises contention, failed payment posting, API HTTP boundary and Stripe isolation. Source is still DRAFT, not deployed or independently audited.
