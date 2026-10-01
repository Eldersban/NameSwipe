'use strict';
// ---------------------------------------------------------------------------
// Core game simulation: player, weapons, monsters, Donut, projectiles, loot,
// achievements, viewers, and floor progression.
// ---------------------------------------------------------------------------

const G = {
  state: 'title', floor: 0, map: null, time: 0,
  mobs: [], items: [], projs: [], parts: [], decor: [], texts: [],
  player: null, donut: null, boss: null, bossDead: false, bossSeen: false,
  timeLeft: 0, shake: 0, flash: 0, warned: false,
  input: { keys: {}, mouseDown: false, mdx: 0, mdy: 0 },
  floorStats: null,
};

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = n => Math.round(n).toLocaleString('en-US');

// ================================ PLAYER ===================================

function newPlayer() {
  return {
    x: 0, y: 0, a: 0, pitch: 0, radius: 0.24,
    hp: 100, level: 1, xp: 0, points: 0,
    stats: { str: 4, con: 4, dex: 4, cha: 3 },
    gold: 0, potions: 2, boxes: [], gauntlet: 0,
    weapon: 'fists', weapons: { fists: true, club: false, crossbow: false, lobber: true },
    ammo: { bolts: 0, lobbers: 3 },
    cd: 0, kickCd: 0, attackAnim: 0, kickAnim: 0, punchSide: false,
    bob: 0, bobY: 0, hurtT: 0, potionsUsedFloor: 0,
    achievements: {}, viewers: 1200, fanMilestone: 0,
    kills: 0, killsBy: { fists: 0, club: 0, crossbow: 0, lobber: 0, kick: 0, donut: 0 },
    goldSpent: 0, tonicsBought: 0, gauntletsBought: 0, totalTime: 0, deaths: 0,
    donutUltCd: 0,
  };
}

const maxHp = P => 60 + P.stats.con * 10 + (P.level - 1) * 6;
const xpNeed = lvl => Math.floor(40 * Math.pow(lvl, 1.55));
const floorMul = () => 1 + 0.38 * G.floor;
const dmgMul = () => 1 + 0.26 * G.floor;
// Bosses already hit harder floor by floor, so they scale gently.
const mobDmg = d => d.dmg * (d.boss ? 1 + 0.08 * G.floor : dmgMul());
const shopDiscount = P => Math.max(0.55, 1 - P.stats.cha * 0.025);

function weaponDamage(P, w) {
  const s = P.stats;
  switch (w) {
    case 'fists': return (5 + s.str * 1.7) * GAUNTLETS[P.gauntlet].mult;
    case 'club': return 13 + s.str * 2.6;
    case 'crossbow': return 15 + s.dex * 2.4;
    case 'lobber': return 42 + s.dex * 3 + G.floor * 8;
    case 'kick': return 8 + s.str * 1.4;
  }
  return 0;
}
function weaponCooldown(P, w) {
  const dex = P.stats.dex;
  switch (w) {
    case 'fists': return Math.max(0.2, 0.4 - dex * 0.008);
    case 'club': return Math.max(0.45, 0.75 - dex * 0.01);
    case 'crossbow': return Math.max(0.45, 0.85 - dex * 0.012);
    case 'lobber': return 0.9;
  }
  return 0.5;
}

// ================================ FLOORS ===================================

function startNewGame() {
  G.player = newPlayer();
  G.player.hp = maxHp(G.player);
  G.floor = 0;
  enterFloor(0, true);
}

function enterFloor(f, fresh) {
  G.floor = f;
  const F = FLOORS[f];
  const seed = (Date.now() & 0xffffff) ^ (f * 7919);
  G.map = new Dungeon(f, seed);
  Render.setTheme(buildTheme(F.theme, 1000 + f * 17), F.fog);
  Sound.setTheme(f);
  const M = G.map, P = G.player;
  P.x = M.start.x; P.y = M.start.y; P.a = Math.atan2(M.bossRoom.cy - M.safeRoom.cy, M.bossRoom.cx - M.safeRoom.cx); P.pitch = 0;
  P.potionsUsedFloor = 0;
  G.mobs = []; G.items = []; G.projs = []; G.parts = []; G.decor = []; G.texts = [];
  G.boss = null; G.bossDead = false; G.bossSeen = false; G.motes = null;
  G.timeLeft = F.time; G.warned = false; G.time = 0;
  G.floorStats = { kills: 0, gold: 0, viewers: P.viewers, start: performance.now() };

  for (const s of M.spawns.mobs) spawnMob(s.type, s.x, s.y);
  G.boss = spawnMob(M.spawns.boss.type, M.spawns.boss.x, M.spawns.boss.y);
  for (const c of M.spawns.chests) G.items.push({ kind: 'chest', x: c.x, y: c.y, open: false });
  for (const it of M.spawns.items) G.items.push({ kind: it.kind, x: it.x, y: it.y, amount: itemAmount(it.kind) });
  for (const d of M.spawns.decor) G.decor.push({ kind: d.kind, x: d.x, y: d.y, tint: d.tint, ph: Math.random() * 3 });
  G.decor.push({ kind: 'mordecai', x: M.mordecai.x, y: M.mordecai.y });
  G.decor.push({ kind: 'stairs', x: M.stairs.x, y: M.stairs.y });

  G.donut = { x: P.x - Math.cos(P.a) * 0.8, y: P.y - Math.sin(P.a) * 0.8, cd: 2, anim: 0, castT: 0, quipT: 25, moving: false };

  saveGame();
  G.state = 'intro';
  UI.showFloorIntro(f);
  if (fresh) {
    setTimeout(() => { if (G.floor === 0) unlock('pantsless'); }, 2500);
    setTimeout(() => donutSay(pick(DONUT_LINES.start)), 6000);
  } else {
    setTimeout(() => donutSay(pick(DONUT_LINES.descend)), 3000);
  }
}

function itemAmount(kind) {
  switch (kind) {
    case 'coins': return randi(4, 10) * (1 + G.floor);
    case 'bolts': return randi(4, 8);
    case 'lobbers': return 1;
    default: return 1;
  }
}

function descend() {
  const P = G.player, F = FLOORS[G.floor];
  Sound.play('descend');
  if (G.timeLeft > F.time / 2) unlock('speedrun');
  if (P.potionsUsedFloor === 0) unlock('tough');
  P.totalTime += F.time - G.timeLeft;
  const summary = {
    floor: G.floor, kills: G.floorStats.kills, gold: G.floorStats.gold,
    viewers: P.viewers - G.floorStats.viewers, time: F.time - G.timeLeft,
  };
  if (G.floor === FLOORS.length - 1) {
    G.state = 'victory';
    clearSave();
    UI.showVictory();
    return;
  }
  G.state = 'summary';
  UI.showFloorSummary(summary);
}

// ================================ SAVE =====================================

