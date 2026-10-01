'use strict';
// ---------------------------------------------------------------------------
// Procedural art: wall/floor textures and billboard sprites are painted onto
// small offscreen canvases at startup, then converted to Uint32 pixel arrays
// that the raycaster samples directly. No image files needed.
// ---------------------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// All art is authored in "logical" pixels and painted at ART_SCALE times that
// resolution, so textures come out 128x128 and sprites get smooth, detailed edges.
const ART_SCALE = 2;
function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w * ART_SCALE; c.height = h * ART_SCALE;
  c.getContext('2d').setTransform(ART_SCALE, 0, 0, ART_SCALE, 0, 0);
  return c;
}

// Fake relief: light every texel from the top-left using its brightness as a
// height map, so mortar lines, cracks and bricks read as carved surfaces.
function relief(c, strength = 1.6) {
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const id = x.getImageData(0, 0, w, h), d = id.data;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.55 + d[i * 4 + 2] * 0.15;
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const a = L[((y + h - 1) % h) * w + (xx + w - 1) % w], b = L[((y + 1) % h) * w + (xx + 1) % w];
    const k = (a - b) * strength;
    const i = (y * w + xx) * 4;
    out[i] = d[i] - k; out[i + 1] = d[i + 1] - k; out[i + 2] = d[i + 2] - k;
  }
  id.data.set(out); x.putImageData(id, 0, 0);
  return c;
}

// Give a sprite definition: a dark outline, darkened inner edges, and soft
// top-down shading so characters stop looking like flat cut-outs.
function enhanceSprite(c) {
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const id = x.getImageData(0, 0, w, h), d = id.data;
  const solid = i => d[i * 4 + 3] >= 110;
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = y * w + xx, o = i * 4;
    const n = (xx > 0 && solid(i - 1) ? 1 : 0) + (xx < w - 1 && solid(i + 1) ? 1 : 0) + (y > 0 && solid(i - w) ? 1 : 0) + (y < h - 1 && solid(i + w) ? 1 : 0);
    if (!solid(i)) {
      if (n) { out[o] = 12; out[o + 1] = 8; out[o + 2] = 14; out[o + 3] = 255; }
      continue;
    }
    const edge = n < 4 ? 0.72 : 1;
    const shade = (1.12 - 0.34 * y / h) * edge;
    // a little rim light where the sprite's top edge meets air
    const rim = y > 1 && !solid(i - w * 2) ? 28 : 0;
    out[o] = d[o] * shade + rim; out[o + 1] = d[o + 1] * shade + rim; out[o + 2] = d[o + 2] * shade + rim;
  }
  id.data.set(out); x.putImageData(id, 0, 0);
  return c;
}

// Convert a canvas into {w,h,data} with ABGR pixels. Transparent pixels = 0.
function toTex(c) {
  const w = c.width, h = c.height;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const out = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    if (a < 110) { out[i] = 0; continue; }
    out[i] = (255 << 24 | d[i * 4 + 2] << 16 | d[i * 4 + 1] << 8 | d[i * 4]) >>> 0;
  }
  return { w, h, data: out };
}

const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
function jit(rng, c, amt) { const k = (rng() - 0.5) * amt; return c.map(v => clamp(v + k + (rng() - 0.5) * amt * 0.3, 0, 255)); }

function noisePass(c, rng, amt, speck = 0) {
  const x = c.getContext('2d');
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let n = (rng() - 0.5) * amt;
    if (speck && rng() < speck) n -= 40;
    d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  x.putImageData(id, 0, 0);
}

// ---------- drawing shorthands ----------
function P(ctx) {
  return {
    ctx,
    fill(c) { ctx.fillStyle = c; return this; },
    stroke(c, w = 1) { ctx.strokeStyle = c; ctx.lineWidth = w; return this; },
    rect(x, y, w, h, c) { if (c) ctx.fillStyle = c; ctx.fillRect(x, y, w, h); return this; },
    circ(x, y, r, c) { if (c) ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); return this; },
    ell(x, y, rx, ry, c, rot = 0) { if (c) ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); return this; },
    poly(pts, c) { if (c) ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); return this; },
    line(x1, y1, x2, y2, c, w = 1) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return this; },
    text(t, x, y, c, font) { ctx.fillStyle = c; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); return this; },
  };
}

// =========================== WALL TEXTURES ===============================

function brickTex(seed, o) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, rgb(...o.mortar));
  const rows = o.rows || 8, cols = o.cols || 4, bh = 64 / rows, bw = 64 / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2 + (o.stagger ? rng() * 6 : 0);
    for (let i = -1; i <= cols; i++) {
      const bx = i * bw + off, by = r * bh;
      const col = jit(rng, o.base, o.jitter || 30);
      p.rect(bx + 1, by + 1, bw - 2, bh - 2, rgb(...col));
      p.rect(bx + 1, by + 1, bw - 2, 1, rgb(...col.map(v => v + 22)));
      p.rect(bx + 1, by + bh - 2, bw - 2, 1, rgb(...col.map(v => v - 30)));
      if (o.cracks && rng() < o.cracks) {
        const cx = bx + 2 + rng() * (bw - 4), cy = by + 2;
        p.line(cx, cy, cx + (rng() - 0.5) * 6, cy + bh - 4, rgb(...col.map(v => v - 45)), 1);
      }
    }
  }
  noisePass(c, rng, o.noise || 18, o.speck || 0.02);
  return c;
}

function stoneWall(seed, base) {
  return brickTex(seed, { base, mortar: base.map(v => v * 0.45), rows: 5, cols: 3, jitter: 34, stagger: true, cracks: 0.25, noise: 22, speck: 0.04 });
}

function mossify(c, seed, amount) {
  const rng = mulberry32(seed), p = P(c.getContext('2d'));
  for (let i = 0; i < amount; i++) {
    const x = rng() * 64, y = rng() < 0.6 ? 48 + rng() * 16 : rng() * 64;
    p.ell(x, y, 2 + rng() * 5, 1 + rng() * 3, rgb(40 + rng() * 30, 90 + rng() * 50, 30 + rng() * 20));
  }
  for (let i = 0; i < 6; i++) { // hanging vines
    const x = rng() * 64; let y = 0;
    const len = 10 + rng() * 30;
    p.line(x, 0, x + (rng() - 0.5) * 4, len, rgb(50, 110 + rng() * 40, 40), 1.5);
    y = len; p.circ(x, y, 1.5, rgb(70, 150, 50));
  }
  noisePass(c, rng, 10);
  return c;
}

