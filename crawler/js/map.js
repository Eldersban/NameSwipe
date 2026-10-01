'use strict';
// ---------------------------------------------------------------------------
// Dungeon generation (rooms + corridors), line of sight, and the BFS flow
// field monsters use to chase the player through corridors.
// ---------------------------------------------------------------------------

const T_EMPTY = 0, T_WALL = 1, T_WALL2 = 2, T_SAFE = 3, T_BOSS = 4, T_DOOR = 8, T_BOSSDOOR = 9;
const Z_NORMAL = 0, Z_SAFE = 1, Z_BOSS = 2;

// Flame tint and light color for each floor's braziers.
const THEME_LIGHTS = {
  stone: [['fire', [1.0, 0.62, 0.3]]],
  moss: [['fire', [1.0, 0.7, 0.36]]],
  bone: [['ghost', [0.3, 0.8, 0.58]]],
  furnace: [['hot', [1.0, 0.42, 0.16]]],
  studio: [['pink', [1.0, 0.3, 0.8]], ['cyan', [0.3, 0.8, 1.0]]],
};

class Dungeon {
  constructor(floorIdx, seed) {
    this.floorIdx = floorIdx;
    const rng = this.rng = mulberry32(seed);
    const W = this.W = 52 + floorIdx * 4, H = this.H = 52 + floorIdx * 4;
    this.tiles = new Uint8Array(W * H).fill(T_WALL);
    this.zone = new Uint8Array(W * H);
    this.door = new Float32Array(W * H);     // 0 closed .. 1 open
    this.doorMoving = new Uint8Array(W * H);
    this.seen = new Uint8Array(W * H);
    this.lr = new Float32Array(W * H); this.lg = new Float32Array(W * H); this.lb = new Float32Array(W * H);
    // light sampled at cell corners (vertices), static and per-frame copies
    const V = (W + 1) * (H + 1);
    this.svr = new Float32Array(V); this.svg = new Float32Array(V); this.svb = new Float32Array(V);
    this.vr = new Float32Array(V); this.vg = new Float32Array(V); this.vb = new Float32Array(V);
    this.flow = new Int16Array(W * H);
    this.flowFrom = -1;
    this.spawns = { mobs: [], chests: [], items: [], decor: [], lights: [] };
    this.generate(rng);
  }

