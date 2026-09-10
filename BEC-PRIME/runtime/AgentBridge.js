'use strict';

// Canonical bridge implementation. The adapter preserves the public AgentBridge contract
// while removing the Render-side requirement for a Supabase service-role secret.
module.exports = require('./AgentBridgeProxyAdapter');