function boneWall(seed) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, '#2a2622');
  for (let i = 0; i < 60; i++) { // packed bones
    const x = rng() * 64, y = rng() * 64, a = rng() * Math.PI, l = 6 + rng() * 10;
    const dx = Math.cos(a) * l / 2, dy = Math.sin(a) * l / 2, col = rgb(105 + rng() * 50, 98 + rng() * 45, 78 + rng() * 32);
    p.line(x - dx, y - dy, x + dx, y + dy, col, 2.5);
    p.circ(x - dx, y - dy, 2, col).circ(x + dx, y + dy, 2, col);
  }
  for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) { // skulls
    const x = 16 + i * 32 + (r % 2) * 8, y = 16 + r * 32;
    p.ell(x, y, 8, 7, '#a89e84').rect(x - 5, y + 3, 10, 6, '#a89e84');
    p.circ(x - 3, y - 1, 2.5, '#1a1612').circ(x + 3, y - 1, 2.5, '#1a1612');
    p.poly([x, y + 2, x - 1.5, y + 5, x + 1.5, y + 5], '#1a1612');
    for (let t = -4; t <= 4; t += 2) p.rect(x + t - 0.5, y + 6, 1, 3, '#3a342c');
  }
  noisePass(c, rng, 16, 0.03);
  return c;
}

function furnaceWall(seed, alt) {
  const c = brickTex(seed, { base: [92, 38, 30], mortar: [30, 10, 8], rows: 8, cols: 4, jitter: 26, cracks: 0.35, noise: 16 });
  const rng = mulberry32(seed + 9), p = P(c.getContext('2d'));
  for (let i = 0; i < (alt ? 9 : 4); i++) { // glowing cracks
    let x = rng() * 64, y = rng() * 64;
    for (let s = 0; s < 6; s++) {
      const nx = x + (rng() - 0.5) * 10, ny = y + rng() * 8;
      p.line(x, y, nx, ny, 'rgba(255,140,30,0.9)', 1.5);
      p.line(x, y, nx, ny, 'rgba(255,230,120,0.9)', 0.6);
      x = nx; y = ny;
    }
  }
  if (alt) { // grate with fire behind
    p.rect(14, 22, 36, 28, '#1a0804');
    for (let i = 0; i < 36; i++) p.rect(15 + i, 30 + Math.sin(i * 0.7) * 3 + rng() * 6, 1, 20, rgb(255, 80 + rng() * 120, 20));
    for (let i = 0; i < 5; i++) p.rect(14 + i * 8, 22, 3, 28, '#2e2a28');
    p.rect(14, 22, 36, 3, '#2e2a28').rect(14, 47, 36, 3, '#2e2a28');
  }
  return c;
}

function studioWall(seed, alt) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, '#1c1428');
  for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 32) {
    p.rect(x + 1, y + 1, 30, 30, '#2a1f3c').rect(x + 1, y + 1, 30, 1, '#3d2e56').rect(x + 1, y + 30, 30, 1, '#120c1a');
    p.circ(x + 4, y + 4, 1, '#6a5a80').circ(x + 28, y + 4, 1, '#6a5a80').circ(x + 4, y + 28, 1, '#6a5a80').circ(x + 28, y + 28, 1, '#6a5a80');
  }
  p.rect(0, 40, 64, 3, '#ff2fb0').rect(0, 41, 64, 1, '#ffc0ec');
  p.rect(0, 12, 64, 2, '#36e0ff');
  if (alt) {
    p.rect(8, 16, 48, 20, '#140a0a').rect(10, 18, 44, 16, '#b0101a');
    p.text('ON AIR', 32, 26.5, '#ffe0e0', 'bold 11px monospace');
  }
  noisePass(c, rng, 8);
  return c;
}

function woodWall(seed) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  for (let i = 0; i < 8; i++) {
    const col = jit(rng, [110, 70, 40], 25);
    p.rect(0, i * 8, 64, 8, rgb(...col)).rect(0, i * 8 + 7, 64, 1, rgb(...col.map(v => v * 0.5)));
    for (let k = 0; k < 4; k++) p.line(rng() * 64, i * 8 + 2 + rng() * 4, rng() * 64, i * 8 + 2 + rng() * 4, rgb(...col.map(v => v * 0.8)), 0.6);
  }
  p.rect(0, 50, 64, 4, '#2e6b3a').rect(0, 51, 64, 1, '#7fe08f'); // safe-room green trim
  p.rect(0, 10, 64, 2, '#3a2412');
  noisePass(c, rng, 10);
  return c;
}

function doorTex(seed, boss, themeCol) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  const base = boss ? [120, 25, 20] : [105, 68, 38];
  for (let i = 0; i < 6; i++) {
    const col = jit(rng, base, 22);
    p.rect(2 + i * 10, 0, 10, 64, rgb(...col)).rect(2 + i * 10, 0, 1, 64, rgb(...col.map(v => v * 0.5)));
  }
  p.rect(0, 0, 2, 64, '#1a1410').rect(62, 0, 2, 64, '#1a1410');
  const iron = boss ? '#2a2a30' : '#3a3a40';
  p.rect(0, 10, 64, 5, iron).rect(0, 48, 64, 5, iron);
  for (let i = 4; i < 64; i += 10) { p.circ(i, 12.5, 1.2, '#8a8a90'); p.circ(i, 50.5, 1.2, '#8a8a90'); }
  p.circ(50, 32, 4, '#1a1a1a').circ(50, 32, 2.5, boss ? '#c05030' : '#9a8a50');
  if (boss) {
    p.ell(30, 31, 9, 8, '#d8ceb0').circ(27, 30, 2.5, '#300').circ(33, 30, 2.5, '#300').rect(26, 36, 8, 4, '#d8ceb0');
  }
  if (themeCol) p.rect(0, 0, 64, 2, themeCol);
  noisePass(c, rng, 12);
  return c;
}

function runeOverlay(c, seed, color) {
  const rng = mulberry32(seed), p = P(c.getContext('2d'));
  for (let i = 0; i < 3; i++) {
    const x = 10 + rng() * 44, y = 10 + rng() * 44;
    p.stroke(color, 1.2);
    const ctx = p.ctx; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
    p.line(x - 5, y, x + 5, y, color, 1.2).line(x, y - 6, x, y + 6, color, 1.2);
  }
  return c;
}

// =========================== FLOOR / CEILING ==============================

