'use strict';

module.exports = function version(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify({
    service: 'dreamledger',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'unknown',
    build_timestamp: process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN ? new Date().toISOString() : new Date().toISOString(),
    verified_contract: 'production-version-v1'
  }));
};
