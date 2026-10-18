'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  emitScorecard,
  reinforceGauntletFromSignals,
  BASE_CHECKS
} = require('./emitGauntletScorecard');

test('scorecard includes base gauntlet checks', () => {
  const c = emitScorecard({ surface: 'mtg', subject: 'mtg_master' });
  assert.equal(c.emitted_by, 'ELOHIM');
  assert.equal(c.schema, 'dreamledger/gauntlet-scorecard/v2');
  for (const id of BASE_CHECKS) {
    assert.ok(c.checks.some((x) => x.id === id));
  }
  assert.ok(c.checks.some((x) => x.id === 'inventory_honesty'));
});

test('sentinel signals add trend checks', () => {
  const cards = reinforceGauntletFromSignals(
    [
      {
        id: 'SIG-1',
        surface: 'avatar',
        subject: 'impulse_cosmetics',
        summary: 'NZ$2-5 try-on',
        extra_checks: ['streak_reward_integrity']
      }
    ],
    { write: false }
  );
  assert.equal(cards.length, 1);
  assert.ok(cards[0].checks.some((x) => x.id === 'streak_reward_integrity'));
  assert.ok(cards[0].checks.some((x) => x.id === 'dual_surface_web_phinhaven'));
});

test('Elohim cannot claim verified revenue in scorecard', () => {
  const c = emitScorecard({ surface: 'storefront', subject: 'pay' });
  assert.ok(c.elohim_hypothesis.may_not.includes('declare_verified_revenue'));
  assert.match(c.gauntlet.promotion_rule, /settled payment/i);
});