function flagstones(seed, base, rows = 4) {
  return brickTex(seed, { base, mortar: base.map(v => v * 0.4), rows, cols: rows, jitter: 26, stagger: true, noise: 20, speck: 0.03 });
}
function dirtFloor(seed) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, '#3a3222');
  for (let i = 0; i < 90; i++) p.ell(rng() * 64, rng() * 64, 1 + rng() * 4, 1 + rng() * 2, rgb(50 + rng() * 30, 44 + rng() * 26, 28 + rng() * 14));
  for (let i = 0; i < 25; i++) { const x = rng() * 64, y = rng() * 64; p.line(x, y, x + (rng() - .5) * 3, y - 3, rgb(50, 110, 40), 1); }
  noisePass(c, rng, 18);
  return c;
}
function boneFloor(seed) {
  const rng = mulberry32(seed), c = flagstones(seed, [70, 66, 60]), p = P(c.getContext('2d'));
  for (let i = 0; i < 14; i++) {
    const x = rng() * 64, y = rng() * 64, a = rng() * 3, l = 3 + rng() * 5;
    p.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, '#c8bc9c', 1.5);
  }
  return c;
}
function grateFloor(seed) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, '#2a0a04');
  for (let i = 0; i < 40; i++) p.circ(rng() * 64, rng() * 64, 1 + rng() * 3, rgb(200 + rng() * 55, 60 + rng() * 80, 10));
  for (let i = 0; i < 64; i += 8) { p.rect(i, 0, 3, 64, '#3a3432'); p.rect(0, i, 64, 3, '#3a3432'); }
  p.rect(0, 0, 64, 2, '#4a4442').rect(0, 0, 2, 64, '#4a4442');
  noisePass(c, rng, 10);
  return c;
}
function checkerFloor(seed) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) p.rect(x * 16, y * 16, 16, 16, (x + y) % 2 ? '#1a1420' : '#cfc6d8');
  noisePass(c, rng, 10);
  return c;
}
function rugFloor(seed) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, '#7a1e22');
  p.rect(4, 4, 56, 56, '#9a2a28').rect(8, 8, 48, 48, '#7a1e22');
  p.poly([32, 14, 50, 32, 32, 50, 14, 32], '#c8943a').poly([32, 20, 44, 32, 32, 44, 20, 32], '#7a1e22');
  p.circ(32, 32, 4, '#e0b050');
  for (let i = 0; i < 64; i += 4) { p.rect(i, 0, 2, 2, '#e0b050'); p.rect(i, 62, 2, 2, '#e0b050'); }
  noisePass(c, rng, 14);
  return c;
}
function darkCeil(seed, base) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, rgb(...base));
  for (let i = 0; i < 50; i++) p.ell(rng() * 64, rng() * 64, 2 + rng() * 6, 1 + rng() * 4, rgb(...jit(rng, base, 22)));
  noisePass(c, rng, 12);
  return c;
}
function beamCeil(seed) {
  const c = darkCeil(seed, [40, 36, 34]), p = P(c.getContext('2d'));
  p.rect(0, 26, 64, 12, '#4a2e1a').rect(0, 26, 64, 2, '#6a4428').rect(0, 36, 64, 2, '#2a1a0e');
  return c;
}
function trussCeil(seed) {
  const rng = mulberry32(seed), c = cv(64, 64), p = P(c.getContext('2d'));
  p.rect(0, 0, 64, 64, '#0c0812');
  p.rect(0, 28, 64, 8, '#3a3a44');
  for (let i = 0; i < 64; i += 8) p.line(i, 28, i + 8, 36, '#5a5a66', 1.5);
  p.circ(16, 16, 5, '#2a2a2a').circ(16, 16, 3, '#ffe9a0').circ(48, 48, 5, '#2a2a2a').circ(48, 48, 3, '#ff90e0');
  noisePass(c, rng, 6);
  return c;
}

// Build a texture set for a floor theme. Keys match tile ids in map.js.
function buildTheme(theme, seed) {
  const T = {};
  switch (theme) {
    case 'stone':
      T.wall = stoneWall(seed, [110, 104, 96]); T.wall2 = mossify(stoneWall(seed + 1, [100, 96, 90]), seed, 20);
      T.floor = flagstones(seed + 2, [84, 78, 70]); T.ceil = darkCeil(seed + 3, [44, 40, 38]);
      T.bossWall = runeOverlay(stoneWall(seed + 4, [96, 70, 64]), seed, '#ff4030');
      break;
    case 'moss':
      T.wall = mossify(brickTex(seed, { base: [70, 84, 60], mortar: [30, 36, 24], rows: 8, cols: 4, jitter: 30, cracks: 0.2 }), seed, 45);
      T.wall2 = mossify(stoneWall(seed + 1, [80, 86, 64]), seed + 1, 80);
      T.floor = dirtFloor(seed + 2); T.ceil = beamCeil(seed + 3);
      T.bossWall = runeOverlay(mossify(stoneWall(seed + 4, [90, 70, 50]), seed + 4, 30), seed, '#ffd040');
      break;
    case 'bone':
      T.wall = boneWall(seed); T.wall2 = stoneWall(seed + 1, [80, 78, 86]);
      T.floor = boneFloor(seed + 2); T.ceil = darkCeil(seed + 3, [30, 28, 34]);
      T.bossWall = runeOverlay(boneWall(seed + 4), seed, '#70ffd0');
      break;
    case 'furnace':
      T.wall = furnaceWall(seed, false); T.wall2 = furnaceWall(seed + 1, true);
      T.floor = grateFloor(seed + 2); T.ceil = darkCeil(seed + 3, [36, 16, 12]);
      T.bossWall = runeOverlay(furnaceWall(seed + 4, false), seed, '#ffe060');
      break;
    default:
      T.wall = studioWall(seed, false); T.wall2 = studioWall(seed + 1, true);
      T.floor = checkerFloor(seed + 2); T.ceil = trussCeil(seed + 3);
      T.bossWall = runeOverlay(studioWall(seed + 4, false), seed, '#ff2020');
  }
  T.safeWall = woodWall(seed + 5);
  T.safeFloor = rugFloor(seed + 6);
  T.door = doorTex(seed + 7, false);
  T.bossDoor = doorTex(seed + 8, true);
  const out = {};
  for (const k in T) out[k] = toTex(relief(T[k], k === 'ceil' ? 1.0 : 1.5));
  return out;
}

// ============================== SPRITES ===================================

