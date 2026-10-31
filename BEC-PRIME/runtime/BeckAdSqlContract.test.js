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
