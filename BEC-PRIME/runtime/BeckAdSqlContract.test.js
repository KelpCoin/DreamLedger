'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/202611010001_beck_ad_reservations.sql'),'utf8');
test('migration is one transaction and one reservation routine',()=>{
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION public\.beck_ad_reserve_tile/g)||[]).length,1);
 assert.equal((sql.match(/CREATE TABLE IF NOT EXISTS public\.beck_ad_canvases/g)||[]).length,1);
 assert.equal((sql.match(/CREATE TABLE IF NOT EXISTS public\.beck_ad_reservations/g)||[]).length,1);
 assert.match(sql,/\bBEGIN;[\s\S]*\bCOMMIT;/);
});
test('registered capacity starts disabled and never trusts caller dimensions',()=>{
 assert.match(sql,/booking_enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/registered\.booking_enabled IS NOT TRUE/);
 assert.match(sql,/registered\.width <> p_canvas_width/);
 assert.match(sql,/registered\.height <> p_canvas_height/);
});
test('scope-level serialization precedes inventory overlap checks',()=>{
 const lock=sql.indexOf('pg_advisory_xact_lock');
 const overlap=sql.indexOf("'inventory_overlap'");
 assert.ok(lock>0&&overlap>lock);
 assert.match(sql,/idempotency_key/);
 assert.match(sql,/UNIQUE \(exhaust, silo, canvas, idempotency_key\)/);
});
test('client roles cannot access raw inventory or reserve RPC',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.beck_ad_reservations FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.beck_ad_reserve_tile/);
 assert.match(sql,/TO service_role/);
});

const checkoutSql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/202611010002_beck_ad_checkout_binding.sql'),'utf8');
test('payment migration provides checkout binding and receipt function once',()=>{
 assert.equal((checkoutSql.match(/CREATE OR REPLACE FUNCTION public\.beck_ad_bind_checkout/g)||[]).length,1);
 assert.equal((checkoutSql.match(/CREATE OR REPLACE FUNCTION public\.beck_ad_record_paid/g)||[]).length,1);
 assert.match(checkoutSql,/CREATE TABLE IF NOT EXISTS public\.beck_ad_payment_receipts/);
 assert.match(checkoutSql,/\bBEGIN;[\s\S]*\bCOMMIT;/);
});
test('paid receipt never auto-publishes and remains in review',()=>{
 assert.match(checkoutSql,/PAID_PENDING_CREATIVE_REVIEW/);
 assert.doesNotMatch(checkoutSql,/UPDATE public\.beck_ad_reservations SET status='PUBLISHED'/);
 assert.match(checkoutSql,/SET status='PAID'/);
});
test('payment and binding require held and non-expired reservation',()=>{
 assert.match(checkoutSql,/r\.status<>'HELD'/);
 assert.match(checkoutSql,/r\.hold_expires_at<=clock_timestamp\(\)/);
 assert.match(checkoutSql,/r\.checkout_session_id IS DISTINCT FROM p_session_id/);
});
test('payment receipts are unique and closed to anonymous clients',()=>{
 assert.match(checkoutSql,/reservation_id uuid NOT NULL UNIQUE/);
 assert.match(checkoutSql,/checkout_session_id text NOT NULL UNIQUE/);
 assert.match(checkoutSql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(checkoutSql,/REVOKE ALL ON public\.beck_ad_payment_receipts FROM PUBLIC, anon, authenticated/);
});
