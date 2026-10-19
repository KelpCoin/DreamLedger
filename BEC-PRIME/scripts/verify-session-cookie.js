'use strict';

process.env.DREAMLEDGER_SESSION_SECRET = 'unit-test-session-secret-01234567890123456789';
const session = require('../lib/sessionCookie');

const id = 'u_test_identity_123';
const encoded = session.encode(id);
if (session.decode(encoded) !== id) throw new Error('SESSION_ROUNDTRIP_FAIL');
if (session.decode(session.encode('u_other')) === id) throw new Error('SESSION_CROSS_ID_FAIL');
if (session.decode(encoded.slice(0, -1) + (encoded.endsWith('a') ? 'b' : 'a'))) throw new Error('SESSION_TAMPER_FAIL');
if (!session.COOKIE.startsWith('__Host-')) throw new Error('SESSION_HOST_PREFIX_FAIL');
if (session.MAX_AGE !== 604800) throw new Error('SESSION_MAX_AGE_FAIL');

console.log('SESSION_COOKIE_UNIT_PASS');
