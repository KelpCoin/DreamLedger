'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(__dirname, 'worker-registry.json');

function loadRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
}

function localAdvertisement() {
  return {
    worker_id: process.env.BEC_LOCAL_WORKER_ID || 'win-local-01',
    availability: process.env.BEC_WORKER_AVAILABILITY || 'online',
    trust_level: 'local',
    gpu: {
      vendor: process.env.BEC_GPU_VENDOR || 'unknown',
      vram_mb: Number(process.env.BEC_GPU_VRAM_MB || 0)
    },
    models: [process.env.BEC_LM_MODEL || 'phi-3-mini-4k-instruct'],
    context_length: Number(process.env.BEC_LM_CONTEXT || 32768),
    tools: ['analyze', 'edit', 'test'],
    network: 'offline-capable',
    cost: { class: 'sunk', unit: 'relative' },
    latency_class: 'local',
    permissions: ['ANALYZE', 'EDIT']
  };
}

function advertisedWorkers() {
  const registry = loadRegistry();
  const workers = [localAdvertisement()];
  if (process.env.BEC_GPU_LM_URL && process.env.BEC_GPU_LM_MODEL) workers.push({ worker_id: 'gpu-remote-01', availability: 'online', trust_level: 'cloud', gpu: { vendor: process.env.BEC_GPU_VENDOR || 'nvidia', vram_mb: Number(process.env.BEC_GPU_VRAM_MB || 0) }, models: [process.env.BEC_GPU_LM_MODEL], context_length: Number(process.env.BEC_GPU_CONTEXT || 32768), tools: ['analyze', 'edit', 'test'], network: 'online', cost: { class: 'configured', unit: 'relative' }, latency_class: 'regional', permissions: ['ANALYZE', 'EDIT'] });
  if (process.env.BEC_CLOUD_LM_URL && process.env.BEC_CLOUD_LM_MODEL) workers.push({ worker_id: 'cloud-remote-01', availability: 'online', trust_level: 'cloud', gpu: { vendor: 'provider', vram_mb: 0 }, models: [process.env.BEC_CLOUD_LM_MODEL], context_length: Number(process.env.BEC_CLOUD_LM_CONTEXT || 32768), tools: ['analyze', 'edit', 'test'], network: 'online', cost: { class: 'metered', unit: 'relative' }, latency_class: 'remote', permissions: ['ANALYZE', 'EDIT'] });
  return { registry, workers };
}

function choose(job) {
  const { registry, workers } = advertisedWorkers();
  const routes = registry.routing[job.kind] || registry.routing.default || [];
  const preference = job.worker_preference || 'auto';
  const requested = preference === 'auto' ? routes : [preference];
  const available = workers.filter(worker => worker.availability === 'online');
  for (const name of requested) {
    if (name === 'local-lmstudio' && available.some(w => w.trust_level === 'local')) return { adapter: 'local-lmstudio', execution_node: process.env.GITHUB_ACTIONS === 'true' ? 'self-hosted-windows' : 'local-process', worker: available.find(w => w.trust_level === 'local') };
    if (name === 'gpu' && available.some(w => w.worker_id.startsWith('gpu-'))) return { adapter: 'gpu', execution_node: 'gpu-node', worker: available.find(w => w.worker_id.startsWith('gpu-')) };
    if (name === 'cloud' && available.some(w => w.worker_id.startsWith('cloud-'))) return { adapter: 'cloud', execution_node: 'cloud-gpu-or-api', worker: available.find(w => w.worker_id.startsWith('cloud-')) };
    if (name === 'self-hosted-windows' && process.env.GITHUB_ACTIONS === 'true') return { adapter: 'local-lmstudio', execution_node: 'self-hosted-windows', worker: available.find(w => w.trust_level === 'local') };
  }
  return { adapter: 'deterministic', execution_node: 'none', worker: null };
}

module.exports = { loadRegistry, advertisedWorkers, choose };

