'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');
const ASSET_DIR = path.join(ROOT, 'data', 'dreamiez', 'assets');
const LM_STUDIO_URL = (process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');

function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function deterministicAsset({ accountId, rewardDay, streak }) {
  const seed = digest(`${accountId}:${rewardDay}:${streak}`);
  return {
    asset_id: `ELOHIM-V6-${rewardDay}-${seed.slice(0, 12).toUpperCase()}`,
    generator: 'ELOHIM-V6',
    account_id: accountId,
    streak_required: rewardDay,
    tier: rewardDay >= 30 ? 'CROWN' : rewardDay >= 14 ? 'ASCENDANT' : rewardDay >= 7 ? 'PRIME' : rewardDay >= 3 ? 'SIGNAL' : 'SPARK',
    title: rewardDay >= 30 ? 'DreamMeez Crown' : rewardDay >= 14 ? 'DreamMeez Ascendant' : rewardDay >= 7 ? 'DreamMeez Prime' : rewardDay >= 3 ? 'DreamMeez Signal' : 'DreamMeez Spark',
    description: 'A DreamMeez asset generated from a verified daily streak.',
    seed,
    generated_at: new Date().toISOString()
  };
}

async function askLocalModel(prompt) {
  if (process.env.ELOHIM_V6_LM_STUDIO !== 'true') return null;
  const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ELOHIM_V6_MODEL || 'local-model',
      messages: [
        { role: 'system', content: 'You are Elohim V6. Return concise JSON only. Never invent payments, customers, credentials, or external actions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 500
    })
  });
  if (!response.ok) throw new Error(`LM Studio ${response.status}`);
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
}

function generateReward(input) {
  const accountId = String(input.account_id || '');
  const rewardDay = Number(input.reward_day || 0);
  const streak = Number(input.streak || 0);
  if (!accountId || rewardDay < 1 || streak < rewardDay) throw new Error('Reward eligibility failed');
  const asset = deterministicAsset({ accountId, rewardDay, streak });
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const file = path.join(ASSET_DIR, `${asset.asset_id}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(asset, null, 2) + '\n', 'utf8');
  return asset;
}

async function propose(input) {
  const localModel = await askLocalModel(JSON.stringify(input));
  const proposal = {
    type: 'elohim-v6-proposal',
    proposal_id: `ELOHIM-P-${digest(JSON.stringify(input)).slice(0, 16)}`,
    status: 'PROPOSED',
    created_at: new Date().toISOString(),
    input,
    local_model_result: localModel,
    allowed_actions: ['generate_asset', 'write_proof', 'update_candidate'],
    forbidden_without_human_approval: ['publish', 'send_message', 'charge_customer', 'execute_external_action', 'change_approval_gate']
  };
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROOF_DIR, `${proposal.proposal_id}.json`), JSON.stringify(proposal, null, 2) + '\n', 'utf8');
  return proposal;
}

module.exports = { generateReward, propose };
