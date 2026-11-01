import {verifyMtgTestSession} from "./session-guard.ts";
const order={id:"11111111-1111-4111-8111-111111111111",auction_id:"22222222-2222-4222-8222-222222222222",amount_cents:2950,currency:"NZD"};
const now=Date.parse("2026-11-01T12:00:00.000Z");
const good={
 id:"cs_test_synthetic01",livemode:false,mode:"payment",status:"open",
 payment_status:"unpaid",client_reference_id:order.id,amount_total:2950,
 currency:"nzd",expires_at:Math.floor(now/1000)+1800,
 metadata:{mtg_order_id:order.id,mtg_auction_id:order.auction_id,silo:"mtg"},
 url:"https://checkout.stripe.com/c/pay/testing"
};
function check(name:string,variant:Record<string,unknown>,expected:boolean) {
 Deno.test(name,()=>{
   const actual=verifyMtgTestSession({...good,...variant},order,now);
   if(actual!==expected)throw Error(name+" accepted="+actual+" expected="+expected);
 });
}
check("exact unpaid Stripe test Session is reusable",{},true);
check("paid session must never be returned",{payment_status:"paid"},false);
check("expired or complete session cannot be reused",{status:"complete"},false);
check("test-only key cannot return live Session",{livemode:true,id:"cs_live_synthetic01"},false);
check("another order session cannot be reused",{client_reference_id:"wrong_order"},false);
check("another lot session cannot be reused",{metadata:{...good.metadata,mtg_auction_id:"other"}},false);
check("cross-silo session cannot be reused",{metadata:{...good.metadata,silo:"ads"}},false);
check("wrong amount session cannot be reused",{amount_total:3000},false);
check("wrong currency session cannot be reused",{currency:"usd"},false);
check("unpaid Session with expired timestamp is blocked",{expires_at:Math.floor(now/1000)-1},false);
check("imitation Stripe host blocked",{url:"https://checkout.stripe.com.evil.invalid/pay"},false);
check("insecure checkout URL blocked",{url:"http://checkout.stripe.com/pay"},false);
check("unknown fake Session ID blocked",{id:"invalid_session"},false);
check("unverified Session mode blocked",{mode:"setup"},false);
check("missing metadata blocked",{metadata:null},false);
