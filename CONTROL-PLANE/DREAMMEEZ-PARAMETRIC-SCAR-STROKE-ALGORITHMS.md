# Parametric scar stroke algorithms

**Target:** soft-pixel DreamMeez face tiles (64–96px)  
**Output:** deterministic mask + color overlay from `(player_id, event_id, region)`  
**Stack:** pure 2D (canvas / offscreen); no ML

---

## 1. Parameter block

```ts
type ScarStyle = 'linear' | 'notch' | 'fork' | 'curve' | 'x';

interface ScarStroke {
  seed: number;           // uint32 from hash
  region: ScarRegion;     // brow_l, cheek_r, lip, ...
  style: ScarStyle;
  // geometry in normalized face space [0,1]²
  anchors: { x: number; y: number }[];  // 2–5 points
  width0: number;         // px at start (at ref size 64)
  width1: number;         // px at end (taper)
  depth: number;          // 0..1 → opacity / darkening
  age: number;            // 0 fresh → 1 permanent pale
  jagged: number;         // 0 smooth → 1 noisy edges
  curve: number;          // lateral bend amplitude
}
```

---

## 2. Seed & style selection

```ts
function hash32(s: string): number {
  // FNV-1a or xxhash; stable across languages
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function buildScar(playerId: string, eventId: string, region: ScarRegion, age: number): ScarStroke {
  const seed = hash32(`${playerId}|${eventId}|${region}`);
  const r = rng(seed);
  const styles: ScarStyle[] = ['linear', 'notch', 'fork', 'curve', 'x'];
  const style = styles[Math.floor(r() * styles.length)];
  const anchors = anchorsForRegion(region, style, r);
  return {
    seed, region, style, anchors,
    width0: 1.2 + r() * 1.4,
    width1: 0.6 + r() * 1.0,
    depth: 0.45 + r() * 0.5,
    age,
    jagged: r() * 0.7,
    curve: (r() - 0.5) * 0.08
  };
}
```

---

## 3. Region anchors (constraint boxes)

Each region is an axis-aligned (or polygon) box in face UV space. Anchors are **only** sampled inside the box so strokes never leave the face feature.

```ts
const REGIONS = {
  brow_l:  { x0: 0.22, y0: 0.28, x1: 0.42, y1: 0.38 },
  brow_r:  { x0: 0.58, y0: 0.28, x1: 0.78, y1: 0.38 },
  cheek_l: { x0: 0.18, y0: 0.42, x1: 0.38, y1: 0.62 },
  cheek_r: { x0: 0.62, y0: 0.42, x1: 0.82, y1: 0.62 },
  lip:     { x0: 0.38, y0: 0.62, x1: 0.62, y1: 0.72 },
  nose:    { x0: 0.44, y0: 0.40, x1: 0.56, y1: 0.58 },
  chin:    { x0: 0.40, y0: 0.72, x1: 0.60, y1: 0.88 },
  jaw_l:   { x0: 0.14, y0: 0.58, x1: 0.32, y1: 0.78 },
  jaw_r:   { x0: 0.68, y0: 0.58, x1: 0.86, y1: 0.78 }
};
```

### Style → path templates

| style | anchors |
|---|---|
| `linear` | 2 points, mostly diagonal |
| `notch` | 3 points, short zigzag |
| `fork` | 3 points from a split (Y) |
| `curve` | 3–4 points with quadratic bend |
| `x` | two 2-point strokes, same seed family |

```ts
function anchorsForRegion(region, style, r) {
  const b = REGIONS[region];
  const pt = () => ({
    x: b.x0 + r() * (b.x1 - b.x0),
    y: b.y0 + r() * (b.y1 - b.y0)
  });
  if (style === 'linear') return [pt(), pt()].sort((a, c) => a.x - c.x);
  if (style === 'notch') {
    const a = pt(), c = pt();
    const mid = { x: (a.x + c.x) / 2 + (r() - 0.5) * 0.04, y: (a.y + c.y) / 2 + (r() - 0.5) * 0.05 };
    return [a, mid, c];
  }
  if (style === 'fork') {
    const root = pt(), a = pt(), c = pt();
    return [root, a, root, c]; // rasterizer draws root→a and root→c
  }
  // curve: start, control, end
  return [pt(), pt(), pt()];
}
```