const SAVE_KEY = 'crawl-carl-save-v1';
function saveGame() {
  try {
    const P = G.player;
    const snap = JSON.parse(JSON.stringify(P));
    localStorage.setItem(SAVE_KEY, JSON.stringify({ floor: G.floor, player: snap, hp: P.hp }));
  } catch (e) { /* storage unavailable */ }
}
function loadSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
function continueGame() {
  const s = loadSave();
  if (!s) return startNewGame();
  G.player = Object.assign(newPlayer(), s.player);
  G.player.hp = Math.max(maxHp(G.player) * 0.6, s.hp);
  enterFloor(s.floor, false);
}

// ================================ MOBS =====================================

function spawnMob(type, x, y) {
  const d = MOBS[type];
  const hp = d.hp * (d.boss ? 1 : floorMul());
  const m = {
    type, d, x, y, hp, maxHp: hp, state: d.boss ? 'idle' : 'idle',
    cd: rand(0.5, d.cd), anim: Math.random() * 2, atkT: 0, flash: 0, stun: 0,
    kx: 0, ky: 0, dead: false, deadT: 0, losT: Math.random() * 0.3, los: false,
    abil: (d.abilities || []).map(a => ({ ...a, t: a.every * rand(0.5, 1) })),
    charging: 0, cdx: 0, cdy: 0, mirror: Math.random() < 0.5, noticed: false, stepT: 0,
  };
  G.mobs.push(m);
  return m;
}

function mobCanStand(x, y, r) {
  const M = G.map;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const cx = (x + ox) | 0, cy = (y + oy) | 0;
    if (M.solid(cx, cy)) return false;
    if (M.zone[M.idx(cx, cy)] === Z_SAFE) return false;
  }
  return true;
}

function moveMob(m, vx, vy, dt) {
  const r = m.d.radius, M = G.map;
  const nx = m.x + vx * dt, ny = m.y + vy * dt;
  // monsters open ordinary doors by walking into them
  const tryDoor = (x, y) => {
    const i = M.idx(x | 0, y | 0), t = M.tiles[i];
    if ((t === T_DOOR || t === T_BOSSDOOR) && M.door[i] < 1 && M.zone[i] !== Z_SAFE) openDoor(i);
  };
  tryDoor(nx + Math.sign(vx) * r, m.y); tryDoor(m.x, ny + Math.sign(vy) * r);
  if (mobCanStand(nx, m.y, r)) m.x = nx;
  if (mobCanStand(m.x, ny, r)) m.y = ny;
}

function updateMobs(dt) {
  const P = G.player, M = G.map;
  for (const m of G.mobs) {
    if (m.dead) { m.deadT += dt; continue; }
    const d = m.d;
    m.flash -= dt; m.anim += dt; m.atkT -= dt;
    const dx = P.x - m.x, dy = P.y - m.y, dist = Math.hypot(dx, dy);
    m.losT -= dt;
    if (m.losT <= 0) { m.losT = 0.25; m.los = dist < 18 && M.los(m.x, m.y, P.x, P.y); }

    // knockback
    if (m.kx || m.ky) {
      moveMob(m, m.kx, m.ky, dt);
      m.kx *= Math.pow(0.02, dt); m.ky *= Math.pow(0.02, dt);
      if (Math.abs(m.kx) + Math.abs(m.ky) < 0.1) m.kx = m.ky = 0;
    }
    if (m.stun > 0) { m.stun -= dt; continue; }

    if (m.state === 'idle') {
      const wake = (m.los && dist < (d.boss ? 11 : 10)) || dist < 2.5 || (d.boss && M.zone[M.idx(P.x | 0, P.y | 0)] === Z_BOSS);
      if (wake) aggro(m);
      else continue;
    }
    if (G.state !== 'playing') continue;

    const pz = M.zone[M.idx(P.x | 0, P.y | 0)];
    const playerSafe = pz === Z_SAFE;

    // boss abilities
    if (d.boss) updateBoss(m, dt, dist, dx, dy);
    if (m.charging > 0) {
      m.charging -= dt;
      moveMob(m, m.cdx * 8, m.cdy * 8, dt);
      if (dist < d.radius + P.radius + 0.4 && m.atkT < 0) { hurtPlayer(mobDmg(d) * 1.2, m); m.atkT = 0.6; }
      continue;
    }

    m.cd -= dt;
    let vx = 0, vy = 0;
    const sp = d.speed * (d.boss ? 1 : 1 + G.floor * 0.04);
    if (d.ranged) {
      const keep = d.ranged.keep;
      if (m.los && dist < 14) {
        if (m.cd <= 0 && !playerSafe) {
          m.cd = d.cd * rand(0.8, 1.2); m.atkT = 0.35;
          fireAt(m, P.x, P.y, d.ranged.proj, d.ranged.speed, mobDmg(d));
        }
        if (dist < keep - 1.5) { vx = -dx / dist * sp * 0.8; vy = -dy / dist * sp * 0.8; }
        else if (dist > keep + 1) { vx = dx / dist * sp; vy = dy / dist * sp; }
        else { const s = Math.sin(m.anim * 0.9 + m.x) > 0 ? 1 : -1; vx = -dy / dist * sp * 0.5 * s; vy = dx / dist * sp * 0.5 * s; }
      } else {
        const f = M.flowDir(m.x, m.y);
        if (f) { vx = f.x * sp; vy = f.y * sp; }
      }
    } else {
      const reach = d.range + P.radius;
      if (dist <= reach && m.los) {
        if (m.cd <= 0) {
          m.cd = d.cd; m.atkT = 0.35;
          hurtPlayer(mobDmg(d), m);
          if (m.type === 'rat' || m.type === 'ratking') Sound.play('squeak');
        }
      } else if (m.los && dist < 4) {
        vx = dx / dist * sp; vy = dy / dist * sp;
      } else {
        const f = M.flowDir(m.x, m.y);
        if (f) { vx = f.x * sp; vy = f.y * sp; }
        else if (m.los) { vx = dx / dist * sp; vy = dy / dist * sp; }
      }
    }
    if (vx || vy) {
      moveMob(m, vx, vy, dt);
      m.mirror = (vx * -Math.sin(P.a) + vy * Math.cos(P.a)) < 0;
    }
  }
  // soft separation so monsters don't stack into one sprite
  const live = G.mobs.filter(m => !m.dead);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.d.radius + b.d.radius;
    if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d < rr) {
      const push = (rr - d) * 0.5, ux = dx / d, uy = dy / d;
      if (mobCanStand(a.x - ux * push, a.y - uy * push, a.d.radius)) { a.x -= ux * push; a.y -= uy * push; }
      if (mobCanStand(b.x + ux * push, b.y + uy * push, b.d.radius)) { b.x += ux * push; b.y += uy * push; }
    }
  }
}

