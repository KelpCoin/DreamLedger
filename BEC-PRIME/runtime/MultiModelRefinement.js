'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ledger = require('./Ledger');

const ROOT = path.join(__dirname, '..');
const MEMORY_DIR = path.resolve(process.env.BEC_REFINEMENT_MEMORY_DIR || path.join(ROOT, 'data', 'refinement'));

function id(prefix) {
  return prefix + '_' + new Date().toISOString().replace(/[-:.TZ]/g, '') + '_' + crypto.randomBytes(4).toString('hex');
}

function hash(value) {
  return 'sha256:' + ledger.sha256(value);
}

function endpointHeaders(apiKey) {
  return apiKey
    ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey }
    : { 'Content-Type': 'application/json' };
}

function defaultConfig() {
  const baseUrl = process.env.BEC_LM_URL || 'http://127.0.0.1:1234/v1/chat/completions';
  return {
    scout: {
      role: 'scout',
      model: process.env.BEC_SCOUT_MODEL || 'phi-3-mini-4k-instruct',
      url: process.env.BEC_SCOUT_LM_URL || baseUrl,
      apiKey: process.env.BEC_SCOUT_LM_API_KEY || ''
    },
    critic: {
      role: 'critic',
      model: process.env.BEC_CRITIC_MODEL || 'qwen2.5-7b-instruct',
      url: process.env.BEC_CRITIC_LM_URL || baseUrl,
      apiKey: process.env.BEC_CRITIC_LM_API_KEY || ''
    },
    synthesis: {
      role: 'synthesis',
      model: process.env.BEC_SYNTHESIS_MODEL || 'qwen2.5-coder-14b-instruct',
      url: process.env.BEC_SYNTHESIS_LM_URL || baseUrl,
      apiKey: process.env.BEC_SYNTHESIS_LM_API_KEY || ''
    }
  };
}

function loadConfig() {
  const configuredPath = process.env.BEC_MULTI_MODEL_CONFIG;
  if (configuredPath && fs.existsSync(path.resolve(configuredPath))) {
    return JSON.parse(fs.readFileSync(path.resolve(configuredPath), 'utf8'));
  }
  return defaultConfig();
}

function validateConfig(config) {
  const stages = ['scout', 'critic', 'synthesis'];
  const seen = new Set();
  for (const stage of stages) {
    const item = config && config[stage];
    if (!item || !item.model || !item.url) {
      throw new Error('MULTI_MODEL_CONFIG_MISSING_' + stage.toUpperCase());
    }
    if (seen.has(item.model)) {
      throw new Error('MULTI_MODEL_REQUIRES_THREE_DISTINCT_MODELS');
    }
    seen.add(item.model);
  }
  return stages.map(stage => config[stage]);
}

async function callModel(stage, item, messages, temperature) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.BEC_MULTI_MODEL_TIMEOUT_MS || 120000));
  try {
    const response = await fetch(item.url, {
      method: 'POST',
      headers: endpointHeaders(item.apiKey),
      body: JSON.stringify({
        model: item.model,
        messages,
        temperature: Number(temperature)
      }),
      signal: controller.signal
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(stage.toUpperCase() + '_HTTP_' + response.status + ': ' + responseText.slice(0, 1200));
    }
    const data = JSON.parse(responseText);
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error(stage.toUpperCase() + '_EMPTY_RESPONSE');
    }
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

function memoryPath(jobId) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  return path.join(MEMORY_DIR, jobId + '.json');
}

function saveMemory(file, memory) {
  const canonical = JSON.stringify(memory, null, 2) + '\n';
  fs.writeFileSync(file, canonical, 'utf8');
}