---

## 4. Stroke rasterization

### 4.1 Polyline sampling

Sample along segments at ~0.5px steps (at 64px face).

```ts
function samplePolyline(anchors, closed = false) {
  const pts = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.ceil(len * 64 * 2));
    for (let t = 0; t < n; t++) {
      const u = t / n;
      pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, u: (i + u) / (anchors.length - 1) });
    }
  }
  return pts;
}
```

### 4.2 Width taper + jagged offset

At parameter `u` along the stroke:

```ts
width(u) = lerp(width0, width1, u)
// perpendicular offset for jagged edge
nx, ny = normalized perpendicular to local tangent
offset = (hashNoise(u, seed) - 0.5) * jagged * 0.015
```

### 4.3 Distance field stamp (clean pixels)

For each sample point, stamp a soft disk into a float mask `M[x,y]`:

```
for each sample (fx, fy, u):
  w = width(u) / 64
  for pixels in bounding box:
    d = dist(pixel, (fx,fy)) - offset_edge
    M[p] = max(M[p], smoothstep(w, w*0.3, d))
```

Optional: second pass slightly thinner and darker down the center (ridge).

### 4.4 Quadratic curve variant

For `style === 'curve'`, replace polyline with quadratic Bézier through 3 anchors, same sampling.

---

## 5. Age → color

```ts
function scarColor(age: number, depth: number, baseSkin: RGB): RGBA {
  // fresh blood-red → scab → pink → pale
  const fresh = { r: 140, g: 30, b: 35 };
  const scab  = { r: 90, g: 40, b: 35 };
  const pink  = { r: 180, g: 120, b: 110 };
  const pale  = { r: 210, g: 190, b: 175 };
  let c;
  if (age < 0.25) c = lerpRGB(fresh, scab, age / 0.25);
  else if (age < 0.55) c = lerpRGB(scab, pink, (age - 0.25) / 0.3);
  else c = lerpRGB(pink, pale, (age - 0.55) / 0.45);
  // permanent scars slightly lighter than surrounding skin
  if (age > 0.85) c = lerpRGB(c, { r: 230, g: 220, b: 210 }, 0.35);
  const a = (0.35 + depth * 0.55) * (age < 0.2 ? 0.95 : 0.75);
  return { ...c, a };
}
```

Composite: `out = blend(baseFace, scarColor, M * alpha)`.

---

## 6. Pixel-art quantize (optional)

After float raster:
1. Threshold mask to 2–3 opacity levels  
2. Snap colors to HUD palette (8–16 colors)  
3. Keep 1px core darker than edge for readability at 64px  

---

## 7. Fork / X special cases

- **fork:** two stamps sharing root anchor; independent end widths  
- **x:** two linear strokes; second seed = `seed ^ 0xA5A5A5A5`  

---

## 8. Performance budget

- Generate once on `grant_scar`, cache PNG or layer id  
- Do **not** regenerate every frame  
- HUD composite = base bitmap + cached scar layers + transient blood layer  

---

## 9. Validation tests

1. Same `(player, event, region)` → identical mask hash  
2. All mask mass inside region expanded by 2px  
3. At 64px, ≥ 8 pixels with alpha > 0.5 (visible)  
4. `age=1` has no pure saturated red  
5. Stacking 5 scars still leaves eyes/mouth readable  

---

## 10. Minimal reference implementation order

1. `hash32` + `rng` + region boxes  
2. linear stroke only  
3. age colors  
4. notch + curve  
5. jagged + fork + x  
6. quantize + cache  
