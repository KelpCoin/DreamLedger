'use strict';

const assert = require('assert');
const {
  quadraticPoint,
  cubicPoint,
  sampleBezierUniform,
  sampleBezierArcLength,
  sampleScarStrokeQuadratic
} = require('./DreamMeezBezier');

const p0 = { x: 0, y: 0 };
const p1 = { x: 0.5, y: 1 };
const p2 = { x: 1, y: 0 };

// Endpoints
const q0 = quadraticPoint(p0, p1, p2, 0);
const q1 = quadraticPoint(p0, p1, p2, 1);
assert.ok(Math.abs(q0.x - 0) < 1e-12 && Math.abs(q0.y - 0) < 1e-12);
assert.ok(Math.abs(q1.x - 1) < 1e-12 && Math.abs(q1.y - 0) < 1e-12);

const c0 = { x: 0, y: 0 }, c1 = { x: 0, y: 1 }, c2 = { x: 1, y: 1 }, c3 = { x: 1, y: 0 };
assert.ok(Math.abs(cubicPoint(c0, c1, c2, c3, 0).x) < 1e-12);
assert.ok(Math.abs(cubicPoint(c0, c1, c2, c3, 1).x - 1) < 1e-12);

const uni = sampleBezierUniform('quadratic', [p0, p1, p2], 16);
assert.strictEqual(uni.length, 17);
assert.ok(Math.abs(uni[0].t) < 1e-12);
assert.ok(Math.abs(uni[16].t - 1) < 1e-12);
assert.ok(Number.isFinite(uni[8].nx) && Number.isFinite(uni[8].tx));

const arc = sampleBezierArcLength('quadratic', [p0, p1, p2], 16);
assert.strictEqual(arc.length, 17);
for (let i = 1; i < arc.length; i++) {
  assert.ok(arc[i].s >= arc[i - 1].s - 1e-9, 'arc-length parameter monotonic');
}
assert.ok(Math.abs(arc[arc.length - 1].s - 1) < 1e-6);

const stroke = sampleScarStrokeQuadratic(p0, p1, p2, {
  segments: 12,
  width0: 0.04,
  width1: 0.01,
  jagged: 0.5,
  seed: 42
});
assert.strictEqual(stroke.length, 13);
assert.ok(stroke[0].halfWidth > stroke[stroke.length - 1].halfWidth);
const stroke2 = sampleScarStrokeQuadratic(p0, p1, p2, { segments: 12, seed: 42, jagged: 0.5 });
assert.strictEqual(stroke[5].x, stroke2[5].x, 'deterministic seed');

console.log(JSON.stringify({
  status: 'PASS',
  uniform_samples: uni.length,
  arc_samples: arc.length,
  scar_stamps: stroke.length,
  mid: stroke[6]
}, null, 2));
