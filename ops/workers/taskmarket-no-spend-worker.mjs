#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PLATFORM = 'Taskmarket';
const CLI_VERSION = '1.17.2';
const PUBLIC_API = 'https://api.taskmarket.dev';
const MAX_AUTOMATED_SPEND_USD = 0;
const MAX_AUTOMATED_SUBMISSIONS = 0;

function extractTasks(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.tasks,
    payload?.data?.tasks,
    payload?.data?.items,
    payload?.items,
    payload?.results,
    payload?.data?.results
  ];
  return candidates.find(Array.isArray) || null;
}

function firstLine(value) {
  return String(value || '')
    .replace(/^\s*#+\s*/, '')
    .split(/\r?\n/, 1)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function asNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function usdcAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (/^\d+$/.test(text) && text.length >= 6) return Number(text) / 1_000_000;
  const valueNumber = Number(text);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

function taskText(task) {
  return [
    task.title,
    task.name,
    task.description,
    task.requirements,
    task.deliverable,
    task.submit
  ].filter(Boolean).join('\n');
}

export function classifyTask(task, now = new Date()) {
  const blockers = [];
  const mode = String(task.mode || '').toLowerCase();
  const status = String(task.status || '').toLowerCase();
  const expiryRaw = task.expiryTime || task.expiresAt || task.deadline || task.dueAt || null;
  const expiryMs = expiryRaw ? Date.parse(expiryRaw) : NaN;
  const submissionCount = asNumber(task.submissionCount, null);
  const awardCount = asNumber(task.awardCount, null);
  const netRewardUsdc = usdcAmount(task.netReward ?? task.reward);
  const text = taskText(task);

  if (status !== 'open') blockers.push('task_not_open');
  if (mode !== 'bounty') blockers.push('not_a_bounty');
  if (!Number.isFinite(expiryMs)) blockers.push('deadline_not_verified');
  else if (expiryMs <= now.getTime()) blockers.push('task_expired');
  if (task.stakeRequired === true || asNumber(task.stakeBps, 0) > 0) blockers.push('stake_required');
  if (awardCount !== 0) blockers.push('already_has_award');
  if (submissionCount === null) blockers.push('competition_count_unknown');
  else if (submissionCount > 5) blockers.push('high_competition_over_5_submissions');
  if (netRewardUsdc === null || netRewardUsdc <= 0) blockers.push('positive_reward_not_verified');

  const publicationPattern = /\b(publish|published|posting|post on|tweet|twitter|x\.com|farcaster|bluesky|threads|medium|dev\.to|social media|discord|share once|engagement|public url|public repo|submit your publication links)\b/i;
  const walletPattern = /\b(your wallet address|bsc address|wallet you control|deposit funds|fund your wallet|stake required|send funds|buyback|swap|trade tokens)\b/i;
  const requiresExternalPublication = publicationPattern.test(text);
  const requiresWalletOrFinancialStep = walletPattern.test(text);
  if (requiresExternalPublication) blockers.push('external_publication_requires_operator_authorization');
  if (requiresWalletOrFinancialStep) blockers.push('wallet_or_financial_step_requires_review');

  const basicTaskFit =
    status === 'open' &&
    mode === 'bounty' &&
    Number.isFinite(expiryMs) &&
    expiryMs > now.getTime() &&
    task.stakeRequired !== true &&
    asNumber(task.stakeBps, 0) === 0 &&
    awardCount === 0 &&
    submissionCount !== null &&
    submissionCount <= 5 &&
    netRewardUsdc !== null &&
    netRewardUsdc > 0 &&
    !requiresExternalPublication &&
    !requiresWalletOrFinancialStep;

  return {
    task_id: String(task.id || task.taskId || ''),
    title: firstLine(task.title || task.name || task.description) || 'Untitled task',
    mode,
    status,
    reward_usdc_net: netRewardUsdc,
    submission_count: submissionCount,
    award_count: awardCount,
    expires_at: Number.isFinite(expiryMs) ? new Date(expiryMs).toISOString() : null,
    requires_external_publication: requiresExternalPublication,
    requires_wallet_or_financial_step: requiresWalletOrFinancialStep,
    read_only_candidate: basicTaskFit,
    submission_ready: false,
    blockers
  };
}

export function buildReport(payload, now = new Date(), source = {}) {
  const tasks = extractTasks(payload);
  if (!tasks) throw new Error('TASK_LIST_SCHEMA_UNRECOGNIZED');

  const classified = tasks
    .map((task) => classifyTask(task, now))
    .sort((a, b) => {
      if (a.read_only_candidate !== b.read_only_candidate) return a.read_only_candidate ? -1 : 1;
      if ((a.submission_count ?? Infinity) !== (b.submission_count ?? Infinity)) {
        return (a.submission_count ?? Infinity) - (b.submission_count ?? Infinity);
      }
      return (b.reward_usdc_net ?? 0) - (a.reward_usdc_net ?? 0);
    });

  const report = {
    schema: 'DREAMLEDGER/TASKMARKET-NO-SPEND-DISCOVERY/v1',
    generated_at_utc: now.toISOString(),
    source: {
      platform: PLATFORM,
      public_api: source.api || PUBLIC_API,
      cli_package: '@lucid-agents/taskmarket',
      cli_version: source.cliVersion || CLI_VERSION
    },
    policy: {
      max_automated_spend_usd: MAX_AUTOMATED_SPEND_USD,
      max_automated_submissions: MAX_AUTOMATED_SUBMISSIONS,
      wallet_creation_allowed: false,
      legal_acceptance_allowed: false,
      claim_or_bid_allowed: false,
      public_posting_allowed: false,
      paid_x402_retry_allowed: false
    },
    run_state: {
      public_task_list_read: true,
      wallet_created: false,
      legal_bundle_accepted: false,
      submission_attempted: false,
      payment_attempted: false,
      verified_revenue_usd: '0.00'
    },
    summary: {
      open_tasks_observed: classified.filter((t) => t.status === 'open').length,
      read_only_candidates: classified.filter((t) => t.read_only_candidate).length,
      submission_ready: 0,
      verdict: classified.some((t) => t.read_only_candidate)
        ? 'CANDIDATE_FOUND_REVIEW_REQUIRED'
        : 'NO_LOW_COMPETITION_NO_SPEND_CANDIDATE'
    },
    tasks: classified,
    limitation: 'Public task data does not prove a free submission allowance. Submission stays disabled until the current task allowance, legal receipt, artifact readiness, and authorized wallet are independently verified.'
  };

  const digest = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
  return { ...report, report_sha256: digest };
}

function arg(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : '';
}

function main() {
  const inputPath = arg('--input');
  const outputPath = arg('--output');
  if (!inputPath || !outputPath) {
    console.error('Usage: node ops/workers/taskmarket-no-spend-worker.mjs --input task-list.json --output report.json');
    process.exitCode = 2;
    return;
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  } catch (error) {
    console.error('TASK_LIST_JSON_INVALID:', error.message);
    process.exitCode = 2;
    return;
  }

  try {
    const report = buildReport(payload, new Date(), {
      api: process.env.TASKMARKET_API_URL || PUBLIC_API,
      cliVersion: CLI_VERSION
    });
    const target = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    console.log(JSON.stringify({
      schema: report.schema,
      generated_at_utc: report.generated_at_utc,
      open_tasks_observed: report.summary.open_tasks_observed,
      read_only_candidates: report.summary.read_only_candidates,
      submission_ready: report.summary.submission_ready,
      verdict: report.summary.verdict,
      report_sha256: report.report_sha256,
      output_path: target,
      external_actions: false,
      payments: false
    }, null, 2));
  } catch (error) {
    console.error('TASKMARKET_DISCOVERY_FAILED:', error.message);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
