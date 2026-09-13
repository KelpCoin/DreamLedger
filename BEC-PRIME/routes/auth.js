'use strict';

// Canonical account route adapter.
// Production account persistence and authentication live in the Supabase-backed
// runtime. Keep this path as the stable import used by start.js/preloads.
module.exports = require('../compiled/website/lib/accountAuth');
