'use strict';

function assertArm(arm) {
  if (!arm || !arm.id) throw new Error('ARM_ID_REQUIRED');
  if (!Number.isInteger(arm.pulls) || arm.pulls < 0) throw new Error('ARM_PULLS_INVALID');
  if (!Number.isFinite(arm.reward) || arm.reward < 0) throw new Error('ARM_REWARD_INVALID');
}

function ucb1(arm, totalPulls, exploration = 2) {
  assertArm(arm);
  if (!Number.isFinite(totalPulls) || totalPulls < 1) throw new Error('TOTAL_PULLS_INVALID');
  if (arm.pulls === 0) return Infinity;
  const mean = arm.reward / arm.pulls;
  return mean + Math.sqrt((exploration * Math.log(totalPulls)) / arm.pulls);
}

function choose(arms, totalPulls = arms.reduce((n, a) => n + a.pulls, 0)) {
  if (!Array.isArray(arms) || !arms.length) throw new Error('NO_ARMS');
  return [...arms].sort((a, b) => ucb1(b, totalPulls) - ucb1(a, totalPulls) || String(a.id).localeCompare(String(b.id)))[0];
}

function update(arm, reward) {
  assertArm(arm);
  if (!Number.isFinite(reward) || reward < 0) throw new Error('REWARD_INVALID');
  return { ...arm, pulls: arm.pulls + 1, reward: arm.reward + reward };
}

function prune(arms, minPulls = 10, minRate = 0.01) {
  if (!Array.isArray(arms)) throw new TypeError('arms must be an array');
  return arms.filter(a => {
    assertArm(a);
    if (a.pulls < minPulls) return true;
    return (a.reward / a.pulls) >= minRate;
  });
}

module.exports = { ucb1, choose, update, prune };