// Lay a standing sprite on its side with a blood pool: the corpse frame.
function corpseOf(frame, bloodCol = '#6a0808') {
  const w = frame.width / ART_SCALE, h = frame.height / ART_SCALE;
  const c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = bloodCol; x.beginPath(); x.ellipse(w / 2, h - 3, w * 0.45, 3, 0, 0, Math.PI * 2); x.fill();
  x.save(); x.translate(w / 2, h - 2); x.rotate(-Math.PI / 2); x.scale(0.55, 1);
  x.drawImage(frame, -w * 0.1, -w / 2, h * 0.9, w);
  x.restore();
  return c;
}

function drawRat(f, king) {
  const W = 64, H = king ? 64 : 40, c = cv(W, H), p = P(c.getContext('2d'));
  const by = H - 14, bob = f === 1 ? 2 : 0, fur = king ? '#5a4a52' : '#6b5d52', dark = king ? '#3a2e36' : '#4a3e36';
  const s = king ? 1.5 : 1;
  if (king) p.poly([10, by - 18, 44, by - 22, 48, by + 8, 6, by + 10], '#8a1a30'); // royal cape
  p.line(8, by + 2, 2, by - 10 + bob, '#c09090', 2.5 * s); // tail
  p.ell(30, by - bob, 20 * s * 0.8, 10 * s * 0.8, fur).ell(30, by + 3 - bob, 16 * s * 0.8, 6 * s * 0.8, '#8a7a6a');
  const leg = f === 1 ? 3 : 0;
  p.rect(18 - leg, by + 4, 4, 9, dark).rect(38 + leg, by + 4, 4, 9, dark);
  const hx = f === 2 ? 50 : 46, hy = by - 4 - bob;
  p.ell(hx, hy, 11 * s * 0.8, 8 * s * 0.8, fur).circ(hx - 5, hy - 8 * s * 0.8, 4 * s * 0.8, '#c09090');
  p.circ(hx + 4, hy - 2, 2 * s, '#ff2020').circ(hx + 10 * s * 0.8, hy + 2, 2, '#301818');
  if (f === 2) { p.rect(hx + 5, hy + 4, 2, 5, '#fff').rect(hx + 8, hy + 4, 2, 5, '#fff'); } else p.rect(hx + 6, hy + 4, 3, 3, '#fff');
  if (king) { // crown and cape
    p.poly([hx - 12, hy - 14, hx - 10, hy - 26, hx - 5, hy - 18, hx, hy - 28, hx + 5, hy - 18, hx + 9, hy - 25, hx + 10, hy - 14], '#ffcc33');
    p.circ(hx, hy - 21, 2, '#e02040');
  }
  return c;
}

function drawGoblin(f, kind) {
  const W = 48, H = 64, c = cv(W, H), p = P(c.getContext('2d'));
  const skin = kind === 'slinger' ? '#6a9a3a' : '#5c8c34', skinD = '#3e6420';
  const step = f === 1 ? 4 : f === 0 ? -2 : 0;
  p.rect(16 + step, 44, 6, 18, skinD).rect(27 - step, 44, 6, 18, skinD); // legs
  p.rect(14 + step, 60, 9, 4, '#2a1a10').rect(26 - step, 60, 9, 4, '#2a1a10');
  p.ell(24, 36, 11, 12, skin); // torso
  p.poly([13, 40, 35, 40, 38, 52, 10, 52], kind === 'slinger' ? '#8a4a1a' : '#6a4424');
  if (kind === 'slinger') p.poly([12, 26, 36, 26, 30, 44, 18, 44], '#b0621e'); // hood cloak
  // head
  p.circ(24, 18, 10, skin);
  p.poly([15, 16, 1, 8, 15, 22], skin).poly([33, 16, 47, 8, 33, 22], skin); // ears
  p.circ(20, 17, 2.4, '#ffe040').circ(28, 17, 2.4, '#ffe040').circ(20, 17, 1, '#000').circ(28, 17, 1, '#000');
  p.rect(18, 23, 12, 3, '#2a0a0a');
  for (let i = 0; i < 4; i++) p.rect(19 + i * 3, 23, 1.5, 2, '#fff');
  if (kind === 'slinger') p.ell(24, 10, 11, 5, '#b0621e');
  // arms / weapon
  if (kind === 'slinger') {
    const up = f === 2;
    p.line(14, 30, up ? 6 : 8, up ? 12 : 42, skin, 4);
    p.line(34, 30, 40, 40, skin, 4);
    if (up) { p.line(6, 12, 12, 2, '#6a4a2a', 1).circ(12, 2, 3, '#888'); } else p.line(8, 42, 6, 52, '#6a4a2a', 1);
  } else {
    const up = f === 2;
    p.line(14, 30, 8, 42, skin, 4);
    p.line(34, 30, up ? 42 : 40, up ? 18 : 40, skin, 4);
    if (up) p.poly([41, 18, 46, 2, 44, 18], '#c8c8d0'); else p.poly([39, 40, 44, 54, 41, 40], '#c8c8d0');
  }
  return c;
}

function drawMatriarch(f) {
  const W = 64, H = 80, c = cv(W, H), p = P(c.getContext('2d'));
  const skin = '#4e7c2c', step = f === 1 ? 3 : 0;
  p.rect(20 + step, 58, 9, 20, '#35541c').rect(35 - step, 58, 9, 20, '#35541c');
  p.ell(32, 46, 22, 22, skin); // big belly
  p.poly([10, 50, 54, 50, 58, 70, 6, 70], '#6a2a5a'); // skirt
  p.ell(32, 42, 14, 10, '#6a2a5a');
  for (let i = 0; i < 6; i++) p.circ(18 + i * 5.5, 34, 2.5, '#e0e0e0'); // necklace of teeth
  p.circ(32, 20, 13, skin);
  p.poly([20, 18, 2, 6, 20, 26], skin).poly([44, 18, 62, 6, 44, 26], skin);
  p.circ(27, 18, 3, '#ffcc00').circ(37, 18, 3, '#ffcc00').circ(27, 18, 1.3, '#000').circ(37, 18, 1.3, '#000');
  p.rect(24, 26, 16, 4, '#2a0a0a').rect(26, 26, 2, 3, '#fff').rect(36, 26, 2, 3, '#fff');
  p.poly([20, 8, 22, -2, 27, 5, 32, -4, 37, 5, 42, -2, 44, 8], '#ffcc33'); // crown
  const up = f === 2;
  p.line(12, 38, up ? 4 : 4, up ? 16 : 52, skin, 6);
  p.line(52, 38, up ? 60 : 60, up ? 16 : 52, skin, 6);
  p.circ(up ? 4 : 4, up ? 14 : 54, 5, '#888'); // a rock in each hand
  p.circ(up ? 60 : 60, up ? 14 : 54, 5, '#888');
  return c;
}

