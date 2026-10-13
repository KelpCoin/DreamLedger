'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adapter = fs.readFileSync(path.resolve(__dirname, '777_cloud_execution_adapter.js'), 'utf8');
const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/777-cycle.yml'), 'utf8');

assert.match(adapter, /DREAMLEDGER_777_OUTPUT_DIR \|\| 'artifacts\/777\/internal'/);
assert.match(adapter, /DREAMLEDGER_777_SKIP_MODELS === 'true'/);
assert.match(adapter, /if \(!skipModels && !selected && process\.env\.CLOUD_ELOHIM_URL/);
assert.match(adapter, /if \(!skipModels && !selected && process\.env\.VERCEL_AI_GATEWAY_URL/);
assert.match(adapter, /if \(!skipModels && !selected && process\.env\.ELOHIM_FALLBACK_URL/);
assert.match(adapter, /if \(!skipModels && !selected && localGpu/);
assert.doesNotMatch(adapter, /postJson\(process\.env\.LM_STUDIO_URL/);
assert.match(adapter, /if \(!skipModels && preferLocalGpu && localGpu/);
assert.match(adapter, /function localGpuConfig\(\)/);
assert.match(adapter, /if \(!endpoint \|\| !apiKey\) return null/);
assert.match(adapter, /parsed\.protocol !== 'https:'/);
assert.match(adapter, /local_gpu_authenticated_https_ready: Boolean\(localGpu\)/);
assert.match(adapter, /model_execution_allowed: !skipModels/);
assert.match(adapter, /fs\.readdirSync\(PULSE_DIR/);
assert.match(workflow, /DREAMLEDGER_777_OUTPUT_DIR: artifacts\/777\/internal/);
assert.match(workflow, /DREAMLEDGER_777_MODEL_CALLS_APPROVED != 'true'/);
assert.match(workflow, /DREAMLEDGER_777_LOCAL_GPU_RELAY_APPROVED == 'true'/);
assert.match(workflow, /LM_STUDIO_API_KEY:/);
assert.match(workflow, /artifacts\/777\/internal\/\*\.json/);
console.log('PASS: cloud execution artifacts are private; model endpoints are disabled by default.');