function aggro(m) {
  if (m.state !== 'idle') return;
  m.state = 'chase';
  if (m.d.boss && !G.bossSeen) {
    G.bossSeen = true;
    Sound.play('roar');
    UI.bossIntro(m);
    systemSay(`${m.d.name}: "${m.d.taunt}"`, 'boss');
    setTimeout(() => donutSay(pick(DONUT_LINES.boss)), 2500);
  }
}

function updateBoss(m, dt, dist, dx, dy) {
  const P = G.player;
  const enraged = m.hp < m.maxHp * 0.4;
  for (const a of m.abil) {
    a.t -= dt * (enraged ? 1.4 : 1);
    if (a.t > 0) continue;
    a.t = a.every * rand(0.85, 1.15);
    switch (a.kind) {
      case 'summon': {
        const alive = G.mobs.filter(x => !x.dead && !x.d.boss).length;
        if (alive > 40) break;
        for (let i = 0; i < a.n; i++) {
          const ang = Math.random() * Math.PI * 2;
          const x = m.x + Math.cos(ang) * 1.2, y = m.y + Math.sin(ang) * 1.2;
          if (mobCanStand(x, y, MOBS[a.mob].radius)) { const s = spawnMob(a.mob, x, y); aggro(s); puff(x, y, 'dust', 8); }
        }
        break;
      }
      case 'spread': {
        if (!m.los) break;
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < a.n; i++) {
          const ang = base + (i - (a.n - 1) / 2) * (a.arc / Math.max(1, a.n - 1)) * 2;
          fireDir(m, ang, a.proj, a.speed, mobDmg(m.d) * 0.7);
        }
        m.atkT = 0.4;
        break;
      }
      case 'radial': {
        const off = Math.random();
        for (let i = 0; i < a.n; i++) fireDir(m, off + i / a.n * Math.PI * 2, a.proj, a.speed, mobDmg(m.d) * 0.6);
        m.atkT = 0.4;
        break;
      }
      case 'charge': {
        if (!m.los || dist < 2) { a.t = 1; break; }
        m.charging = 0.7; m.cdx = dx / dist; m.cdy = dy / dist;
        Sound.play('roar');
        break;
      }
      case 'teleport': {
        const M = G.map, r = M.bossRoom;
        for (let k = 0; k < 20; k++) {
          const x = r.x + 0.5 + Math.random() * (r.w - 1), y = r.y + 0.5 + Math.random() * (r.h - 1);
          if (Math.hypot(x - P.x, y - P.y) > 3 && mobCanStand(x, y, m.d.radius)) {
            puff(m.x, m.y, 'cyan', 14); m.x = x; m.y = y; puff(x, y, 'cyan', 14); Sound.play('teleport'); break;
          }
        }
        break;
      }
    }
  }
}

function damageMob(m, dmg, source, kx = 0, ky = 0) {
  if (m.dead) return false;
  const crit = source !== 'donut' && Math.random() < 0.05 + G.player.stats.dex * 0.006;
  if (crit) dmg *= 1.8;
  dmg = Math.round(dmg * rand(0.9, 1.1));
  m.hp -= dmg; m.flash = 0.1;
  if (m.d.boss) { kx *= 0.15; ky *= 0.15; }
  m.kx += kx; m.ky += ky;
  aggro(m);
  G.texts.push({ x: m.x, y: m.y, z: (m.d.z || 0) + m.d.h + 0.1, text: crit ? dmg + '!' : '' + dmg, color: crit ? '#ffe040' : source === 'donut' ? '#ff9af0' : '#ffffff', life: 0.8, vz: 0.8, big: crit });
  puff(m.x, m.y, m.type === 'skeleton' || m.type === 'bonewright' ? 'dust' : m.type === 'wisp' ? 'ember' : 'blood', 5, (m.d.z || 0) + m.d.h * 0.6);
  Sound.play('hit');
  if (m.hp <= 0) { killMob(m, source); return true; }
  return false;
}

function killMob(m, source) {
  const P = G.player, d = m.d;
  m.dead = true; m.hp = 0; m.deadT = 0;
  Sound.play('mobDie');
  puff(m.x, m.y, m.type === 'skeleton' || m.type === 'bonewright' ? 'dust' : 'blood', 14, d.h * 0.5);
  P.kills++; G.floorStats.kills++;
  P.killsBy[source] = (P.killsBy[source] || 0) + 1;
  const xp = Math.round(d.xp * (d.boss ? 1 : 1 + 0.3 * G.floor));
  gainXp(xp);
  const g = randi(d.gold[0], d.gold[1]) * (d.boss ? 1 : 1 + G.floor);
  if (g > 0) G.items.push({ kind: 'coins', x: m.x, y: m.y, amount: g });
  if (!d.boss && Math.random() < 0.07) G.items.push({ kind: 'potion', x: m.x + 0.2, y: m.y, amount: 1 });
  if (!d.boss && P.weapons.crossbow && Math.random() < 0.1) G.items.push({ kind: 'bolts', x: m.x - 0.2, y: m.y, amount: randi(2, 4) });
  addViewers((d.boss ? 60000 : 900) * (1 + G.floor * 0.6) * (source === 'kick' ? 2 : source === 'lobber' ? 1.5 : 1));
  if (source === 'donut' && Math.random() < 0.35) donutSay(pick(DONUT_LINES.kill));
  if (!P.achievements.firstblood) unlock('firstblood');
  if (P.killsBy.fists >= 15) unlock('knuckles');
  if (P.killsBy.club >= 10) unlock('bonk');
  if (P.killsBy.crossbow >= 10) unlock('pewpew');
  if (P.killsBy.kick >= 5) unlock('kicker');
  if (P.killsBy.donut >= 10) unlock('catkill');
  if (d.boss) {
    G.bossDead = true;
    UI.bossBar(null);
    G.items.push({ kind: 'box', x: m.x, y: m.y, box: 'boss' });
    systemSay(SYSTEM_LINES.stairsOpen, 'good');
    unlock('firstboss');
    if (G.floor === FLOORS.length - 1) unlock('finale');
    // lingering minions flee in shame
    for (const o of G.mobs) if (!o.dead && Math.hypot(o.x - m.x, o.y - m.y) < 12) { o.stun = 1; }
    G.shake = 1;
  }
}

// ================================ PROJECTILES ==============================

function fireAt(m, tx, ty, proj, speed, dmg) {
  fireDir(m, Math.atan2(ty - m.y, tx - m.x) + rand(-0.04, 0.04), proj, speed, dmg);
}
function fireDir(m, ang, proj, speed, dmg) {
  G.projs.push({
    x: m.x + Math.cos(ang) * (m.d.radius + 0.1), y: m.y + Math.sin(ang) * (m.d.radius + 0.1), z: (m.d.z || 0) + m.d.h * 0.55,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, vz: 0,
    kind: proj, owner: 'enemy', dmg, life: 4, r: 0.18,
  });
  Sound.play(proj === 'fireball' ? 'fireball' : 'enemyShot');
}