function drawSkeleton(f, big) {
  const W = big ? 64 : 48, H = big ? 80 : 64, c = cv(W, H), p = P(c.getContext('2d'));
  const bone = big ? '#e4dcc4' : '#d8d0b8', cx = W / 2, s = big ? 1.25 : 1;
  const step = f === 1 ? 3 : f === 0 ? -2 : 0;
  const hip = H - 22 * s;
  p.line(cx - 4, hip, cx - 6 + step, H - 2, bone, 3 * s).line(cx + 4, hip, cx + 6 - step, H - 2, bone, 3 * s);
  p.line(cx, hip, cx, hip - 22 * s, bone, 3 * s); // spine
  for (let i = 0; i < 4; i++) p.line(cx - 9 * s, hip - 8 * s - i * 4 * s, cx + 9 * s, hip - 8 * s - i * 4 * s, bone, 2);
  p.ell(cx, hip, 8 * s, 3 * s, bone);
  const sh = hip - 22 * s;
  p.line(cx - 10 * s, sh, cx + 10 * s, sh, bone, 3);
  // skull
  p.ell(cx, sh - 9 * s, 8 * s, 8 * s, bone).rect(cx - 5 * s, sh - 5 * s, 10 * s, 5 * s, bone);
  p.circ(cx - 3 * s, sh - 10 * s, 2.2 * s, big ? '#40ffc0' : '#200').circ(cx + 3 * s, sh - 10 * s, 2.2 * s, big ? '#40ffc0' : '#200');
  const up = f === 2;
  if (big) { // four arms and a staff
    p.line(cx - 10 * s, sh, cx - 22, sh + 16, bone, 2.5).line(cx + 10 * s, sh, cx + 22, sh + 16, bone, 2.5);
    p.line(cx - 10 * s, sh + 6, cx - 24, up ? sh - 18 : sh + 2, bone, 2.5).line(cx + 10 * s, sh + 6, cx + 24, up ? sh - 18 : sh + 2, bone, 2.5);
    p.line(cx + 24, up ? sh - 30 : sh - 14, cx + 24, H - 2, '#5a3a20', 3).circ(cx + 24, up ? sh - 32 : sh - 16, 5, '#40ffc0');
    p.poly([cx - 10, sh - 24, cx - 6, sh - 34, cx, sh - 26, cx + 6, sh - 34, cx + 10, sh - 24], '#b0a888'); // bone crown
  } else {
    p.line(cx - 10, sh, cx - 14, sh + 18, bone, 2.5);
    p.line(cx + 10, sh, up ? cx + 18 : cx + 14, up ? sh - 8 : sh + 16, bone, 2.5);
    if (up) p.line(cx + 18, sh - 8, cx + 20, sh - 30, '#b0b8c0', 3); else p.line(cx + 14, sh + 16, cx + 22, sh + 34, '#b0b8c0', 3);
  }
  return c;
}

function drawBrute(f) {
  const W = 64, H = 72, c = cv(W, H), p = P(c.getContext('2d'));
  const skin = '#6a7a8a', dark = '#4a5864', step = f === 1 ? 3 : 0;
  p.rect(18 + step, 50, 11, 22, dark).rect(35 - step, 50, 11, 22, dark);
  p.ell(32, 38, 22, 20, skin).ell(32, 44, 16, 10, '#8a98a4');
  p.poly([12, 50, 52, 50, 50, 60, 14, 60], '#5a3a22');
  p.circ(32, 16, 11, skin).rect(22, 18, 20, 8, skin);
  p.rect(22, 11, 20, 4, dark); // brow
  p.circ(27, 17, 2, '#ffa020').circ(37, 17, 2, '#ffa020');
  p.poly([26, 25, 28, 30, 30, 25], '#fff').poly([34, 25, 36, 30, 38, 25], '#fff'); // tusks
  const up = f === 2;
  p.line(10, 30, 4, 50, skin, 8);
  p.line(54, 30, up ? 58 : 60, up ? 12 : 48, skin, 8);
  if (up) p.line(58, 12, 50, -4, '#6a4a2a', 7).circ(50, 2, 7, '#5a3a1a');
  else p.line(60, 48, 62, 70, '#6a4a2a', 7).circ(62, 66, 7, '#5a3a1a');
  return c;
}

function drawWisp(f) {
  const c = cv(40, 40), p = P(c.getContext('2d'));
  const fl = f % 2;
  p.circ(20, 22, 16, 'rgba(255,90,20,0.55)');
  p.poly([6, 24, 12, fl ? 2 : 6, 18, 14, 22, fl ? 0 : 4, 26, 12, 32, fl ? 4 : 2, 34, 24], '#ff6a10');
  p.circ(20, 24, 12, '#ff9a20').circ(20, 26, 8, '#ffe070');
  p.circ(16, 24, 2, '#400').circ(24, 24, 2, '#400');
  p.ell(20, 30, 3, f === 2 ? 3 : 1.5, '#400');
  return c;
}

function drawHound(f) {
  const W = 80, H = 60, c = cv(W, H), p = P(c.getContext('2d'));
  const fur = '#8a1a10', dark = '#4a0a06', step = f === 1 ? 5 : 0;
  // flames on back
  for (let i = 0; i < 7; i++) p.poly([18 + i * 7, 22, 21 + i * 7, 6 + (i + f) % 3 * 4, 24 + i * 7, 22], i % 2 ? '#ffb020' : '#ff5010');
  p.ell(36, 30, 24, 12, fur);
  p.rect(18 - step, 36, 6, 22, dark).rect(28 + step, 36, 6, 22, dark).rect(42 - step, 36, 6, 22, dark).rect(52 + step, 36, 6, 22, dark);
  p.line(12, 28, 2, 16 - step, fur, 4); // tail
  const hx = f === 2 ? 66 : 62;
  p.ell(hx, 24, 12, 10, fur).ell(hx + 10, 28, 8, 5, fur);
  p.poly([hx - 8, 16, hx - 4, 4, hx, 16], dark).poly([hx + 2, 16, hx + 6, 4, hx + 8, 16], dark);
  p.circ(hx + 2, 22, 2.5, '#ffe020');
  p.rect(hx + 4, 30, 14, f === 2 ? 5 : 2, '#200');
  if (f === 2) for (let i = 0; i < 4; i++) p.poly([hx + 5 + i * 3.5, 30, hx + 6.5 + i * 3.5, 33, hx + 8 + i * 3.5, 30], '#fff');
  p.rect(hx - 6, 30, 12, 3, '#333').circ(hx - 2, 31.5, 1.5, '#aaa'); // collar with tag
  return c;
}

