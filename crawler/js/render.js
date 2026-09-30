'use strict';
// ---------------------------------------------------------------------------
// Software raycaster: textured walls with sliding doors, textured floor and
// ceiling, per-cell lightmap, distance fog, z-buffered billboard sprites and
// a hand-drawn first-person weapon.
// ---------------------------------------------------------------------------

const Render = {
  W: 480, H: 270, canvas: null, ctx: null, img: null, buf: null, zbuf: null,
  tex: null, wallTex: [], fog: [0, 0, 0],
  cam: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resize();
  },

  resize() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.H = 270;
    this.W = clamp(Math.round(this.H * aspect / 2) * 2, 300, 760);
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.img = this.ctx.createImageData(this.W, this.H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(this.W);
    this.ctx.imageSmoothingEnabled = false;
  },

  setTheme(tex, fog) {
    this.tex = tex;
    this.fog = fog;
    const w = [];
    w[T_WALL] = tex.wall; w[T_WALL2] = tex.wall2; w[T_SAFE] = tex.safeWall; w[T_BOSS] = tex.bossWall;
    w[T_DOOR] = tex.door; w[T_BOSSDOOR] = tex.bossDoor;
    this.wallTex = w;
  },

  // ---------------------------------------------------------------- scene
  frame(G, sprites) {
    const P = G.player, M = G.map, W = this.W, H = this.H, buf = this.buf, zbuf = this.zbuf;
    const shakeA = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 0.03 : 0;
    const ang = P.a + shakeA;
    const dirX = Math.cos(ang), dirY = Math.sin(ang);
    const pl = W / (2 * H);
    const planeX = -dirY * pl, planeY = dirX * pl;
    const horizon = Math.round(H / 2 + P.pitch + (G.shake > 0 ? (Math.random() - 0.5) * G.shake * 4 : 0) + P.bobY);
    const px = P.x, py = P.y;
    this.cam = { px, py, dirX, dirY, planeX, planeY, horizon };
    const [fr0, fg0, fb0] = this.fog;
    const flash = G.flash || 0;
    const amb = 0.34 * (FLOORS[G.floor].ambient || 1);
    const light = M.light, tiles = M.tiles, zone = M.zone, MW = M.W, MH = M.H;
    const T = this.tex;
    const floorT = T.floor.data, ceilT = T.ceil.data, safeT = T.safeFloor.data;
    const fogK = 0.014;

    // ---- floor + ceiling (row by row) ----
    const rdx0 = dirX - planeX, rdy0 = dirY - planeY, rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    for (let y = 0; y < H; y++) {
      const isFloor = y > horizon;
      const p = isFloor ? y - horizon : horizon - y;
      const o0 = y * W;
      if (p < 1) { const c = 0xff000000 | fb0 << 16 | fg0 << 8 | fr0; buf.fill(c, o0, o0 + W); continue; }
      const rowDist = (0.5 * H) / p;
      const fogf = 1 / (1 + rowDist * rowDist * fogK);
      const glow = Math.max(0, 0.55 - rowDist * 0.09);
      const fr = fr0 * (1 - fogf), fg = fg0 * (1 - fogf), fb = fb0 * (1 - fogf);
      const stepX = rowDist * (rdx1 - rdx0) / W, stepY = rowDist * (rdy1 - rdy0) / W;
      let fx = px + rowDist * rdx0, fy = py + rowDist * rdy0;
      const dimC = isFloor ? 1 : 0.8;
      for (let x = 0; x < W; x++, fx += stepX, fy += stepY) {
        const cx = fx | 0, cy = fy | 0;
        const o = o0 + x;
        if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) { buf[o] = 0xff000000 | fb0 << 16 | fg0 << 8 | fr0; continue; }
        const ci = cy * MW + cx;
        const tx = ((fx - cx) * 64) & 63, ty = ((fy - cy) * 64) & 63;
        const c = isFloor ? (zone[ci] === Z_SAFE ? safeT : floorT)[ty * 64 + tx] : ceilT[ty * 64 + tx];
        let s = (amb + light[ci] + glow + flash) * fogf * dimC;
        if (s > 1.3) s = 1.3;
        const si = (s * 256) | 0;
        let r = (((c & 255) * si) >> 8) + fr, g = (((c >> 8 & 255) * si) >> 8) + fg, b = (((c >> 16 & 255) * si) >> 8) + fb;
        buf[o] = 0xff000000 | (b > 255 ? 255 : b) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r);
      }
    }

    // ---- walls (DDA per column) ----
    const seen = M.seen, door = M.door, wallTex = this.wallTex;
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mx = px | 0, my = py | 0;
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let stepx, stepy, sdx, sdy;
      if (rdx < 0) { stepx = -1; sdx = (px - mx) * ddx; } else { stepx = 1; sdx = (mx + 1 - px) * ddx; }
      if (rdy < 0) { stepy = -1; sdy = (py - my) * ddy; } else { stepy = 1; sdy = (my + 1 - py) * ddy; }
      let side = 0, hit = 0, tile = 0, dist = 0, wallX = 0, prevI = my * MW + mx, lastEmpty = prevI;
      for (let n = 0; n < 80; n++) {
        if (sdx < sdy) { sdx += ddx; mx += stepx; side = 0; } else { sdy += ddy; my += stepy; side = 1; }
        if (mx < 0 || my < 0 || mx >= MW || my >= MH) break;
        const i = my * MW + mx;
        seen[i] = 1;
        tile = tiles[i];
        if (tile === T_EMPTY) { lastEmpty = i; continue; }
        dist = side === 0 ? (mx - px + (1 - stepx) / 2) / rdx : (my - py + (1 - stepy) / 2) / rdy;
        wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
        wallX -= Math.floor(wallX);
        if (tile === T_DOOR || tile === T_BOSSDOOR) {
          const op = door[i];
          if (wallX < op) { lastEmpty = i; continue; } // slid open past this point
          wallX -= op;
        }
        hit = 1; prevI = i;
        break;
      }
      if (!hit) { zbuf[x] = 1e9; continue; }
      if (dist < 0.05) dist = 0.05;
      zbuf[x] = dist;
      const tex = wallTex[tile] || T.wall;
      let tx = (wallX * 64) | 0;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = 63 - tx;
      const lineH = H / dist;
      const top = horizon - lineH / 2;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(horizon + lineH / 2));
      const fogf = 1 / (1 + dist * dist * fogK);
      const glow = Math.max(0, 0.55 - dist * 0.09);
      let s = (amb + light[lastEmpty] + glow + flash) * fogf * (side ? 0.78 : 1);
      if (s > 1.3) s = 1.3;
      const si = (s * 256) | 0;
      const fr = fr0 * (1 - fogf), fg = fg0 * (1 - fogf), fb = fb0 * (1 - fogf);
      const td = tex.data, texStep = 64 / lineH;
      let ty = (y0 - top) * texStep;
      for (let y = y0; y < y1; y++, ty += texStep) {
        const c = td[((ty | 0) & 63) * 64 + tx];
        let r = (((c & 255) * si) >> 8) + fr, g = (((c >> 8 & 255) * si) >> 8) + fg, b = (((c >> 16 & 255) * si) >> 8) + fb;
        buf[y * W + x] = 0xff000000 | (b > 255 ? 255 : b) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r);
      }
    }

    // ---- sprites ----
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const list = [];
    for (const s of sprites) {
      const dx = s.x - px, dy = s.y - py;
      const ty = invDet * (-planeY * dx + planeX * dy);
      if (ty < 0.12) continue;
      const tx = invDet * (dirY * dx - dirX * dy);
      s._tx = tx; s._ty = ty;
      list.push(s);
    }
    list.sort((a, b) => b._ty - a._ty);
    for (const s of list) this.drawSprite(s, amb, flash, fogK, light, MW, MH);

    this.ctx.putImageData(this.img, 0, 0);
  },

  drawSprite(s, amb, flash, fogK, light, MW, MH) {
    const W = this.W, H = this.H, buf = this.buf, zbuf = this.zbuf, cam = this.cam;
    const img = s.img; if (!img) return;
    const ty = s._ty, scale = H / ty;
    const hpx = s.h * scale, wpx = hpx * img.w / img.h;
    const sx = (W / 2) * (1 + s._tx / ty);
    const bottom = cam.horizon + (0.5 - (s.z || 0)) * scale;
    const top = bottom - hpx;
    const left = sx - wpx / 2;
    const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(W, Math.ceil(left + wpx));
    const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(bottom));
    if (x0 >= x1 || y0 >= y1) return;
    let si, fr = 0, fg = 0, fb = 0;
    if (s.bright) si = 256;
    else {
      const cx = s.x | 0, cy = s.y | 0;
      const L = (cx >= 0 && cy >= 0 && cx < MW && cy < MH) ? light[cy * MW + cx] : 0;
      const fogf = 1 / (1 + ty * ty * fogK);
      const glow = Math.max(0, 0.55 - ty * 0.09);
      let v = (amb + L + glow + flash) * fogf;
      if (v > 1.3) v = 1.3;
      si = (v * 256) | 0;
      fr = this.fog[0] * (1 - fogf); fg = this.fog[1] * (1 - fogf); fb = this.fog[2] * (1 - fogf);
    }
    const iw = img.w, ih = img.h, d = img.data;
    const flashW = s.flash > 0;
    const mirror = s.mirror;
    for (let x = x0; x < x1; x++) {
      if (ty >= zbuf[x]) continue;
      let u = (((x - left) / wpx) * iw) | 0;
      if (u < 0) u = 0; else if (u >= iw) u = iw - 1;
      if (mirror) u = iw - 1 - u;
      for (let y = y0; y < y1; y++) {
        let v = (((y - top) / hpx) * ih) | 0;
        if (v >= ih) v = ih - 1;
        const c = d[v * iw + u];
        if (c === 0) continue;
        let r = (((c & 255) * si) >> 8) + fr, g = (((c >> 8 & 255) * si) >> 8) + fg, b = (((c >> 16 & 255) * si) >> 8) + fb;
        if (flashW) { r = (r + 510) / 3; g = (g + 510) / 3; b = (b + 510) / 3; }
        buf[y * W + x] = 0xff000000 | (b > 255 ? 255 : b) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r);
      }
    }
  },

  // world -> screen, for floating text
  project(x, y, z) {
    const c = this.cam; if (!c) return null;
    const invDet = 1 / (c.planeX * c.dirY - c.dirX * c.planeY);
    const dx = x - c.px, dy = y - c.py;
    const ty = invDet * (-c.planeY * dx + c.planeX * dy);
    if (ty < 0.2) return null;
    const tx = invDet * (c.dirY * dx - c.dirX * dy);
    const scale = this.H / ty;
    return { x: (this.W / 2) * (1 + tx / ty), y: c.horizon + (0.5 - z) * scale, scale, dist: ty };
  },

  // ------------------------------------------------------- overlays
  drawTexts(texts) {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of texts) {
      const p = this.project(t.x, t.y, t.z);
      if (!p) continue;
      const cx = p.x | 0;
      if (cx < 0 || cx >= this.W || p.dist > this.zbuf[cx] + 0.3) continue;
      const a = Math.min(1, t.life * 2);
      ctx.globalAlpha = a;
      ctx.font = `bold ${t.big ? 12 : 9}px monospace`;
      ctx.fillStyle = '#000'; ctx.fillText(t.text, p.x + 1, p.y + 1);
      ctx.fillStyle = t.color; ctx.fillText(t.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  },

  // Carl's first-person hands / weapons, drawn with vector shapes.
  drawWeapon(P, t) {
    const ctx = this.ctx, W = this.W, H = this.H, k = H / 270;
    const bobX = Math.sin(P.bob) * 5 * k, bobY = Math.abs(Math.cos(P.bob)) * 4 * k;
    const a = P.attackAnim; // 1 -> 0 over the swing
    const skin = '#d8a27a', skinD = '#b07a54', wrap = ['#d8d0c0', '#c8a860', '#8a8aa0', '#b03050'][P.gauntlet];
    ctx.save();
    ctx.translate(W / 2 + bobX, H + bobY);
    ctx.scale(k, k);
    const fist = (x, y, s, lit) => {
      ctx.fillStyle = skinD; ctx.fillRect(x - 16 * s, y, 32 * s, 60);
      ctx.fillStyle = '#3a2a22'; ctx.fillRect(x - 18 * s, y + 30, 36 * s, 40); // leather jacket sleeve
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = wrap; ctx.fillRect(x - 20 * s, y - 4 * s, 40 * s, 10 * s);
      ctx.fillStyle = skinD;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 13 * s + i * 9 * s, y - 12 * s, 5 * s, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = skin;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 13 * s + i * 9 * s, y - 13 * s, 4.2 * s, 0, Math.PI * 2); ctx.fill(); }
      if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x, y - 20 * s, 10 * s, 0, Math.PI * 2); ctx.fill(); }
    };
    const w = P.weapon;
    if (P.kickAnim > 0) { // boot enters from the bottom
      const e = Math.sin(P.kickAnim * Math.PI);
      ctx.fillStyle = '#3a2618';
      ctx.beginPath(); ctx.ellipse(10, 20 - e * 110, 40, 26, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(-10, 30 - e * 110, 40, 90);
      ctx.fillStyle = '#1a1008'; ctx.fillRect(-28, 30 - e * 110, 70, 8);
    }
    if (w === 'fists') {
      const e = Math.sin(a * Math.PI);
      const leftPunch = P.punchSide;
      fist(-70 + (leftPunch ? e * 50 : 0), -55 - (leftPunch ? e * 70 : 0), leftPunch ? 1 - e * 0.35 : 1, false);
      fist(70 - (!leftPunch ? e * 50 : 0), -55 - (!leftPunch ? e * 70 : 0), !leftPunch ? 1 - e * 0.35 : 1, false);
    } else if (w === 'club') {
      const e = Math.sin(a * Math.PI);
      ctx.save();
      ctx.translate(75 - e * 60, -40 - e * 30);
      ctx.rotate(-0.5 - e * 1.1);
      ctx.fillStyle = '#6a4424'; ctx.fillRect(-9, -130, 18, 130);
      ctx.fillStyle = '#7a5430'; ctx.fillRect(-14, -150, 28, 60);
      ctx.fillStyle = '#bbb';
      for (let i = 0; i < 6; i++) { ctx.fillRect(-20, -145 + i * 9, 7, 2); ctx.fillRect(13, -141 + i * 9, 7, 2); }
      ctx.restore();
      fist(75 - e * 60, -40 - e * 30, 0.9, false);
    } else if (w === 'crossbow') {
      const r = a * 12;
      ctx.translate(0, r);
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-12, -120, 24, 120);
      ctx.fillStyle = '#4a4a52'; ctx.beginPath(); ctx.moveTo(-90, -100); ctx.quadraticCurveTo(0, -140, 90, -100); ctx.lineTo(90, -94); ctx.quadraticCurveTo(0, -130, -90, -94); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (P.ammo.bolts > 0 && a < 0.4) { ctx.moveTo(-88, -97); ctx.lineTo(0, -88); ctx.lineTo(88, -97); } else { ctx.moveTo(-88, -97); ctx.lineTo(88, -97); }
      ctx.stroke();
      if (P.ammo.bolts > 0 && a < 0.4) { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(-2, -150, 4, 64); ctx.fillStyle = '#ccc'; ctx.fillRect(-3, -156, 6, 8); }
      fist(-40, -30, 0.8, false); fist(40, -20, 0.8, false);
    } else if (w === 'lobber') {
      const e = Math.sin(a * Math.PI);
      if (!(a > 0.3 && a < 0.8) && P.ammo.lobbers > 0) {
        ctx.fillStyle = '#5a6a3a'; ctx.beginPath(); ctx.arc(60, -95 + e * 40, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6a7a4a'; ctx.fillRect(50, -135 + e * 40, 20, 18);
        ctx.fillStyle = '#c8b060'; ctx.fillRect(38, -98 + e * 40, 44, 10);
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, -135 + e * 40); ctx.lineTo(70, -150 + e * 40); ctx.stroke();
        if ((t * 10 | 0) % 2) { ctx.fillStyle = '#ffe060'; ctx.beginPath(); ctx.arc(70, -152 + e * 40, 4, 0, Math.PI * 2); ctx.fill(); }
      }
      fist(60, -60 + e * 40, 1, false);
      fist(-80, -40, 0.9, false);
    }
    ctx.restore();
  },
};