function updateProjs(dt) {
  const P = G.player, M = G.map;
  for (const p of G.projs) {
    if (p.dead) continue;
    p.life -= dt;
    if (p.kind === 'lobber') { updateLobber(p, dt); continue; }
    if (p.life <= 0) { p.dead = true; continue; }
    if (p.homing && p.target && !p.target.dead) {
      const t = p.target, want = Math.atan2(t.y - p.y, t.x - p.x), cur = Math.atan2(p.vy, p.vx);
      let da = want - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      const na = cur + clamp(da, -6 * dt, 6 * dt), sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      p.z += ((t.d.z || 0) + t.d.h * 0.5 - p.z) * Math.min(1, dt * 4);
    }
    const steps = 3;
    for (let s = 0; s < steps && !p.dead; s++) {
      p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
      if (M.solid(p.x, p.y)) { p.dead = true; puff(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.kind === 'missile' ? 'pink' : 'spark', 4, p.z); break; }
      if (p.owner === 'enemy') {
        if (Math.hypot(P.x - p.x, P.y - p.y) < P.radius + p.r) {
          p.dead = true; hurtPlayer(p.dmg, null);
        }
      } else {
        for (const m of G.mobs) {
          if (m.dead) continue;
          if (Math.hypot(m.x - p.x, m.y - p.y) < m.d.radius + p.r) {
            p.dead = true;
            const l = Math.hypot(p.vx, p.vy) || 1;
            damageMob(m, p.dmg, p.owner === 'donut' ? 'donut' : 'crossbow', p.vx / l * 1.5, p.vy / l * 1.5);
            puff(p.x, p.y, p.owner === 'donut' ? 'pink' : 'spark', 5, p.z);
            break;
          }
        }
      }
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
}

function updateLobber(p, dt) {
  const M = G.map;
  p.vz -= 9 * dt; p.z += p.vz * dt;
  if (p.z < 0.08) { p.z = 0.08; if (p.vz < -1) Sound.play('bounce'); p.vz = -p.vz * 0.35; p.vx *= 0.7; p.vy *= 0.7; }
  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  if (M.solid(nx, p.y)) { p.vx = -p.vx * 0.5; Sound.play('bounce'); } else p.x = nx;
  if (M.solid(p.x, ny)) { p.vy = -p.vy * 0.5; Sound.play('bounce'); } else p.y = ny;
  if (Math.random() < 0.5) G.parts.push({ x: p.x, y: p.y, z: p.z + 0.1, vx: 0, vy: 0, vz: 0.5, life: 0.3, img: 'spark', h: 0.05, bright: true });
  if (p.life <= 0) { p.dead = true; explode(p.x, p.y, p.dmg, 2.8); }
}

function explode(x, y, dmg, R) {
  const P = G.player;
  Sound.play('explode');
  G.shake = Math.max(G.shake, 1.2); G.flash = 0.8;
  G.parts.push({ x, y, z: 0.15, vx: 0, vy: 0, vz: 0, life: 0.6, maxLife: 0.6, anim: 'explosion', h: 1.6, bright: true });
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(1, 5);
    G.parts.push({ x, y, z: 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(1, 4), life: rand(0.4, 0.9), img: 'ember', h: 0.07, bright: true, grav: true });
  }
  let kills = 0;
  for (const m of G.mobs) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d > R + m.d.radius) continue;
    if (!G.map.los(x, y, m.x, m.y)) continue;
    const f = 1 - Math.min(1, d / (R + m.d.radius)) * 0.6;
    const ux = (m.x - x) / (d || 1), uy = (m.y - y) / (d || 1);
    if (damageMob(m, dmg * f, 'lobber', ux * 5, uy * 5)) kills++;
  }
  const pd = Math.hypot(P.x - x, P.y - y);
  if (pd < R && G.map.los(x, y, P.x, P.y)) {
    hurtPlayer(dmg * 0.45 * (1 - pd / R * 0.6), null, true);
    unlock('selfown');
  }
  if (kills >= 3) unlock('kaboom');
  if (kills >= 2) addViewers(kills * 4000);
}

// ================================ PLAYER ACTIONS ===========================

function playerAttack() {
  const P = G.player;
  if (P.cd > 0 || G.state !== 'playing') return;
  const w = P.weapon;
  if (w === 'crossbow' && P.ammo.bolts <= 0) { systemSay('Out of bolts. Buy more from Mordecai, or punch things like nature intended.', 'warn'); P.cd = 0.5; Sound.play('deny'); return; }
  if (w === 'lobber' && P.ammo.lobbers <= 0) { systemSay('Out of Hob-Lobbers.', 'warn'); P.cd = 0.5; Sound.play('deny'); return; }
  P.cd = weaponCooldown(P, w);
  P.attackAnim = 1;
  const dirX = Math.cos(P.a), dirY = Math.sin(P.a);
  if (w === 'fists' || w === 'club') {
    P.punchSide = !P.punchSide;
    const range = w === 'club' ? 1.55 : 1.25;
    const target = meleeTarget(range, w === 'club' ? 0.6 : 0.45);
    Sound.play('swing');
    if (target) {
      const kb = w === 'club' ? 3.5 : 1.8;
      damageMob(target, weaponDamage(P, w), w, dirX * kb, dirY * kb);
      Sound.play(w === 'club' ? 'club' : 'punch');
      G.shake = Math.max(G.shake, 0.25);
    }
  } else if (w === 'crossbow') {
    P.ammo.bolts--; P.muzzle = 0.12;
    Sound.play('crossbow');
    G.projs.push({ x: P.x + dirX * 0.3, y: P.y + dirY * 0.3, z: 0.45, vx: dirX * 22, vy: dirY * 22, kind: 'bolt', owner: 'player', dmg: weaponDamage(P, w), life: 2, r: 0.12 });
  } else if (w === 'lobber') {
    P.ammo.lobbers--;
    Sound.play('throw');
    const up = clamp(-P.pitch / 100, -0.5, 1.2);
    G.projs.push({ x: P.x + dirX * 0.3, y: P.y + dirY * 0.3, z: 0.5, vx: dirX * 7.5, vy: dirY * 7.5, vz: 2.5 + up * 3, kind: 'lobber', owner: 'player', dmg: weaponDamage(P, w), life: 1.7, r: 0.1 });
  }
}

function playerKick() {
  const P = G.player;
  if (P.kickCd > 0 || G.state !== 'playing') return;
  P.kickCd = 2.2; P.kickAnim = 1;
  Sound.play('swing');
  const t = meleeTarget(1.4, 0.55);
  if (t) {
    const dirX = Math.cos(P.a), dirY = Math.sin(P.a);
    damageMob(t, weaponDamage(P, 'kick'), 'kick', dirX * 9, dirY * 9);
    t.stun = t.d.boss ? 0.2 : 0.9;
    Sound.play('kick');
    G.shake = Math.max(G.shake, 0.4);
  }
}