function drawShowrunner(f) {
  const W = 56, H = 84, c = cv(W, H), p = P(c.getContext('2d'));
  const step = f === 1 ? 3 : 0;
  p.rect(18 + step, 58, 8, 24, '#1a1a22').rect(30 - step, 58, 8, 24, '#1a1a22');
  p.rect(16 + step, 80, 11, 4, '#000').rect(29 - step, 80, 11, 4, '#000');
  p.poly([12, 30, 44, 30, 42, 62, 14, 62], '#2a2a3a'); // suit
  p.poly([24, 30, 32, 30, 28, 50], '#eee').poly([27, 32, 29, 32, 30, 46, 28, 50, 26, 46], '#d01030'); // shirt + tie
  const up = f === 2;
  p.line(14, 34, up ? 4 : 8, up ? 14 : 56, '#2a2a3a', 6).line(42, 34, up ? 52 : 48, up ? 14 : 56, '#2a2a3a', 6);
  p.circ(up ? 4 : 8, up ? 12 : 58, 3, '#e0b090').circ(up ? 52 : 48, up ? 12 : 58, 3, '#e0b090');
  if (!up) p.rect(46, 50, 4, 10, '#333').circ(48, 49, 3, '#888'); // microphone
  // TV head
  p.rect(10, 2, 36, 28, '#3a3a44').rect(13, 5, 26, 22, '#101820').rect(41, 8, 3, 3, '#ff4040').rect(41, 14, 3, 3, '#40ff40');
  p.line(20, 2, 14, -8, '#888', 1.5).line(34, 2, 40, -8, '#888', 1.5);
  const g = f === 2 ? '#ff3060' : '#40e0ff';
  p.rect(17, 11, 5, 4, g).rect(30, 11, 5, 4, g);
  if (f === 2) p.rect(17, 19, 18, 4, g); else p.rect(18, 20, 16, 2, g).rect(16, 18, 2, 2, g).rect(34, 18, 2, 2, g);
  for (let y = 5; y < 27; y += 3) p.rect(13, y, 26, 1, 'rgba(255,255,255,0.08)');
  return c;
}

function drawDonut(f) {
  const W = 48, H = 40, c = cv(W, H), p = P(c.getContext('2d'));
  const fur = '#f2e6d0', shade = '#d8c8aa';
  const step = f === 1 ? 2 : 0;
  // fluffy tail
  p.ell(8, 18 - step, 5, 10, fur, -0.4);
  // body
  p.ell(22, 28, 14, 9, fur).ell(22, 31, 11, 5, shade);
  p.rect(12 + step, 32, 4, 7, fur).rect(28 - step, 32, 4, 7, fur);
  for (let i = 0; i < 10; i++) p.circ(12 + i * 2.2, 21 + (i % 2), 2.2, fur); // fluff
  // head
  const hx = 34, hy = f === 3 ? 14 : 17;
  p.circ(hx, hy, 9, fur);
  p.poly([hx - 8, hy - 4, hx - 7, hy - 13, hx - 2, hy - 7], fur).poly([hx + 2, hy - 7, hx + 7, hy - 13, hx + 8, hy - 4], fur);
  p.poly([hx - 7, hy - 5, hx - 6.5, hy - 10, hx - 3.5, hy - 7], '#f0a0b0').poly([hx + 3.5, hy - 7, hx + 6.5, hy - 10, hx + 7, hy - 5], '#f0a0b0');
  p.ell(hx - 3.5, hy, 2.2, 2.6, '#3060c0').ell(hx + 3.5, hy, 2.2, 2.6, '#3060c0');
  p.rect(hx - 4, hy - 1, 1, 2, '#000').rect(hx + 3, hy - 1, 1, 2, '#000');
  p.poly([hx - 1.2, hy + 3, hx + 1.2, hy + 3, hx, hy + 4.5], '#e06080');
  p.line(hx - 2, hy + 4, hx - 9, hy + 3, '#999', 0.5).line(hx + 2, hy + 4, hx + 9, hy + 3, '#999', 0.5);
  // tiara
  p.poly([hx - 6, hy - 8, hx - 4, hy - 13, hx - 2, hy - 10, hx, hy - 15, hx + 2, hy - 10, hx + 4, hy - 13, hx + 6, hy - 8], '#e8e8f8');
  p.circ(hx, hy - 12, 1.6, '#ff4090');
  if (f === 3) { // casting sparkle
    p.circ(hx + 10, hy - 6, 4, 'rgba(255,120,240,0.8)').circ(hx + 10, hy - 6, 2, '#fff');
  }
  return c;
}

function drawMordecai() {
  const c = cv(48, 64), p = P(c.getContext('2d'));
  p.poly([10, 30, 38, 30, 44, 64, 4, 64], '#3a4a6a'); // robe
  p.poly([20, 30, 28, 30, 26, 64, 22, 64], '#2a3450');
  p.circ(24, 20, 10, '#b89a70'); // head
  p.ell(24, 28, 9, 6, '#dcdcdc'); // beard
  p.circ(20, 18, 1.8, '#000').circ(28, 18, 1.8, '#000');
  p.poly([12, 14, 24, 2, 36, 14], '#3a4a6a'); // hood-hat
  p.line(12, 36, 6, 46, '#3a4a6a', 5).line(36, 36, 42, 44, '#3a4a6a', 5);
  p.rect(38, 38, 8, 9, '#e8e8e8').rect(46, 40, 2, 5, '#e8e8e8').rect(39, 39, 6, 2, '#6a3a10'); // mug
  return c;
}

