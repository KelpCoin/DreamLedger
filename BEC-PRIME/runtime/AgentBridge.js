'use strict';

// Canonical bridge entrypoint. HTTP job settlement is fenced by the existing
// database lease_token contract; all other AgentBridge routes remain on the
// existing proxy adapter.
module.exports = require('./AgentBridgeFencedAdapter');
