'use strict';
// Retired JSON-file auction writer. Historical data is preserved, never promoted
// or restarted on reads. Both HTTP entrypoints use routes/userAuctions instead.
const path = require('node:path');
const AUCTION_DATA = path.resolve(process.env.AUCTION_DATA_PATH || path.join(__dirname, 'data', 'auctions.json'));
const AUCTION_PROOFS = path.resolve(process.env.AUCTION_PROOF_DIR || path.join(__dirname, 'data', 'proofs', 'auctions'));
function retired() { throw Object.assign(new Error('LEGACY_AUCTIONS_RETIRED'), { statusCode: 503 }); }
module.exports = { createAuction: retired, placeBid: retired, listAuctions: () => [], getAuction: () => null, AUCTION_DATA, AUCTION_PROOFS };