function meleeTarget(range, cone) {
  const P = G.player; let best = null, bd = 1e9;
  for (const m of G.mobs) {
    if (m.dead) continue;
    const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy) - m.d.radius;
    if (d > range) continue;
    let da = Math.atan2(dy, dx) - P.a;
    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > cone + 0.3 / Math.max(0.3, d)) continue;
    if (!G.map.los(P.x, P.y, m.x, m.y)) continue;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

function drinkPotion() {
  const P = G.player;
  if (G.state !== 'playing') return;
  if (P.potions <= 0) { systemSay('No potions left. Mordecai sells them. He is not running a charity.', 'warn'); Sound.play('deny'); return; }
  const mh = maxHp(P);
  if (P.hp >= mh) { systemSay('You are already at full health. Hydration is important, but not like this.', 'info'); return; }
  P.potions--; P.potionsUsedFloor++;
  P.hp = Math.min(mh, P.hp + mh * 0.5);
  Sound.play('potion');
  G.texts.push({ x: P.x + Math.cos(P.a), y: P.y + Math.sin(P.a), z: 0.6, text: '+HP', color: '#60ff80', life: 0.9, vz: 0.6 });
}

function switchWeapon(id) {
  const P = G.player;
  if (!P.weapons[id]) { systemSay(`You don't own the ${WEAPONS.find(w => w.id === id).name} yet.`, 'warn'); return; }
  if (P.weapon === id) return;
  P.weapon = id; P.cd = Math.max(P.cd, 0.2); P.attackAnim = 0;
  Sound.play('click');
}
function cycleWeapon(dir) {
  const P = G.player, ids = WEAPONS.map(w => w.id).filter(id => P.weapons[id]);
  const i = ids.indexOf(P.weapon);
  switchWeapon(ids[(i + dir + ids.length) % ids.length]);
}

function donutUlt() {
  const P = G.player, D = G.donut;
  if (G.state !== 'playing') return;
  if (P.donutUltCd > 0) { systemSay(`Donut's Magic Missile Barrage is recharging (${Math.ceil(P.donutUltCd)}s).`, 'info'); return; }
  const targets = G.mobs.filter(m => !m.dead && Math.hypot(m.x - D.x, m.y - D.y) < 12 && G.map.los(D.x, D.y, m.x, m.y))
    .sort((a, b) => Math.hypot(a.x - D.x, a.y - D.y) - Math.hypot(b.x - D.x, b.y - D.y));
  if (!targets.length) { systemSay('Donut refuses to waste her barrage on nothing. She has standards.', 'info'); return; }
  P.donutUltCd = 22;
  donutSay(pick(DONUT_LINES.ult));
  for (let i = 0; i < 7; i++) {
    const t = targets[i % targets.length];
    setTimeout(() => { if (!t.dead && G.state === 'playing') donutMissile(t, 1.6); }, i * 110);
  }
}

function donutMissile(t, mult = 1) {
  const D = G.donut, P = G.player;
  const ang = Math.atan2(t.y - D.y, t.x - D.x) + rand(-0.6, 0.6);
  G.projs.push({ x: D.x, y: D.y, z: 0.35, vx: Math.cos(ang) * 9, vy: Math.sin(ang) * 9, kind: 'missile', owner: 'donut', dmg: (6 + P.level * 2.4 + G.floor * 3) * mult, life: 3, r: 0.15, homing: true, target: t });
  D.castT = 0.4;
  Sound.play('missile');
}

// ================================ DONUT ====================================

function updateDonut(dt) {
  const D = G.donut, P = G.player, M = G.map;
  D.cd -= dt; D.castT -= dt; D.quipT -= dt;
  const bx = P.x - Math.cos(P.a) * 0.9 + Math.cos(P.a + Math.PI / 2) * 0.6;
  const by = P.y - Math.sin(P.a) * 0.9 + Math.sin(P.a + Math.PI / 2) * 0.6;
  const dx = bx - D.x, dy = by - D.y, d = Math.hypot(dx, dy);
  D.moving = false;
  if (Math.hypot(P.x - D.x, P.y - D.y) > 8 || !M.los(D.x, D.y, P.x, P.y) && Math.hypot(P.x - D.x, P.y - D.y) > 4) {
    // Donut takes shortcuts. Don't ask.
    if (!M.solid(bx, by)) { D.x = bx; D.y = by; } else { D.x = P.x; D.y = P.y; }
  } else if (d > 0.4) {
    const sp = Math.min(5, d * 3);
    const nx = D.x + dx / d * sp * dt, ny = D.y + dy / d * sp * dt;
    if (!M.solid(nx, D.y)) D.x = nx;
    if (!M.solid(D.x, ny)) D.y = ny;
    D.moving = true;
  }
  D.anim += dt * (D.moving ? 8 : 1);
  if (D.cd <= 0) {
    let best = null, bd = 9;
    for (const m of G.mobs) {
      if (m.dead || m.state === 'idle') continue;
      const md = Math.hypot(m.x - D.x, m.y - D.y);
      if (md < bd && M.los(D.x, D.y, m.x, m.y)) { bd = md; best = m; }
    }
    if (best) { donutMissile(best); D.cd = Math.max(1.2, 2.4 - P.level * 0.06); }
    else D.cd = 0.3;
  }
  if (D.quipT <= 0) { D.quipT = rand(45, 80); if (G.state === 'playing') donutSay(pick(DONUT_LINES.idle)); }
}

// ================================ PLAYER UPDATE ============================

function hurtPlayer(dmg, src, self) {
  const P = G.player;
  if (G.state !== 'playing' || P.god) return;
  const M = G.map;
  if (!self && M.zone[M.idx(P.x | 0, P.y | 0)] === Z_SAFE) return;
  dmg = Math.round(dmg);
  P.hp -= dmg; P.hurtT = 0.35;
  G.shake = Math.max(G.shake, 0.35);
  Sound.play('hurt');
  UI.hurt(src, dmg);
  const mh = maxHp(P);
  if (P.hp > 0 && P.hp < mh * 0.1) unlock('flesh');
  if (P.hp > 0 && P.hp < mh * 0.3 && Math.random() < 0.25) donutSay(pick(DONUT_LINES.hurt));
  if (P.hp <= 0) playerDie(pick(SYSTEM_LINES.death));
}

function playerDie(msg) {
  const P = G.player;
  P.hp = 0; P.deaths++;
  G.state = 'dead';
  Sound.play('death');
  UI.showDeath(msg);
}

