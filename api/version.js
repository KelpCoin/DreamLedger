'use strict';

module.exports = function version(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify({
    service: 'dreamledger',
    environment: process.env.RENDER ? 'render' : (process.env.VERCEL_ENV || process.env.NODE_ENV || 'production'),
    commit: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'unknown',
    branch: process.env.RENDER_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    build_timestamp: new Date().toISOString(),
    verified_contract: 'production-version-v2'
  }));
};