// ---- items / props ----
function drawCoins() { const c = cv(24, 16), p = P(c.getContext('2d')); p.ell(12, 12, 10, 3.5, '#a07010'); for (let i = 0; i < 6; i++) p.ell(5 + (i * 7) % 14, 12 - i * 1.3, 4, 2, i % 2 ? '#ffd040' : '#f0b020'); return c; }
function drawPotion(col = '#e02030') { const c = cv(16, 24), p = P(c.getContext('2d')); p.circ(8, 16, 7, col).rect(6, 3, 4, 8, '#c8e0f0').rect(5, 1, 6, 3, '#8a5a2a').circ(6, 14, 2, 'rgba(255,255,255,0.7)'); return c; }
function drawBoltsItem() { const c = cv(24, 16), p = P(c.getContext('2d')); for (let i = 0; i < 4; i++) { p.line(2, 4 + i * 3, 20, 3 + i * 3, '#7a5a3a', 1.5); p.poly([20, 1 + i * 3, 24, 3 + i * 3, 20, 5 + i * 3], '#bbb'); } p.rect(8, 2, 3, 13, '#5a2a1a'); return c; }
function drawJug(lit) { const c = cv(20, 24), p = P(c.getContext('2d')); p.circ(10, 15, 8, '#5a6a3a').rect(7, 4, 6, 6, '#6a7a4a').rect(6, 12, 8, 4, '#c8b060'); p.line(10, 4, 13, 0, '#ccc', 1); if (lit) p.circ(13, 1, 2, '#ffe060'); return c; }
function drawChest(open) {
  const c = cv(40, 32), p = P(c.getContext('2d'));
  p.rect(2, 14, 36, 18, '#7a4a20').rect(2, 14, 36, 3, '#5a3010').rect(18, 14, 4, 18, '#c8a030');
  if (open) { p.rect(2, 4, 36, 10, '#5a3010').rect(4, 12, 32, 4, '#ffd040').circ(12, 13, 2, '#fff8c0'); }
  else { p.rect(2, 6, 36, 10, '#8a5a28').rect(2, 6, 36, 2, '#a06a30').rect(18, 6, 4, 10, '#c8a030').rect(17, 14, 6, 5, '#e0c040'); }
  return c;
}
function drawBox(col) {
  const c = cv(28, 28), p = P(c.getContext('2d'));
  p.circ(14, 14, 13, 'rgba(255,255,255,0.25)');
  p.rect(4, 8, 20, 18, col).rect(4, 8, 20, 4, '#fff').rect(12, 8, 4, 18, '#fff');
  p.rect(4, 12, 20, 1, 'rgba(0,0,0,0.3)');
  p.poly([14, 8, 8, 2, 12, 8], '#fff').poly([14, 8, 20, 2, 16, 8], '#fff');
  return c;
}
function drawStairs(open, f) {
  const c = cv(64, 64), p = P(c.getContext('2d'));
  p.ell(32, 58, 30, 6, '#111');
  for (let i = 0; i < 6; i++) p.rect(10 + i * 2, 20 + i * 7, 44 - i * 4, 6, rgb(90 - i * 12, 90 - i * 12, 100 - i * 12));
  p.rect(6, 12, 6, 48, '#5a5a66').rect(52, 12, 6, 48, '#5a5a66').rect(4, 8, 56, 6, '#6a6a78');
  p.text('EXIT', 32, 5, '#40ff80', 'bold 8px monospace');
  if (open) {
    p.ell(32, 40, 18 + f, 20, 'rgba(80,200,255,0.35)');
  } else {
    // crackling force-field: a thin diagonal lattice with a brighter rim
    for (let i = -6; i < 10; i++) {
      p.line(8 + i * 6 + f, 14, 8 + i * 6 + 20 + f, 58, '#a01818', 0.8);
      p.line(56 - i * 6 - f, 14, 36 - i * 6 - f, 58, '#a01818', 0.8);
    }
    p.ctx.clearRect(0, 0, 8, 64); p.ctx.clearRect(56, 0, 8, 64); p.ctx.clearRect(0, 60, 64, 4);
    p.rect(6, 12, 6, 48, '#5a5a66').rect(52, 12, 6, 48, '#5a5a66').rect(4, 8, 56, 6, '#6a6a78');
    p.text('EXIT', 32, 5, '#40ff80', 'bold 8px monospace');
    p.rect(12, 13, 40, 1.2, '#ff5040').rect(12, 58, 40, 1.2, '#ff5040');
  }
  return c;
}
const FLAME_COLORS = {
  fire: ['#ff6a10', '#ffd040', 'rgba(255,140,40,0.25)'],
  hot: ['#ff3a08', '#ffb030', 'rgba(255,80,20,0.25)'],
  ghost: ['#30d890', '#c0ffe0', 'rgba(80,255,180,0.22)'],
  pink: ['#ff30b0', '#ffc0ec', 'rgba(255,60,200,0.22)'],
  cyan: ['#20b8ff', '#c0f4ff', 'rgba(60,200,255,0.22)'],
};
function drawBrazier(f, tint = 'fire') {
  const [outer, inner, halo] = FLAME_COLORS[tint];
  const c = cv(24, 48), p = P(c.getContext('2d'));
  p.circ(12, 12, 11, halo);
  p.rect(10, 22, 4, 26, '#3a3230').rect(11, 22, 1, 26, '#5a504c').rect(4, 44, 16, 4, '#3a3230');
  p.poly([2, 18, 22, 18, 18, 26, 6, 26], '#4a4240').rect(2, 18, 20, 1.5, '#6a605c');
  const h = [0, 3, 1][f];
  p.poly([4, 18, 8, 4 + h, 12, 12, 15, 1 + (2 - h), 20, 18], outer);
  p.poly([7, 18, 10, 8 + h, 13, 14, 16, 10 - h, 17, 18], inner);
  p.ell(12, 17, 4, 2, '#fff8e0');
  return c;
}
function drawBones() { const c = cv(40, 16), p = P(c.getContext('2d')); p.line(4, 12, 20, 10, '#d0c8b0', 2.5).line(16, 14, 30, 8, '#d0c8b0', 2.5); p.ell(30, 10, 5, 4.5, '#d8d0b8').circ(28, 9, 1.2, '#222').circ(32, 9, 1.2, '#222'); return c; }
function drawBarrel() { const c = cv(32, 40), p = P(c.getContext('2d')); p.ell(16, 20, 14, 19, '#7a4a22').rect(2, 8, 28, 3, '#3a3a40').rect(2, 29, 28, 3, '#3a3a40'); for (let i = 0; i < 5; i++) p.rect(5 + i * 5, 2, 1, 36, '#5a3212'); return c; }
function drawCamera() { const c = cv(32, 48), p = P(c.getContext('2d')); p.line(16, 20, 6, 48, '#333', 2).line(16, 20, 26, 48, '#333', 2).line(16, 20, 16, 48, '#333', 2); p.rect(6, 8, 20, 12, '#222').rect(0, 11, 7, 6, '#444').circ(3, 14, 2, '#6af'); p.circ(24, 10, 1.5, '#f22'); return c; }