async function run(job, options = {}) {
  if (!job || !job.job_id || !job.task) throw new Error('MULTI_MODEL_JOB_INVALID');

  const config = options.config || loadConfig();
  const models = validateConfig(config);
  const file = memoryPath(job.job_id);

  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (existing.status === 'COMPLETE' && existing.final_output) {
      return existing.final_output;
    }
  }

  const startedAt = new Date().toISOString();
  const memory = {
    schema_version: 'BEC-MULTI-MODEL-MEMORY-1.0',
    memory_id: id('memory'),
    job_id: job.job_id,
    silo: job.silo,
    task_hash: hash(job.task),
    status: 'RUNNING',
    started_at: startedAt,
    stages: [],
    approval_required: true,
    public_action_allowed: false
  };

  saveMemory(file, memory);

  ledger.appendEvent({
    graph_id: 'BEC-RUNTIME',
    branch_id: job.job_id,
    node_id: 'multi-model-orchestrator',
    event_type: 'REFINEMENT_STARTED',
    silo: job.silo,
    inputs_hash: job.input_hash,
    payload: { memory_id: memory.memory_id, stage_count: 3 }
  });

  const scoutMessages = [
    {
      role: 'system',
      content: 'You are the SCOUT model in a three-model BrownEye Cortex refinement pipeline. Find relevant facts, options, assumptions, and useful candidate ideas. Separate evidence from inference. Do not claim external execution, revenue, buyers, payments, or fulfillment.'
    },
    {
      role: 'user',
      content: 'TASK:\n' + job.task + '\n\nINPUTS:\n' + JSON.stringify(job.inputs || {})
    }
  ];

  const scout = await callModel('scout', models[0], scoutMessages, 0.2);
  memory.stages.push({
    stage: 'SCOUT',
    role: 'proposer',
    model: models[0].model,
    output: scout,
    output_hash: hash(scout),
    completed_at: new Date().toISOString()
  });
  saveMemory(file, memory);

  ledger.appendEvent({
    graph_id: 'BEC-RUNTIME',
    branch_id: job.job_id,
    node_id: 'multi-model-orchestrator',
    event_type: 'REFINEMENT_STAGE_COMPLETE',
    silo: job.silo,
    inputs_hash: job.input_hash,
    payload: { stage: 'SCOUT', model: models[0].model, output_hash: hash(scout) }
  });

  const criticMessages = [
    {
      role: 'system',
      content: 'You are the CRITIC model in a three-model BrownEye Cortex refinement pipeline. Adversarially inspect the scout output for factual gaps, contradictions, stale assumptions, silo leakage, security problems, unnecessary complexity, and unsupported economic claims. State what must change. Do not perform actions.'
    },
    {
      role: 'user',
      content: 'TASK:\n' + job.task + '\n\nSCOUT OUTPUT:\n' + scout
    }
  ];

  const critic = await callModel('critic', models[1], criticMessages, 0.1);
  memory.stages.push({
    stage: 'CRITIC',
    role: 'adversary',
    model: models[1].model,
    output: critic,
    output_hash: hash(critic),
    completed_at: new Date().toISOString(),
    prior_stage_hash: hash(scout)
  });
  saveMemory(file, memory);

  ledger.appendEvent({
    graph_id: 'BEC-RUNTIME',
    branch_id: job.job_id,
    node_id: 'multi-model-orchestrator',
    event_type: 'REFINEMENT_STAGE_COMPLETE',
    silo: job.silo,
    inputs_hash: job.input_hash,
    payload: { stage: 'CRITIC', model: models[1].model, output_hash: hash(critic), prior_stage_hash: hash(scout) }
  });

  const synthesisMessages = [
    {
      role: 'system',
      content: 'You are the SYNTHESIS model in a three-model BrownEye Cortex refinement pipeline. Produce the smallest defensible final artifact from the task, scout output, and critique. Preserve approval gates, silo boundaries, evidence-before-claims, and revenue truth. Do not claim execution or invent evidence.'
    },
    {
      role: 'user',
      content: 'TASK:\n' + job.task + '\n\nSCOUT OUTPUT:\n' + scout + '\n\nCRITIQUE:\n' + critic
    }
  ];

  const synthesis = await callModel('synthesis', models[2], synthesisMessages, 0.1);
  memory.stages.push({
    stage: 'SYNTHESIS',
    role: 'refiner',
    model: models[2].model,
    output: synthesis,
    output_hash: hash(synthesis),
    completed_at: new Date().toISOString(),
    prior_stage_hashes: [hash(scout), hash(critic)]
  });

  const finalOutput = {
    worker: 'multi-model-refinement',
    mode: 'THREE_MODEL_ITERATIVE_REFINEMENT',
    stages: memory.stages,
    content: synthesis
  };

  memory.status = 'COMPLETE';
  memory.completed_at = new Date().toISOString();
  memory.final_output = finalOutput;
  memory.final_output_hash = hash(finalOutput);
  memory.config_hash = hash(config);
  saveMemory(file, memory);

  ledger.appendEvent({
    graph_id: 'BEC-RUNTIME',
    branch_id: job.job_id,
    node_id: 'multi-model-orchestrator',
    event_type: 'REFINEMENT_COMPLETE',
    silo: job.silo,
    inputs_hash: job.input_hash,
    outputs_hash: memory.final_output_hash,
    payload: {
      memory_id: memory.memory_id,
      stages: 3,
      models: models.map(x => x.model),
      output_hash: memory.final_output_hash
    }
  });

  return finalOutput;
}

module.exports = {
  loadConfig,
  validateConfig,
  run
};
