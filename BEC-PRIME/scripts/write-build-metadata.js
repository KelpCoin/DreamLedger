'use strict';
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'BUILD-METADATA.json');
const metadata = { commit: process.env.RENDER_GIT_COMMIT || process.env.RENDER_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'unknown', build_time: new Date().toISOString(), environment: process.env.RENDER_ENV || process.env.NODE_ENV || 'production' };
fs.writeFileSync(target, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
console.log('BUILD_METADATA_WRITTEN', JSON.stringify({ commit: metadata.commit, build_time: metadata.build_time, environment: metadata.environment }));