  idx(x, y) { return y * this.W + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  tileAt(x, y) { return this.inside(x, y) ? this.tiles[y * this.W + x] : T_WALL; }
  isDoorTile(t) { return t === T_DOOR || t === T_BOSSDOOR; }

  // Blocks movement: walls and doors that are not (mostly) open.
  solid(x, y) {
    x |= 0; y |= 0;
    if (!this.inside(x, y)) return true;
    const i = y * this.W + x, t = this.tiles[i];
    if (t === T_EMPTY) return false;
    if (t === T_DOOR || t === T_BOSSDOOR) return this.door[i] < 0.85;
    return true;
  }
  blocksSight(x, y) {
    x |= 0; y |= 0;
    if (!this.inside(x, y)) return true;
    const i = y * this.W + x, t = this.tiles[i];
    if (t === T_EMPTY) return false;
    if (t === T_DOOR || t === T_BOSSDOOR) return this.door[i] < 0.6;
    return true;
  }
  passable(i) { const t = this.tiles[i]; return t === T_EMPTY || t === T_DOOR || t === T_BOSSDOOR; }

  generate(rng) {
    const { W, H } = this;
    const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const rooms = this.rooms = [];
    const overlaps = (r) => rooms.some(o => r.x - 2 < o.x + o.w && r.x + r.w + 2 > o.x && r.y - 2 < o.y + o.h && r.y + r.h + 2 > o.y);
    // safe room first: fixed size
    for (let tries = 0; tries < 200 && rooms.length === 0; tries++) {
      const r = { x: ri(2, W - 9), y: ri(2, H - 9), w: 6, h: 6 };
      rooms.push(r);
    }
    const target = 17 + this.floorIdx * 2;
    for (let tries = 0; tries < 600 && rooms.length < target; tries++) {
      const big = rng() < 0.3;
      const w = big ? ri(8, 11) : ri(4, 8), h = big ? ri(8, 11) : ri(4, 8);
      const r = { x: ri(2, W - w - 2), y: ri(2, H - h - 2), w, h };
      if (!overlaps(r)) rooms.push(r);
    }
    rooms.forEach(r => { r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1); });
    for (const r of rooms) this.carveRect(r.x, r.y, r.w, r.h);

    // connect rooms: Prim's tree + a few loops
    const connected = [0], edges = [];
    const remaining = rooms.map((_, i) => i).slice(1);
    while (remaining.length) {
      let best = null, bd = 1e9;
      for (const a of connected) for (const b of remaining) {
        const d = Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
        if (d < bd) { bd = d; best = [a, b]; }
      }
      edges.push(best); connected.push(best[1]); remaining.splice(remaining.indexOf(best[1]), 1);
    }
    for (let k = 0; k < 5; k++) {
      const a = 1 + Math.floor(rng() * (rooms.length - 1)), b = 1 + Math.floor(rng() * (rooms.length - 1));
      if (a !== b) edges.push([a, b]);
    }
    // pick boss room after the tree exists (needs distances), so carve first
    for (const [a, b] of edges) this.corridor(rooms[a], rooms[b], rng, a === 0 || b === 0 ? 1 : (rng() < 0.3 ? 2 : 1));

    const safe = this.safeRoom = rooms[0];
    this.start = { x: safe.cx + 0.5, y: safe.cy + 0.5 };
    const dist = this.bfs(safe.cx, safe.cy);
    let bossRoom = null, bdist = -1;
    for (const r of rooms.slice(1)) {
      const d = dist[this.idx(r.cx, r.cy)] + (r.w >= 7 && r.h >= 7 ? 12 : 0);
      if (d > bdist) { bdist = d; bossRoom = r; }
    }
    this.bossRoom = bossRoom;

    // zones
    for (let y = safe.y; y < safe.y + safe.h; y++) for (let x = safe.x; x < safe.x + safe.w; x++) this.zone[this.idx(x, y)] = Z_SAFE;
    for (let y = bossRoom.y; y < bossRoom.y + bossRoom.h; y++) for (let x = bossRoom.x; x < bossRoom.x + bossRoom.w; x++) this.zone[this.idx(x, y)] = Z_BOSS;

    // doors
    for (const r of rooms) this.placeDoors(r, r === safe ? 1 : r === bossRoom ? 2 : 0, rng);

    // wall dressing
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, y);
      if (this.tiles[i] !== T_WALL) continue;
      let nearSafe = false, nearBoss = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!this.inside(x + dx, y + dy)) continue;
        const z = this.zone[this.idx(x + dx, y + dy)], t = this.tiles[this.idx(x + dx, y + dy)];
        if (t === T_EMPTY && z === Z_SAFE) nearSafe = true;
        if (t === T_EMPTY && z === Z_BOSS) nearBoss = true;
      }
      if (nearSafe) this.tiles[i] = T_SAFE;
      else if (nearBoss) this.tiles[i] = T_BOSS;
      else if (rng() < 0.1) this.tiles[i] = T_WALL2;
    }

    this.stairs = { x: bossRoom.cx + 0.5, y: bossRoom.cy + 0.5 };
    this.mordecai = { x: safe.x + 0.7, y: safe.y + 0.7 };
    this.populate(rng, dist);
    this.computeLight();
  }

  carveRect(x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inside(i, j)) this.tiles[this.idx(i, j)] = T_EMPTY;
  }

  corridor(a, b, rng, width) {
    let x = a.cx, y = a.cy;
    const horizFirst = rng() < 0.5;
    const carve = (cx, cy) => {
      for (let k = 0; k < width; k++) {
        const i = cx + (horizFirst ? 0 : k), j = cy + (horizFirst ? k : 0);
        if (i > 0 && j > 0 && i < this.W - 1 && j < this.H - 1) this.tiles[this.idx(i, j)] = T_EMPTY;
      }
    };
    const stepX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); carve(x, y); } };
    const stepY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); carve(x, y); } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  }

  placeDoors(r, special, rng) {
    const wallish = (x, y) => { const t = this.tileAt(x, y); return t !== T_EMPTY && !this.isDoorTile(t); };
    const tryDoor = (x, y, horizontalSide) => {
      if (!this.inside(x, y) || this.tileAt(x, y) !== T_EMPTY) return;
      const ok = horizontalSide ? (wallish(x - 1, y) && wallish(x + 1, y)) : (wallish(x, y - 1) && wallish(x, y + 1));
      if (!ok) return;
      if (special || rng() < 0.4) {
        this.tiles[this.idx(x, y)] = special === 2 ? T_BOSSDOOR : T_DOOR;
        if (special === 1) this.zone[this.idx(x, y)] = Z_SAFE;
      }
    };
    for (let x = r.x; x < r.x + r.w; x++) { tryDoor(x, r.y - 1, true); tryDoor(x, r.y + r.h, true); }
    for (let y = r.y; y < r.y + r.h; y++) { tryDoor(r.x - 1, y, false); tryDoor(r.x + r.w, y, false); }
  }

  bfs(sx, sy) {
    const { W, H } = this, dist = new Int16Array(W * H).fill(-1), q = new Int32Array(W * H);
    let h = 0, t = 0;
    const s = this.idx(sx, sy); dist[s] = 0; q[t++] = s;
    while (h < t) {
      const i = q[h++], x = i % W, y = (i / W) | 0, d = dist[i] + 1;
      const n = [i - 1, i + 1, i - W, i + W];
      if (x === 0) n[0] = -1; if (x === W - 1) n[1] = -1; if (y === 0) n[2] = -1; if (y === H - 1) n[3] = -1;
      for (const j of n) if (j >= 0 && dist[j] < 0 && this.passable(j)) { dist[j] = d; q[t++] = j; }
    }
    return dist;
  }

  updateFlow(px, py) {
    const i = this.idx(px | 0, py | 0);
    if (i === this.flowFrom) return;
    this.flowFrom = i;
    this.flow = this.bfs(px | 0, py | 0);
  }

  // Direction (unit vector) a monster at (x,y) should step to approach the player.
  flowDir(x, y) {
    const cx = x | 0, cy = y | 0, W = this.W;
    const here = this.flow[this.idx(cx, cy)];
    let best = here < 0 ? 1e9 : here, bx = -1, by = -1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!this.inside(nx, ny)) continue;
      const d = this.flow[ny * W + nx];
      if (d < 0) continue;
      if (dx && dy && (!this.passable(cy * W + nx) || !this.passable(ny * W + cx))) continue;
      if (d < best) { best = d; bx = nx; by = ny; }
    }
    if (bx < 0) return null;
    const tx = bx + 0.5 - x, ty = by + 0.5 - y, l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l, cell: by * W + bx };
  }

  los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d * 4);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.blocksSight(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  randomCellIn(r, rng, margin = 0) {
    return {
      x: r.x + margin + Math.floor(rng() * (r.w - margin * 2)) + 0.5,
      y: r.y + margin + Math.floor(rng() * (r.h - margin * 2)) + 0.5,
    };
  }

  populate(rng, dist) {
    const F = FLOORS[this.floorIdx], sp = this.spawns;
    const normalRooms = this.rooms.filter(r => r !== this.safeRoom && r !== this.bossRoom);
    const used = new Set();
    const free = (x, y) => {
      const i = this.idx(x | 0, y | 0);
      return this.tiles[i] === T_EMPTY && !used.has(i);
    };
    const claim = (x, y) => used.add(this.idx(x | 0, y | 0));
    used.add(this.idx(this.stairs.x | 0, this.stairs.y | 0));

    // monsters
    for (let k = 0, tries = 0; k < F.count && tries < 2000; tries++) {
      let p;
      if (rng() < 0.75 && normalRooms.length) p = this.randomCellIn(normalRooms[Math.floor(rng() * normalRooms.length)], rng);
      else p = { x: 1 + Math.floor(rng() * (this.W - 2)) + 0.5, y: 1 + Math.floor(rng() * (this.H - 2)) + 0.5 };
      const i = this.idx(p.x | 0, p.y | 0);
      if (!free(p.x, p.y) || this.zone[i] !== Z_NORMAL || dist[i] < 8) continue;
      claim(p.x, p.y);
      sp.mobs.push({ type: F.pool[Math.floor(rng() * F.pool.length)], x: p.x, y: p.y });
      k++;
    }
    // boss guards the stairs
    const br = this.bossRoom;
    sp.boss = { type: F.boss, x: br.cx + 0.5, y: Math.max(br.y + 0.5, br.cy - 1.5) };

    // chests in room corners
    const nChests = 4 + Math.floor(this.floorIdx / 2);
    for (let k = 0, tries = 0; k < nChests && tries < 200; tries++) {
      const r = normalRooms[Math.floor(rng() * normalRooms.length)];
      if (!r) break;
      const x = (rng() < 0.5 ? r.x : r.x + r.w - 1) + 0.5, y = (rng() < 0.5 ? r.y : r.y + r.h - 1) + 0.5;
      if (!free(x, y)) continue;
      claim(x, y); sp.chests.push({ x, y }); k++;
    }
    // loose items
    const loose = [['coins', 10], ['potion', 3], ['bolts', 3], ['lobbers', 2]];
    for (const [kind, n] of loose) for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
      const r = normalRooms[Math.floor(rng() * normalRooms.length)];
      if (!r) break;
      const p = this.randomCellIn(r, rng);
      if (!free(p.x, p.y)) continue;
      claim(p.x, p.y); sp.items.push({ kind, x: p.x + (rng() - 0.5) * 0.4, y: p.y + (rng() - 0.5) * 0.4 }); k++;
    }
    // light sources + decor
    const theme = F.theme, tl = THEME_LIGHTS[theme];
    let li = 0;
    for (const r of this.rooms) {
      const corners = [[r.x + 0.5, r.y + 0.5], [r.x + r.w - 0.5, r.y + r.h - 0.5], [r.x + r.w - 0.5, r.y + 0.5], [r.x + 0.5, r.y + r.h - 0.5]];
      const n = r === this.safeRoom ? 0 : r === this.bossRoom ? 4 : 1 + (rng() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const [x, y] = corners[(k + (r === this.bossRoom ? 0 : Math.floor(rng() * 4))) % 4];
        if (!free(x, y)) continue;
        claim(x, y);
        const [tint, col] = r === this.bossRoom && theme !== 'bone' && theme !== 'studio' ? ['hot', [1.0, 0.36, 0.18]] : tl[li++ % tl.length];
        sp.decor.push({ kind: 'brazier', x, y, tint });
        sp.lights.push({ x, y, s: 1.05, r: 5.5, c: col });
      }
      if (r === this.safeRoom) continue;
      const extra = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < extra; k++) {
        const p = this.randomCellIn(r, rng);
        if (!free(p.x, p.y)) continue;
        claim(p.x, p.y);
        const kind = theme === 'studio' ? (rng() < 0.5 ? 'camera' : 'barrel') : theme === 'bone' ? 'bones' : (rng() < 0.5 ? 'bones' : 'barrel');
        sp.decor.push({ kind, x: p.x + (rng() - 0.5) * 0.5, y: p.y + (rng() - 0.5) * 0.5 });
      }
    }
    // the safe room glows warmly; the stairs glow too
    const s = this.safeRoom;
    sp.lights.push({ x: s.cx + 0.5, y: s.cy + 0.5, s: 1.3, r: 6, c: [1.0, 0.82, 0.58] });
    sp.lights.push({ x: this.stairs.x, y: this.stairs.y, s: 0.9, r: 4.5, c: [0.4, 0.75, 1.0] });
  }

  computeLight() {
    const { W, H } = this;
    for (const L of this.spawns.lights) {
      const R = L.r || 5, c = L.c || [1, 1, 1];
      for (let y = Math.max(0, (L.y - R) | 0); y <= Math.min(H - 1, (L.y + R) | 0); y++) {
        for (let x = Math.max(0, (L.x - R) | 0); x <= Math.min(W - 1, (L.x + R) | 0); x++) {
          const d = Math.hypot(x + 0.5 - L.x, y + 0.5 - L.y);
          if (d > R) continue;
          const i = this.idx(x, y);
          if (!this.passable(i)) continue;
          if (d > 1 && !this.los(L.x, L.y, x + 0.5, y + 0.5)) continue;
          const f = 1 - d / R, v = L.s * (f * f * 1.1 + f * 0.25);
          this.lr[i] += v * c[0]; this.lg[i] += v * c[1]; this.lb[i] += v * c[2];
        }
      }
    }
    // Each vertex averages the open cells touching it and is darkened by the
    // walls around it: smooth gradients plus ambient occlusion in corners.
    const AO = [1, 0.86, 0.66, 0.5, 0.5];
    this.ao = new Float32Array((W + 1) * (H + 1));
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
      let r = 0, g = 0, b = 0, open = 0, solid = 0;
      for (const [cx, cy] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]) {
        if (!this.inside(cx, cy)) { solid++; continue; }
        const i = cy * W + cx;
        if (!this.passable(i)) { solid++; continue; }
        r += this.lr[i]; g += this.lg[i]; b += this.lb[i]; open++;
      }
      const vi = y * (W + 1) + x, k = open ? AO[solid] / open : 0;
      this.svr[vi] = Math.min(1.6, r * k); this.svg[vi] = Math.min(1.6, g * k); this.svb[vi] = Math.min(1.6, b * k);
      this.ao[vi] = AO[solid];
    }
  }

  // Copy static light, then add this frame's moving lights (explosions, spells).
  prepareLight(dyn) {
    this.vr.set(this.svr); this.vg.set(this.svg); this.vb.set(this.svb);
    const VW = this.W + 1;
    for (const L of dyn) {
      const R = L.r;
      const x0 = Math.max(0, Math.ceil(L.x - R)), x1 = Math.min(this.W, Math.floor(L.x + R));
      const y0 = Math.max(0, Math.ceil(L.y - R)), y1 = Math.min(this.H, Math.floor(L.y + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - L.x, y - L.y);
        if (d >= R) continue;
        const vi = y * VW + x, f = 1 - d / R, v = f * f * L.i * this.ao[vi];
        this.vr[vi] += v * L.c[0]; this.vg[vi] += v * L.c[1]; this.vb[vi] += v * L.c[2];
      }
    }
  }

  // Interpolated light at a world position: [r, g, b].
  lightAt(x, y, out) {
    const VW = this.W + 1;
    const cx = clamp(x | 0, 0, this.W - 1), cy = clamp(y | 0, 0, this.H - 1);
    const ux = clamp(x - cx, 0, 1), uy = clamp(y - cy, 0, 1), i = cy * VW + cx;
    const f = (a) => { const t = a[i] + (a[i + 1] - a[i]) * ux, b = a[i + VW] + (a[i + VW + 1] - a[i + VW]) * ux; return t + (b - t) * uy; };
    out[0] = f(this.vr); out[1] = f(this.vg); out[2] = f(this.vb);
    return out;
  }
}
