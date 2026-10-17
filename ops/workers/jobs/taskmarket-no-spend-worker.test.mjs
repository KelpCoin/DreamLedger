import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, classifyTask, extractTasks } from '../taskmarket-no-spend-worker.mjs';

const now = new Date('2026-10-17T01:00:00.000Z');

test('extracts the CLI JSON envelope without creating a wallet', () => {
  const tasks = [{ id: 'task-1', status: 'open', mode: 'bounty' }];
  assert.deepEqual(extractTasks({ ok: true, data: { tasks } }), tasks);
});

test('a low-competition bounty can be shortlisted but never auto-submitted', () => {
  const task = {
    id: 'task-low',
    title: 'Build a small JSON normalizer',
    description: 'Produce a deterministic JSON normalizer with tests. Submit a source file.',
    status: 'open',
    mode: 'bounty',
    reward: '2000000',
    netReward: '1850000',
    submissionCount: 2,
    awardCount: 0,
    expiryTime: '2026-10-18T01:00:00.000Z',
    stakeRequired: false,
    stakeBps: 0
  };
  const result = classifyTask(task, now);
  assert.equal(result.read_only_candidate, true);
  assert.equal(result.submission_ready, false);
  assert.equal(result.reward_usdc_net, 1.85);
  assert.deepEqual(result.blockers, []);
});

test('public publishing tasks are not cleared for automatic submission', () => {
  const task = {
    id: 'task-social',
    description: 'Publish an article on Medium and post a thread on X.',
    status: 'open',
    mode: 'bounty',
    reward: '5000000',
    netReward: '4625000',
    submissionCount: 1,
    awardCount: 0,
    expiryTime: '2026-10-18T01:00:00.000Z',
    stakeRequired: false,
    stakeBps: 0
  };
  const result = classifyTask(task, now);
  assert.equal(result.read_only_candidate, false);
  assert.equal(result.requires_external_publication, true);
  assert.ok(result.blockers.includes('external_publication_requires_operator_authorization'));
});

test('high competition and expired tasks are blocked from the shortlist', () => {
  const result = classifyTask({
    id: 'task-crowded',
    title: 'Parse JSON',
    status: 'open',
    mode: 'bounty',
    reward: '2000000',
    netReward: '1850000',
    submissionCount: 13,
    awardCount: 0,
    expiryTime: '2026-10-16T01:00:00.000Z',
    stakeRequired: false,
    stakeBps: 0
  }, now);
  assert.equal(result.read_only_candidate, false);
  assert.ok(result.blockers.includes('high_competition_over_5_submissions'));
  assert.ok(result.blockers.includes('task_expired'));
});

test('report proves all automated writes and spend are disabled', () => {
  const report = buildReport({ ok: true, data: { tasks: [] } }, now);
  assert.equal(report.policy.max_automated_spend_usd, 0);
  assert.equal(report.policy.max_automated_submissions, 0);
  assert.equal(report.run_state.wallet_created, false);
  assert.equal(report.run_state.legal_bundle_accepted, false);
  assert.equal(report.summary.submission_ready, 0);
  assert.match(report.report_sha256, /^[a-f0-9]{64}$/);
});
