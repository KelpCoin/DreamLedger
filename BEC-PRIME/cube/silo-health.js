'use strict';
// BECK-internal CUBE diagnostic, never exposed as a public route.
const QUERY=[
 "SELECT sc.silo_id, sc.status AS silo_state,",
 "(SELECT count(*)::integer FROM marketplace.listings l",
 " WHERE l.silo_id=sc.silo_id AND l.status='published') AS marked_published,",
 "(SELECT count(*)::integer FROM marketplace.listings l",
 " JOIN marketplace.supply_attestations a ON a.listing_id=l.id",
 " WHERE l.silo_id=sc.silo_id AND l.status='published' AND l.quantity>0",
 " AND a.silo_id=l.silo_id AND a.status='verified' AND a.expires_at>now()",
 " AND a.verified_quantity>=l.quantity) AS stock_attested,",
 "(SELECT count(*)::integer FROM marketplace.silo_listing_intake q",
 " WHERE q.silo_id=sc.silo_id AND q.status IN ('pending','review')) AS pending_intake,",
 "(SELECT count(*)::integer FROM marketplace.stock_reservations h",
 " JOIN marketplace.listings l ON l.id=h.listing_id",
 " WHERE l.silo_id=sc.silo_id AND h.status='held' AND h.expires_at>now()) AS live_holds,",
 "(SELECT count(*)::integer FROM marketplace.stock_reservations h",
 " JOIN marketplace.listings l ON l.id=h.listing_id",
 " WHERE l.silo_id=sc.silo_id AND h.status='held' AND h.expires_at<=now()) AS expired_holds,",
 "(SELECT count(*)::integer FROM marketplace.community_posts c",
 " WHERE c.silo_id=sc.silo_id AND c.status='pending') AS pending_community,",
 "(SELECT count(*)::integer FROM marketplace.community_posts c",
 " WHERE c.silo_id=sc.silo_id AND c.status='published') AS published_community,",
 "(SELECT pg_get_userbyid(relowner)=current_user",
 " FROM pg_class WHERE oid='marketplace.supply_attestations'::regclass)",
 " AS runtime_is_attestation_owner",
 "FROM marketplace.silo_contracts sc WHERE sc.silo_id=$1"
].join(' ');
function inspect(row) {
 if(!row||typeof row!=='object')return {state:'UNKNOWN_SILO',clone_ready:false};
 const metrics={};
 for(const k of ['marked_published','stock_attested','pending_intake','live_holds',
  'expired_holds','pending_community','published_community']){
  const n=Number(row[k]);
  if(!Number.isSafeInteger(n)||n<0)throw Error('INVALID_HEALTH_DATA');
  metrics[k]=n;
 }
 const untrustedOwner=row.runtime_is_attestation_owner!==false;
 const inconsistencies=metrics.marked_published>metrics.stock_attested;
 return {
  schema:'CUBE/SILO-HEALTH/v1',silo_id:String(row.silo_id),
  state:untrustedOwner?'HOLD_UNSEPARATED_VERIFIER_AUTHORITY':
    inconsistencies?'HOLD_UNATTESTED_PUBLISHED_STOCK':'HOLD_ECONOMIC_LOOP_UNVERIFIED',
  silo_state:String(row.silo_state),
  clone_ready:false,
  metrics,
  proof:{
   verifier_writer_separated:!untrustedOwner,
   all_published_stock_attested:!inconsistencies,
   independently_settled_paid_orders:null,
   checkout_failure_rate:null,
   fulfilled_orders_verified:null,
   fulfillment_lag_hours:null,
   customer_acceptance_verified:null,
   external_activity_verified:false
  },
  actions_required:[
   ...(untrustedOwner?['SEPARATE_VERIFIER_DATABASE_ROLE']:[]),
   ...(inconsistencies?['QUARANTINE_UNATTESTED_PUBLISHED_LISTINGS']:[]),
   'VERIFY_PAYMENT_TO_FULFILLMENT_TO_CUSTOMER_CONFIRMATION'
  ]
 };
}
async function probe(silo,query) {
 if(typeof silo!=='string'||!/^[a-z0-9-]{2,48}$/.test(silo))throw Error('INVALID_SILO');
 if(typeof query!=='function')throw Error('QUERY_REQUIRED');
 const rows=await query(QUERY,[silo]);
 if(!Array.isArray(rows))throw Error('UNVERIFIABLE_HEALTH');
 return rows.length===1?inspect(rows[0]):inspect(null);
}
module.exports={QUERY,inspect,probe};
