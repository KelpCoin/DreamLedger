'use strict';

/*
 * Local Blackboard contract.
 * This is a deterministic in-memory model for the canonical shared-state contract.
 * Production persistence remains a separate adapter. No external effect occurs here.
 */

const crypto = require('crypto');

class Blackboard {
  constructor() {
    this.entries = [];
    this.seen = new Set();
    this.leases = new Map();
    this.proficiency = new Map();
  }

  publish({topic, producer, payload, idempotency_key, observed_at}) {
    if (!topic || !producer || !idempotency_key) throw new Error('topic, producer and idempotency_key required');
    if (this.seen.has(idempotency_key)) {
      return {status:'DEDUPLICATED', idempotency_key};
    }
    const entry = Object.freeze({
      sequence: this.entries.length + 1,
      entry_id: crypto.createHash('sha256').update(idempotency_key).digest('hex'),
      topic: String(topic),
      producer: String(producer),
      idempotency_key: String(idempotency_key),
      payload: payload && typeof payload === 'object' ? structuredClone(payload) : payload,
      observed_at: observed_at || new Date().toISOString()
    });
    this.entries.push(entry);
    this.seen.add(idempotency_key);
    return {status:'APPENDED', entry};
  }

  read(topic, afterSequence = 0) {
    return this.entries.filter(e => e.topic === topic && e.sequence > afterSequence);
  }

  acquireLease(task_id, worker_id, ttl_ms = 30000) {
    if (!task_id || !worker_id) throw new Error('task_id and worker_id required');
    const now = Date.now();
    const existing = this.leases.get(task_id);
    if (existing && existing.expires_at > now && existing.worker_id !== worker_id) {
      return {status:'BUSY', lease: existing};
    }
    const lease = Object.freeze({
      task_id: String(task_id),
      worker_id: String(worker_id),
      acquired_at: now,
      expires_at: now + Math.max(1, ttl_ms)
    });
    this.leases.set(task_id, lease);
    return {status:'ACQUIRED', lease};
  }

  recordProficiency(worker_id, outcome) {
    if (!worker_id) throw new Error('worker_id required');
    const prior = this.proficiency.get(worker_id) || {sample_count:0, successes:0, evidence_quality:0};
    const success = outcome?.success === true ? 1 : 0;
    const evidence = Math.max(0, Math.min(1, Number(outcome?.evidence_quality ?? 0)));
    const next = {
      sample_count: prior.sample_count + 1,
      successes: prior.successes + success,
      reliability: (prior.successes + success) / (prior.sample_count + 1),
      evidence_quality: ((prior.evidence_quality * prior.sample_count) + evidence) / (prior.sample_count + 1)
    };
    this.proficiency.set(worker_id, Object.freeze(next));
    return next;
  }
}

module.exports = {Blackboard};