// ---- projectiles / fx ----
function drawRock() { const c = cv(12, 12), p = P(c.getContext('2d')); p.circ(6, 6, 5, '#8a8078').circ(4.5, 4.5, 1.5, '#aaa'); return c; }
function drawFireball(f) { const c = cv(16, 16), p = P(c.getContext('2d')); p.circ(8, 8, 7 - f, '#ff5010').circ(8, 8, 4.5, '#ffb020').circ(8, 8, 2, '#fff8c0'); return c; }
function drawMissile(f) { const c = cv(16, 16), p = P(c.getContext('2d')); p.circ(8, 8, 7, 'rgba(255,80,220,0.6)').poly([8, 0, 10, 6, 16, 8, 10, 10, 8, 16, 6, 10, 0, 8, 6, 6], f ? '#ffb0f0' : '#ff60e0').circ(8, 8, 2.5, '#fff'); return c; }
function drawBolt() { const c = cv(10, 10), p = P(c.getContext('2d')); p.circ(5, 5, 2.5, '#6a4a2a').circ(5, 5, 1.2, '#ddd'); p.line(1, 5, 9, 5, '#ccc', 1); p.line(5, 1, 5, 9, '#ccc', 1); return c; }
function drawBoneShard() { const c = cv(12, 12), p = P(c.getContext('2d')); p.line(2, 10, 10, 2, '#e8e0c8', 3).circ(2, 10, 2, '#e8e0c8').circ(10, 2, 2, '#e8e0c8').circ(6, 6, 5, 'rgba(80,255,200,0.35)'); return c; }
function drawStatic(f) { const c = cv(16, 16), p = P(c.getContext('2d')); const rng = mulberry32(f + 7); p.circ(8, 8, 7, 'rgba(60,220,255,0.5)'); for (let i = 0; i < 20; i++) p.rect(2 + rng() * 11, 2 + rng() * 11, 2, 2, rng() < 0.5 ? '#fff' : '#40e0ff'); return c; }
function drawExplosion(f) {
  const c = cv(64, 64), p = P(c.getContext('2d')), r = 10 + f * 6;
  const rng = mulberry32(f * 31 + 3);
  if (f < 4) {
    p.circ(32, 32, r, f < 2 ? '#ff7010' : '#e04008');
    for (let i = 0; i < 10; i++) p.circ(32 + (rng() - 0.5) * r * 1.4, 32 + (rng() - 0.5) * r * 1.4, r * 0.35, '#ffb020');
    p.circ(32, 32, r * 0.5, f < 2 ? '#fff8c0' : '#ffd040');
  } else {
    for (let i = 0; i < 12; i++) p.circ(32 + (rng() - 0.5) * 40, 32 + (rng() - 0.5) * 40, 6 + rng() * 6, 'rgba(70,64,60,0.85)');
  }
  return c;
}
function drawDot(col, r = 3) { const c = cv(r * 2, r * 2), p = P(c.getContext('2d')); p.circ(r, r, r, col); return c; }

// ============================== BUILD ALL ==================================

const SPR = {};
function buildSprites() {
  const anim = (fn, n = 3, extra) => {
    const frames = []; for (let i = 0; i < n; i++) frames.push(enhanceSprite(fn(i)));
    frames.push(corpseOf(frames[0], extra));
    return frames.map(toTex);
  };
  SPR.rat = anim(f => drawRat(f, false));
  SPR.ratking = anim(f => drawRat(f, true));
  SPR.goblin = anim(f => drawGoblin(f, 'goblin'));
  SPR.slinger = anim(f => drawGoblin(f, 'slinger'));
  SPR.matriarch = anim(drawMatriarch);
  SPR.skeleton = anim(f => drawSkeleton(f, false), 3, '#3a3830');
  SPR.bonewright = anim(f => drawSkeleton(f, true), 3, '#2a3a36');
  SPR.brute = anim(drawBrute);
  SPR.wisp = anim(drawWisp, 3, '#3a1a08');
  SPR.hellhound = anim(drawHound);
  SPR.showrunner = anim(drawShowrunner, 3, '#101830');
  SPR.donut = [0, 1, 2, 3].map(f => toTex(enhanceSprite(drawDonut(f))));
  SPR.mordecai = toTex(enhanceSprite(drawMordecai()));
  SPR.coins = toTex(enhanceSprite(drawCoins()));
  SPR.potion = toTex(enhanceSprite(drawPotion()));
  SPR.bolts = toTex(enhanceSprite(drawBoltsItem()));
  SPR.lobbers = toTex(enhanceSprite(drawJug(false)));
  SPR.chest = toTex(enhanceSprite(drawChest(false)));
  SPR.chestOpen = toTex(enhanceSprite(drawChest(true)));
  SPR.box = {};
  for (const k in BOX_TYPES) SPR.box[k] = toTex(enhanceSprite(drawBox(BOX_TYPES[k].color)));
  SPR.stairsLocked = [0, 1, 2].map(f => toTex(drawStairs(false, f)));
  SPR.stairsOpen = [0, 1, 2].map(f => toTex(drawStairs(true, f * 2)));
  SPR.brazier = {};
  for (const k in FLAME_COLORS) SPR.brazier[k] = [0, 1, 2].map(f => toTex(drawBrazier(f, k)));
  SPR.bones = toTex(enhanceSprite(drawBones()));
  SPR.barrel = toTex(enhanceSprite(drawBarrel()));
  SPR.camera = toTex(enhanceSprite(drawCamera()));
  SPR.rock = [toTex(drawRock())];
  SPR.fireball = [0, 1].map(f => toTex(drawFireball(f)));
  SPR.missile = [0, 1].map(f => toTex(drawMissile(f)));
  SPR.bolt = [toTex(drawBolt())];
  SPR.bone = [toTex(drawBoneShard())];
  SPR.static = [0, 1, 2].map(f => toTex(drawStatic(f)));
  SPR.lobber = [toTex(drawJug(true))];
  SPR.explosion = [0, 1, 2, 3, 4, 5].map(f => toTex(drawExplosion(f)));
  SPR.blood = toTex(drawDot('#a01010', 3));
  SPR.goo = toTex(drawDot('#40c060', 3));
  SPR.dust = toTex(drawDot('#d8d0b8', 2));
  SPR.spark = toTex(drawDot('#ffd040', 2));
  SPR.pink = toTex(drawDot('#ff70e0', 2));
  SPR.ember = toTex(drawDot('#ff7020', 2));
  SPR.cyan = toTex(drawDot('#50e0ff', 2));
  SPR.mote = toTex(drawDot('#9a9080', 1));
}