function gainXp(n) {
  const P = G.player;
  P.xp += n;
  while (P.xp >= xpNeed(P.level)) {
    P.xp -= xpNeed(P.level);
    P.level++; P.points += 2;
    P.hp = Math.min(maxHp(P), P.hp + maxHp(P) * 0.5);
    Sound.play('levelup');
    systemSay(pick(SYSTEM_LINES.levelup) + ` (Level ${P.level})`, 'good');
    UI.levelUp(P.level);
    setTimeout(() => donutSay(pick(DONUT_LINES.level)), 1500);
    if (P.level >= 5) unlock('lvl5');
    if (P.level >= 10) unlock('lvl10');
  }
}

function addViewers(n) {
  const P = G.player;
  P.viewers += Math.round(n * (1 + P.stats.cha * 0.05));
  if (P.viewers >= 1000000) unlock('trending');
  const ms = Math.floor(P.viewers / 250000);
  if (ms > P.fanMilestone) {
    P.fanMilestone = ms;
    giveBox('fan');
    systemSay(`${fmt(ms * 250000)} viewers! Your fans sent you a Fan Box. It smells faintly of desperation.`, 'good');
  }
}

function giveBox(type) {
  const P = G.player;
  P.boxes.push(type);
  Sound.play('box');
  if (P.boxes.length >= 5) unlock('hoarder');
}

function unlock(id) {
  const P = G.player;
  if (!P || P.achievements[id]) return;
  const a = ACHIEVEMENTS[id];
  P.achievements[id] = true;
  Sound.play('achieve');
  addViewers(12000 * (1 + G.floor * 0.5));
  UI.achievement(a);
  if (a.box) setTimeout(() => giveBox(a.box), 400);
}

function systemSay(text, cls) { UI.log(text, cls || 'sys'); }
function donutSay(text) { UI.log(text, 'donut'); }

function puff(x, y, img, n, z = 0.4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(0.5, 2.2);
    G.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0.5, 2.5), life: rand(0.3, 0.7), img, h: 0.06, grav: true, bright: img === 'pink' || img === 'ember' || img === 'cyan' || img === 'spark' });
  }
}

function openDoor(i) {
  const M = G.map;
  if (M.doorMoving[i] || M.door[i] >= 1) return;
  M.doorMoving[i] = 1;
  const x = i % M.W, y = (i / M.W) | 0;
  if (Math.hypot(x + 0.5 - G.player.x, y + 0.5 - G.player.y) < 10) Sound.play('door');
}

function collides(x, y, r) {
  const M = G.map;
  return M.solid(x - r, y - r) || M.solid(x + r, y - r) || M.solid(x - r, y + r) || M.solid(x + r, y + r);
}

// What the player is looking at and can press E on.
function findInteract() {
  const P = G.player, M = G.map;
  const dirX = Math.cos(P.a), dirY = Math.sin(P.a);
  // doors directly ahead
  for (let d = 0.3; d <= 1.4; d += 0.1) {
    const x = P.x + dirX * d, y = P.y + dirY * d, i = M.idx(x | 0, y | 0), t = M.tiles[i];
    if ((t === T_DOOR || t === T_BOSSDOOR) && M.door[i] < 0.85) return { kind: 'door', i, label: t === T_BOSSDOOR ? 'Open the boss door (brave!)' : 'Open door' };
    if (M.solid(x, y)) break;
  }
  const near = (o, r) => {
    const dx = o.x - P.x, dy = o.y - P.y, d = Math.hypot(dx, dy);
    if (d > r) return false;
    let da = Math.atan2(dy, dx) - P.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    return Math.abs(da) < 0.9 || d < 0.6;
  };
  for (const it of G.items) if (it.kind === 'chest' && !it.open && near(it, 1.4)) return { kind: 'chest', it, label: 'Open chest' };
  if (near(M.mordecai, 1.8)) return { kind: 'mordecai', label: 'Talk to Mordecai (shop & loot boxes)' };
  if (near(M.stairs, 1.5)) return G.bossDead ? { kind: 'stairs', label: G.floor === FLOORS.length - 1 ? 'Take the final stairwell' : `Descend to Floor ${G.floor + 2}` } : { kind: 'stairsLocked', label: 'Stairwell sealed — kill the floor boss' };
  return null;
}

function interact() {
  if (G.state !== 'playing') return;
  const it = findInteract();
  if (!it) return;
  if (it.kind === 'door') openDoor(it.i);
  else if (it.kind === 'chest') openChest(it.it);
  else if (it.kind === 'mordecai') { UI.openShop(); }
  else if (it.kind === 'stairs') descend();
  else if (it.kind === 'stairsLocked') { systemSay(SYSTEM_LINES.stairsLocked, 'warn'); Sound.play('deny'); }
}

function openChest(c) {
  c.open = true;
  Sound.play('chest');
  const P = G.player;
  const drops = [];
  drops.push({ kind: 'coins', amount: randi(10, 25) * (1 + G.floor) });
  const r = Math.random();
  if (r < 0.35) drops.push({ kind: 'potion', amount: 1 });
  else if (r < 0.6) drops.push({ kind: 'lobbers', amount: 1 });
  else if (r < 0.8) drops.push({ kind: P.weapons.crossbow ? 'bolts' : 'coins', amount: P.weapons.crossbow ? randi(5, 9) : 20 });
  else drops.push({ kind: 'box', box: Math.random() < 0.7 ? 'bronze' : 'silver' });
  drops.forEach((d, k) => G.items.push({ ...d, x: c.x + Math.cos(P.a + Math.PI + k) * 0.5 * 0 + (Math.random() - 0.5) * 0.6, y: c.y + (Math.random() - 0.5) * 0.6, pop: 0.5 }));
  systemSay('Chest opened. The contents spill onto the floor, as is tradition.', 'info');
}

function pickupItems() {
  const P = G.player;
  for (const it of G.items) {
    if (it.taken || it.kind === 'chest') continue;
    if (it.pop > 0) continue;
    if (Math.hypot(it.x - P.x, it.y - P.y) > 0.6) continue;
    it.taken = true;
    switch (it.kind) {
      case 'coins': P.gold += it.amount; G.floorStats.gold += it.amount; Sound.play('coin'); floatText(`+${it.amount}g`, '#ffd040'); break;
      case 'potion': P.potions += it.amount; Sound.play('pickup'); floatText('+Potion', '#ff6070'); break;
      case 'bolts':
        if (!P.weapons.crossbow) { it.taken = false; continue; }
        P.ammo.bolts += it.amount; Sound.play('pickup'); floatText(`+${it.amount} bolts`, '#d0d0d0'); break;
      case 'lobbers': P.ammo.lobbers += it.amount; Sound.play('pickup'); floatText('+Hob-Lobber', '#a0d060'); break;
      case 'box': giveBox(it.box); floatText(BOX_TYPES[it.box].name, BOX_TYPES[it.box].color); systemSay(`You picked up a ${BOX_TYPES[it.box].name}. Open it in a Safe Room.`, 'good'); break;
    }
  }
  G.items = G.items.filter(i => !i.taken);
}

