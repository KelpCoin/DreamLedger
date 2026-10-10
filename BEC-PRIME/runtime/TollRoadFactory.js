'use strict';

const ROAD_COUNT = 10000;
const ROAD_PRICE_NZD = 1;
const CALLS_PER_ROAD = 100;
const SCHEMA = 'dreamledger/toll-road/v1';

function roadNumber(id) {
  const match = String(id || '').match(/^ROAD-(\d{6})$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n >= 1 && n <= ROAD_COUNT ? n : null;
}

function getRoad(id) {
  const n = roadNumber(id);
  if (n === null) return null;
  const roadId = 'ROAD-' + String(n).padStart(6, '0');
  return {
    schema: SCHEMA,
    road_id: roadId,
    status: 'published',
    scope: 'road',
    route: '/api/toll/v1/roads/' + roadId,
    checkout_route: '/api/toll/v1/checkout/road/' + roadId,
    redeem_route: '/api/toll/v1/redeem/road/' + roadId,
    price_nzd: ROAD_PRICE_NZD,
    calls_per_pack: CALLS_PER_ROAD,
    ttl_days: 30,
    description: 'A separately key-scoped API namespace that accepts JSON and returns a payload-hash receipt. It does not store the payload or trigger downstream work.',
    service_model: 'bounded_receipt_only',
    payment_status: 'requires_live_settled_stripe_payment',
    economic_status: 'UNVERIFIED_UNTIL_EXTERNAL_SETTLEMENT_AND_FULFILLMENT_EVIDENCE',
    namespace_number: n
  };
}

function listRoads({ offset = 0, limit = 50 } = {}) {
  if (!Number.isInteger(offset) || offset < 0 || offset >= ROAD_COUNT) {
    return { error: 'offset_out_of_range', count: ROAD_COUNT, offset, limit: 0, roads: [] };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { error: 'limit_must_be_between_1_and_100', count: ROAD_COUNT, offset, limit: 0, roads: [] };
  }
  const end = Math.min(offset + limit, ROAD_COUNT);
  const roads = [];
  for (let n = offset + 1; n <= end; n++) roads.push(getRoad('ROAD-' + String(n).padStart(6, '0')));
  return { count: ROAD_COUNT, offset, limit: roads.length, next_offset: end < ROAD_COUNT ? end : null, roads };
}

module.exports = { ROAD_COUNT, ROAD_PRICE_NZD, CALLS_PER_ROAD, getRoad, listRoads };
