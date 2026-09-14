'use strict';

/**
 * Bézier sampling for DreamMeez parametric scar strokes.
 * Points are {x, y} in any consistent space (normalized face UV or pixels).
 */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** Quadratic Bézier: B(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2 */
function quadraticPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
  };
}

/** Cubic Bézier: B(t) = (1-t)³ P0 + 3(1-t)² t P1 + 3(1-t)t² P2 + t³ P3 */
function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y
  };
}

/** First derivative of quadratic (tangent direction). */
function quadraticTangent(p0, p1, p2, t) {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
  };
}

/** First derivative of cubic. */
function cubicTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
  };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function perpendicular(v) {
  return { x: -v.y, y: v.x };
}

/**
 * Uniform parameter sampling (equal steps in t, not arc length).
 * @param {'quadratic'|'cubic'} kind
 * @param {Array<{x:number,y:number}>} controls 3 or 4 points
 * @param {number} segments number of steps (>= 1)
 * @returns {Array<{x:number,y:number,t:number,tx:number,ty:number,nx:number,ny:number}>}
 */
function sampleBezierUniform(kind, controls, segments) {
  const n = Math.max(1, Math.floor(segments));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let p, tan;
    if (kind === 'quadratic') {
      p = quadraticPoint(controls[0], controls[1], controls[2], t);
      tan = quadraticTangent(controls[0], controls[1], controls[2], t);
    } else {
      p = cubicPoint(controls[0], controls[1], controls[2], controls[3], t);
      tan = cubicTangent(controls[0], controls[1], controls[2], controls[3], t);
    }
    const T = normalize(tan);
    const N = perpendicular(T);
    out.push({ x: p.x, y: p.y, t, tx: T.x, ty: T.y, nx: N.x, ny: N.y });
  }
  return out;
}

/**
 * Approximate arc-length sampling: dense uniform pre-sample, then resample by distance.
 * Better even spacing along the visible stroke (important for scar width stamps).
 */
function sampleBezierArcLength(kind, controls, segments, preSamples) {
  const pre = Math.max(segments * 4, preSamples || 64);
  const dense = sampleBezierUniform(kind, controls, pre);
  const dist = [0];
  let total = 0;
  for (let i = 1; i < dense.length; i++) {
    total += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
    dist.push(total);
  }
  if (total <= 0) return dense.slice(0, 1);

  const n = Math.max(1, Math.floor(segments));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const target = (i / n) * total;
    let j = 1;
    while (j < dist.length && dist[j] < target) j++;
    const d0 = dist[j - 1];
    const d1 = dist[j] || d0;
    const u = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
    const a = dense[j - 1];
    const b = dense[Math.min(j, dense.length - 1)];
    const p = lerpPoint(a, b, u);
    const T = normalize({ x: b.x - a.x || a.tx, y: b.y - a.y || a.ty });
    const N = perpendicular(T);
    out.push({ x: p.x, y: p.y, t: i / n, s: target / total, tx: T.x, ty: T.y, nx: N.x, ny: N.y });
  }
  return out;
}

/**
 * Build scar stamp centers along a quadratic curve with tapered half-width.
 * width0/width1 in the same units as controls (e.g. normalized face space).
 */
function sampleScarStrokeQuadratic(p0, p1, p2, opts) {
  const segments = (opts && opts.segments) || 24;
  const width0 = opts && opts.width0 != null ? opts.width0 : 0.02;
  const width1 = opts && opts.width1 != null ? opts.width1 : 0.01;
  const jagged = (opts && opts.jagged) || 0;
  const seed = (opts && opts.seed) || 0;
  const arc = !opts || opts.arcLength !== false;

  const samples = arc
    ? sampleBezierArcLength('quadratic', [p0, p1, p2], segments)
    : sampleBezierUniform('quadratic', [p0, p1, p2], segments);

  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  return samples.map((pt) => {
    const u = pt.s != null ? pt.s : pt.t;
    const halfW = lerp(width0, width1, u) * 0.5;
    const j = jagged > 0 ? (rnd() - 0.5) * 2 * jagged * halfW : 0;
    return {
      x: pt.x + pt.nx * j,
      y: pt.y + pt.ny * j,
      u,
      halfWidth: halfW,
      nx: pt.nx,
      ny: pt.ny,
      tx: pt.tx,
      ty: pt.ty
    };
  });
}

module.exports = {
  lerp,
  lerpPoint,
  quadraticPoint,
  cubicPoint,
  quadraticTangent,
  cubicTangent,
  sampleBezierUniform,
  sampleBezierArcLength,
  sampleScarStrokeQuadratic
};