function floatText(text, color) {
  const P = G.player;
  G.texts.push({ x: P.x + Math.cos(P.a) * 1.2, y: P.y + Math.sin(P.a) * 1.2, z: 0.45, text, color, life: 1.0, vz: 0.4 });
}

function updatePlayer(dt) {
  const P = G.player, K = G.input.keys, M = G.map;
  const sens = UI.settings.sens;
  P.a += G.input.mdx * 0.0022 * sens;
  P.pitch = clamp(P.pitch - G.input.mdy * 0.35 * sens * (UI.settings.invert ? -1 : 1), -90, 90);
  G.input.mdx = 0; G.input.mdy = 0;
  if (K.ArrowLeft) P.a -= 2.4 * dt;
  if (K.ArrowRight) P.a += 2.4 * dt;

  let fwd = 0, str = 0;
  if (K.KeyW || K.ArrowUp) fwd += 1;
  if (K.KeyS || K.ArrowDown) fwd -= 1;
  if (K.KeyD) str += 1;
  if (K.KeyA) str -= 1;
  const moving = fwd || str;
  const speed = (3.1 + P.stats.dex * 0.05) * (K.ShiftLeft || K.ShiftRight ? 1.45 : 1);
  if (moving) {
    const l = Math.hypot(fwd, str);
    const dx = (Math.cos(P.a) * fwd - Math.sin(P.a) * str) / l * speed * dt;
    const dy = (Math.sin(P.a) * fwd + Math.cos(P.a) * str) / l * speed * dt;
    const r = P.radius;
    if (!collides(P.x + dx, P.y, r)) P.x += dx;
    else { const i = M.idx((P.x + dx + Math.sign(dx) * r) | 0, P.y | 0); if (M.isDoorTile(M.tiles[i])) openDoor(i); }
    if (!collides(P.x, P.y + dy, r)) P.y += dy;
    else { const i = M.idx(P.x | 0, (P.y + dy + Math.sign(dy) * r) | 0); if (M.isDoorTile(M.tiles[i])) openDoor(i); }
    P.bob += dt * speed * 2.6;
    if (Math.sin(P.bob) > 0.95 && !P._stepped) { P._stepped = true; Sound.play('step'); }
    if (Math.sin(P.bob) < 0) P._stepped = false;
  } else {
    P.bob *= Math.pow(0.001, dt);
  }
  P.bobY = Math.abs(Math.sin(P.bob)) * 2;

  P.cd -= dt; P.kickCd -= dt; P.donutUltCd -= dt; P.muzzle = Math.max(0, (P.muzzle || 0) - dt);
  P.attackAnim = Math.max(0, P.attackAnim - dt / Math.max(0.2, weaponCooldown(P, P.weapon)));
  P.kickAnim = Math.max(0, P.kickAnim - dt * 2.8);
  P.hurtT -= dt;
  if (G.input.mouseDown && (P.weapon === 'fists' || P.weapon === 'club')) playerAttack();

  // Safe room: rapid regeneration
  const mh = maxHp(P);
  if (M.zone[M.idx(P.x | 0, P.y | 0)] === Z_SAFE) {
    if (!P.inSafe) { P.inSafe = true; if (!P.safeTipShown) { P.safeTipShown = true; systemSay(SYSTEM_LINES.safeRoom, 'info'); } }
    P.hp = Math.min(mh, P.hp + mh * 0.1 * dt);
  } else P.inSafe = false;
  if (P.hp > mh) P.hp = mh;
}

function updateDoors(dt) {
  const M = G.map;
  for (let i = 0; i < M.doorMoving.length; i++) {
    if (!M.doorMoving[i]) continue;
    M.door[i] = Math.min(1, M.door[i] + dt * 1.6);
    if (M.door[i] >= 1) M.doorMoving[i] = 0;
  }
}

function updateParts(dt) {
  for (const p of G.parts) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.grav) { p.vz -= 9 * dt; if (p.z < 0.02) { p.z = 0.02; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; } }
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.life -= dt; t.z += (t.vz || 0.5) * dt; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const it of G.items) if (it.pop > 0) it.pop -= dt;
}

// ================================ MAIN UPDATE ==============================

function update(dt) {
  if (G.state !== 'playing') return;
  const P = G.player, M = G.map;
  G.time += dt;
  G.timeLeft -= dt;
  if (G.timeLeft <= 60 && !G.warned) { G.warned = true; systemSay(SYSTEM_LINES.timeWarn, 'warn'); }
  if (G.timeLeft <= 0) { G.timeLeft = 0; playerDie(SYSTEM_LINES.collapse); return; }
  G.shake = Math.max(0, G.shake - dt * 2.5);
  G.flash = Math.max(0, G.flash - dt * 2.5);

  updatePlayer(dt);
  M.updateFlow(P.x, P.y);
  updateDoors(dt);
  updateMobs(dt);
  updateDonut(dt);
  updateProjs(dt);
  updateParts(dt);
  updateMotes(dt);
  pickupItems();

  // music intensity follows the fight
  let near = 0;
  for (const m of G.mobs) if (!m.dead && m.state === 'chase' && Math.hypot(m.x - P.x, m.y - P.y) < 10) near++;
  Sound.setIntensity(Math.min(1, near / 4 + (G.bossSeen && !G.bossDead ? 0.6 : 0)));
  if (Math.random() < dt * 0.5) addViewers(near * 60 + 10);
}

// Collect everything visible into the renderer's sprite list.
// Floating dust (or embers on the Furnace floor) drifting around Carl. They
// pick up whatever light is nearby, which sells the atmosphere.
function updateMotes(dt) {
  const P = G.player, ember = FLOORS[G.floor].theme === 'furnace';
  if (!G.motes) G.motes = [];
  while (G.motes.length < 45) {
    const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 5.5;
    G.motes.push({ x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, z: Math.random(), vx: rand(-0.08, 0.08), vy: rand(-0.08, 0.08), vz: ember ? rand(0.1, 0.35) : rand(-0.04, 0.04), ph: Math.random() * 6 });
  }
  for (const m of G.motes) {
    m.ph += dt;
    m.x += (m.vx + Math.sin(m.ph * 0.7) * 0.05) * dt; m.y += (m.vy + Math.cos(m.ph * 0.6) * 0.05) * dt; m.z += m.vz * dt;
    if (m.z > 1) m.z -= 1; if (m.z < 0) m.z += 1;
    const dx = m.x - P.x, dy = m.y - P.y;
    if (dx * dx + dy * dy > 42 || G.map.solid(m.x, m.y)) { const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5; m.x = P.x + Math.cos(a) * r; m.y = P.y + Math.sin(a) * r; }
  }
}

