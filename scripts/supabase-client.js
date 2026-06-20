// scripts/supabase-client.js
// Minimal Supabase event spine connector for DreamLedger

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

async function insertEvent(event) {
  if (!supabase) {
    return { ok: false, reason: 'not_configured' };
  }

  const payload = {
    ts: new Date().toISOString(),
    source: event.source || 'unknown',
    type: event.type || 'unknown',
    payload: event
  };

  const { data, error } = await supabase
    .from('dreamledger_events')
    .insert([payload]);

  if (error) {
    return { ok: false, error };
  }

  return { ok: true, data };
}

module.exports = {
  insertEvent
};