// Moving light sources for this frame: projectiles, explosions, glowing
// monsters, Donut's spells, the open stairwell, and brazier flicker.
function gatherLights() {
  const L = [], P = G.player, t = G.time;
  for (const p of G.projs) {
    if (p.kind === 'fireball') L.push({ x: p.x, y: p.y, r: 3.2, i: 1.0, c: [1, 0.5, 0.15] });
    else if (p.kind === 'missile') L.push({ x: p.x, y: p.y, r: 2.6, i: 0.9, c: [1, 0.35, 0.9] });
    else if (p.kind === 'static') L.push({ x: p.x, y: p.y, r: 2.6, i: 0.8, c: [0.3, 0.85, 1] });
    else if (p.kind === 'bone') L.push({ x: p.x, y: p.y, r: 2, i: 0.5, c: [0.4, 1, 0.75] });
    else if (p.kind === 'lobber') L.push({ x: p.x, y: p.y, r: 1.8, i: 0.5 + Math.random() * 0.3, c: [1, 0.8, 0.4] });
  }
  for (const p of G.parts) if (p.anim === 'explosion') { const k = p.life / p.maxLife; L.push({ x: p.x, y: p.y, r: 7, i: 2.6 * k, c: [1, 0.6, 0.25] }); }
  for (const m of G.mobs) {
    if (m.dead || !m.d.bright) continue;
    L.push({ x: m.x, y: m.y, r: m.d.boss ? 5 : 3.2, i: 0.75 + Math.sin(t * 11 + m.x) * 0.1, c: m.type === 'showrunner' ? [0.35, 0.8, 1] : [1, 0.45, 0.15] });
  }
  if (G.donut && G.donut.castT > 0) L.push({ x: G.donut.x, y: G.donut.y, r: 2.5, i: G.donut.castT * 2, c: [1, 0.4, 0.9] });
  if (G.bossDead && G.map.stairs) L.push({ x: G.map.stairs.x, y: G.map.stairs.y, r: 5, i: 0.45 + Math.sin(t * 3) * 0.15, c: [0.3, 0.7, 1] });
  if (P.muzzle > 0) L.push({ x: P.x + Math.cos(P.a) * 0.6, y: P.y + Math.sin(P.a) * 0.6, r: 3, i: P.muzzle * 4, c: [1, 0.85, 0.6] });
  for (const d of G.decor) {
    if (d.kind !== 'brazier') continue;
    const dx = d.x - P.x, dy = d.y - P.y;
    if (dx * dx + dy * dy > 220) continue;
    const f = (Math.sin(t * 9 + d.ph * 7) + Math.sin(t * 14.3 + d.ph * 3)) * 0.09;
    L.push({ x: d.x, y: d.y, r: 4, i: f, c: [1, 0.7, 0.4] });
  }
  return L;
}

function gatherSprites() {
  const out = [], t = G.time;
  for (const d of G.decor) {
    switch (d.kind) {
      case 'brazier': out.push({ x: d.x, y: d.y, h: 0.7, img: SPR.brazier[d.tint || 'fire'][((t * 8 + d.ph * 3) | 0) % 3], bright: true }); break;
      case 'bones': out.push({ x: d.x, y: d.y, h: 0.16, img: SPR.bones }); break;
      case 'barrel': out.push({ x: d.x, y: d.y, h: 0.55, img: SPR.barrel }); break;
      case 'camera': out.push({ x: d.x, y: d.y, h: 0.75, img: SPR.camera }); break;
      case 'mordecai': out.push({ x: d.x, y: d.y, h: 0.85, img: SPR.mordecai }); break;
      case 'stairs': out.push({ x: d.x, y: d.y, h: 1.0, img: (G.bossDead ? SPR.stairsOpen : SPR.stairsLocked)[((t * 6) | 0) % 3], bright: G.bossDead }); break;
    }
  }
  for (const it of G.items) {
    const bob = Math.sin(t * 3 + it.x * 5) * 0.03;
    const popZ = it.pop > 0 ? Math.sin((0.5 - it.pop) / 0.5 * Math.PI) * 0.4 : 0;
    switch (it.kind) {
      case 'chest': out.push({ x: it.x, y: it.y, h: 0.42, img: it.open ? SPR.chestOpen : SPR.chest }); break;
      case 'coins': out.push({ x: it.x, y: it.y, z: popZ, h: 0.14, img: SPR.coins }); break;
      case 'potion': out.push({ x: it.x, y: it.y, z: 0.03 + bob + popZ, h: 0.26, img: SPR.potion }); break;
      case 'bolts': out.push({ x: it.x, y: it.y, z: popZ, h: 0.16, img: SPR.bolts }); break;
      case 'lobbers': out.push({ x: it.x, y: it.y, z: popZ, h: 0.26, img: SPR.lobbers }); break;
      case 'box': out.push({ x: it.x, y: it.y, z: 0.12 + bob + popZ, h: 0.34, img: SPR.box[it.box], bright: true }); break;
    }
  }
  for (const m of G.mobs) {
    const fr = SPR[m.d.sprite];
    let img;
    if (m.dead) img = fr[3];
    else if (m.atkT > 0 || m.charging > 0) img = fr[2];
    else if (m.state === 'chase') img = fr[((m.anim * (m.d.speed * 2.2)) | 0) % 2];
    else img = fr[m.d.fly ? ((m.anim * 4) | 0) % 2 : 0];
    const z = m.dead ? 0 : (m.d.z || 0) + (m.d.fly ? Math.sin(m.anim * 3) * 0.06 : 0);
    out.push({ x: m.x, y: m.y, z, h: m.dead ? m.d.h * 0.7 : m.d.h, img, flash: m.flash, bright: !m.dead && m.d.bright, mirror: m.mirror });
  }
  const D = G.donut;
  if (D) {
    const f = D.castT > 0 ? 3 : D.moving ? ((D.anim | 0) % 2) : 0;
    out.push({ x: D.x, y: D.y, h: 0.36, img: SPR.donut[f] });
  }
  for (const p of G.projs) {
    const fr = SPR[p.kind];
    out.push({ x: p.x, y: p.y, z: p.z - 0.1, h: p.kind === 'lobber' ? 0.22 : p.kind === 'bolt' ? 0.1 : 0.2, img: fr[((t * 12) | 0) % fr.length], bright: p.kind !== 'rock' && p.kind !== 'lobber' });
  }
  for (const p of G.parts) {
    if (p.anim) {
      const fr = SPR[p.anim], k = 1 - p.life / p.maxLife;
      out.push({ x: p.x, y: p.y, z: p.z - p.h * 0.35, h: p.h, img: fr[Math.min(fr.length - 1, (k * fr.length) | 0)], bright: true });
    } else out.push({ x: p.x, y: p.y, z: p.z, h: p.h, img: SPR[p.img], bright: p.bright });
  }
  if (G.motes) {
    const ember = FLOORS[G.floor].theme === 'furnace';
    for (const m of G.motes) out.push({ x: m.x, y: m.y, z: m.z, h: ember ? 0.03 : 0.012, img: ember ? SPR.ember : SPR.mote, bright: ember });
  }
  return out;
}
