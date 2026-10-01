'use strict';
// ---------------------------------------------------------------------------
// Software raycaster: textured walls with sliding doors, textured floor and
// ceiling, colored smooth lighting (per-vertex, with ambient occlusion and
// moving lights), distance fog, z-buffered billboard sprites, bloom, and a
// hand-drawn first-person weapon.
// ---------------------------------------------------------------------------

const TS = 128, TM = TS - 1;                 // texture size / mask
const QUALITY = { low: 240, medium: 300, high: 360, ultra: 450 };

const Render = {
  W: 640, H: 360, canvas: null, ctx: null, img: null, buf: null, zbuf: null,
  tex: null, wallTex: [], fog: [0, 0, 0], cam: null,
  bloom: null, bctx: null, bloomOn: true, canFilter: false,
  aoTab: null, tmp: [0, 0, 0], spanA: new Float32Array(3), spanB: new Float32Array(3),

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bloom = document.createElement('canvas');
    this.bctx = this.bloom.getContext('2d');
    this.canFilter = typeof this.bctx.filter === 'string';
    // wall shading: darker where walls meet the floor and ceiling
    this.aoTab = new Float32Array(TS);
    for (let t = 0; t < TS; t++) {
      const v = t / TS;
      const bottom = Math.max(0, (v - 0.8) / 0.2), top = Math.max(0, (0.12 - v) / 0.12);
      this.aoTab[t] = 1 - 0.5 * Math.pow(bottom, 1.6) - 0.3 * Math.pow(top, 1.6);
    }
    this.resize();
  },

  resize() {
    const s = (typeof UI !== 'undefined' && UI.settings) || {};
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.H = QUALITY[s.quality] || QUALITY.high;
    this.W = clamp(Math.round(this.H * aspect / 2) * 2, Math.round(this.H * 1.1), Math.round(this.H * 2.8));
    this.bloomOn = s.bloom !== false;
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.img = this.ctx.createImageData(this.W, this.H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(this.W);
    this.bloom.width = this.W >> 2; this.bloom.height = this.H >> 2;
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
  frame(G, sprites, dyn) {
    const P = G.player, M = G.map, W = this.W, H = this.H, buf = this.buf, zbuf = this.zbuf;
    M.prepareLight(dyn || []);
    const shakeA = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 0.03 : 0;
    const ang = P.a + shakeA;
    const dirX = Math.cos(ang), dirY = Math.sin(ang);
    const pl = W / (2 * H);
    const planeX = -dirY * pl, planeY = dirX * pl;
    const pitch = P.pitch * H / 270;
    const horizon = Math.round(H / 2 + pitch + (G.shake > 0 ? (Math.random() - 0.5) * G.shake * 4 : 0) + P.bobY * H / 270);
    const px = P.x, py = P.y;
    this.cam = { px, py, dirX, dirY, planeX, planeY, horizon };
    const [fr0, fg0, fb0] = this.fog;
    const fogPix = 0xff000000 | fb0 << 16 | fg0 << 8 | fr0;
    const flash = (G.flash || 0) * 0.5;
    const amb = FLOORS[G.floor].amb || [0.2, 0.2, 0.2];
    const ar = amb[0] + flash, ag = amb[1] + flash * 0.8, ab = amb[2] + flash * 0.6;
    const vr = M.vr, vg = M.vg, vb = M.vb, VW = M.W + 1;
    const tiles = M.tiles, zone = M.zone, MW = M.W, MH = M.H;
    const T = this.tex;
    const floorT = T.floor.data, ceilT = T.ceil.data, safeT = T.safeFloor.data;
    const fogK = 0.012;
    const halfH = 0.5 * H;

    // ---- floor + ceiling (row by row) ----
    const rdx0 = dirX - planeX, rdy0 = dirY - planeY, rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    for (let y = 0; y < H; y++) {
      const isFloor = y > horizon;
      const p = isFloor ? y - horizon : horizon - y;
      const o0 = y * W;
      if (p < 1) { buf.fill(fogPix, o0, o0 + W); continue; }
      const rowDist = halfH / p;
      const fogf = 1 / (1 + rowDist * rowDist * fogK);
      // Carl's eyes adjust: a faint warm pool of visibility around him
      const glow = Math.max(0, 0.42 - rowDist * 0.075);
      const gr = ar + glow, gg = ag + glow * 0.95, gb = ab + glow * 0.88;
      const k = fogf * 256 * (isFloor ? 1 : 0.72);
      const fr = fr0 * (1 - fogf), fg = fg0 * (1 - fogf), fb = fb0 * (1 - fogf);
      const stepX = rowDist * (rdx1 - rdx0) / W, stepY = rowDist * (rdy1 - rdy0) / W;
      let fx = px + rowDist * rdx0, fy = py + rowDist * rdy0;
      const tex = isFloor ? floorT : ceilT;
      // Light is sampled every SPAN pixels and interpolated in between.
      const SPAN = 8;
      const sample = (wx, wy, out) => {
        let cx = wx | 0, cy = wy | 0;
        if (cx < 0) cx = 0; else if (cx >= MW) cx = MW - 1;
        if (cy < 0) cy = 0; else if (cy >= MH) cy = MH - 1;
        let ux = wx - cx, uy = wy - cy;
        ux = ux < 0 ? 0 : ux > 1 ? 1 : ux; uy = uy < 0 ? 0 : uy > 1 ? 1 : uy;
        const vi = cy * VW + cx;
        let a = vr[vi], t = a + (vr[vi + 1] - a) * ux, b = vr[vi + VW];
        out[0] = t + (b + (vr[vi + VW + 1] - b) * ux - t) * uy;
        a = vg[vi]; t = a + (vg[vi + 1] - a) * ux; b = vg[vi + VW];
        out[1] = t + (b + (vg[vi + VW + 1] - b) * ux - t) * uy;
        a = vb[vi]; t = a + (vb[vi + 1] - a) * ux; b = vb[vi + VW];
        out[2] = t + (b + (vb[vi + VW + 1] - b) * ux - t) * uy;
      };
      const A = this.spanA, B = this.spanB;
      sample(fx, fy, A);
      for (let x0 = 0; x0 < W; x0 += SPAN) {
        const n = Math.min(SPAN, W - x0);
        sample(fx + stepX * n, fy + stepY * n, B);
        let mr = (gr + A[0]) * k, mg = (gg + A[1]) * k, mb = (gb + A[2]) * k;
        const dr = ((gr + B[0]) * k - mr) / n, dg = ((gg + B[1]) * k - mg) / n, db = ((gb + B[2]) * k - mb) / n;
        for (let i = 0; i < n; i++, fx += stepX, fy += stepY, mr += dr, mg += dg, mb += db) {
          const o = o0 + x0 + i;
          const cx = fx | 0, cy = fy | 0;
          if (fx < 0 || fy < 0 || cx >= MW || cy >= MH) { buf[o] = fogPix; continue; }
          const ti = (((fy - cy) * TS) & TM) * TS + (((fx - cx) * TS) & TM);
          const c = (isFloor && zone[cy * MW + cx] === Z_SAFE) ? safeT[ti] : tex[ti];
          let r = (((c & 255) * mr) >> 8) + fr;
          let g = (((c >> 8 & 255) * mg) >> 8) + fg;
          let bl = (((c >> 16 & 255) * mb) >> 8) + fb;
          buf[o] = 0xff000000 | (bl > 255 ? 255 : bl) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r);
        }
        A[0] = B[0]; A[1] = B[1]; A[2] = B[2];
      }
    }

    // ---- walls (DDA per column) ----
    const seen = M.seen, door = M.door, wallTex = this.wallTex, aoTab = this.aoTab;
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mx = px | 0, my = py | 0;
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let stepx, stepy, sdx, sdy;
      if (rdx < 0) { stepx = -1; sdx = (px - mx) * ddx; } else { stepx = 1; sdx = (mx + 1 - px) * ddx; }
      if (rdy < 0) { stepy = -1; sdy = (py - my) * ddy; } else { stepy = 1; sdy = (my + 1 - py) * ddy; }
      let side = 0, hit = 0, tile = 0, dist = 0, wallX = 0, lightX = 0;
      for (let n = 0; n < 96; n++) {
        if (sdx < sdy) { sdx += ddx; mx += stepx; side = 0; } else { sdy += ddy; my += stepy; side = 1; }
        if (mx < 0 || my < 0 || mx >= MW || my >= MH) break;
        const i = my * MW + mx;
        seen[i] = 1;
        tile = tiles[i];
        if (tile === T_EMPTY) continue;
        dist = side === 0 ? (mx - px + (1 - stepx) / 2) / rdx : (my - py + (1 - stepy) / 2) / rdy;
        wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
        wallX -= Math.floor(wallX);
        lightX = wallX;
        if (tile === T_DOOR || tile === T_BOSSDOOR) {
          const op = door[i];
          if (wallX < op) continue; // slid open past this point
          wallX -= op;
        }
        hit = 1;
        break;
      }
      if (!hit) { zbuf[x] = 1e9; continue; }
      if (dist < 0.05) dist = 0.05;
      zbuf[x] = dist;
      const tex = wallTex[tile] || T.wall;
      let tx = (wallX * TS) | 0;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TM - tx;
      // light from the two vertices bounding this wall face
      let v0, v1;
      if (side === 0) { const fxv = stepx > 0 ? mx : mx + 1; v0 = my * VW + fxv; v1 = v0 + VW; }
      else { const fyv = stepy > 0 ? my : my + 1; v0 = fyv * VW + mx; v1 = v0 + 1; }
      const lr = vr[v0] + (vr[v1] - vr[v0]) * lightX, lg = vg[v0] + (vg[v1] - vg[v0]) * lightX, lb = vb[v0] + (vb[v1] - vb[v0]) * lightX;
      const lineH = H / dist;
      const top = horizon - lineH / 2;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(horizon + lineH / 2));
      const fogf = 1 / (1 + dist * dist * fogK);
      const glow = Math.max(0, 0.42 - dist * 0.075);
      const k = fogf * 256 * (side ? 0.8 : 1);
      const mr = (ar + glow + lr * 1.3) * k, mg = (ag + glow * 0.95 + lg * 1.3) * k, mb = (ab + glow * 0.88 + lb * 1.3) * k;
      const fr = fr0 * (1 - fogf), fg = fg0 * (1 - fogf), fb = fb0 * (1 - fogf);
      const td = tex.data, texStep = TS / lineH;
      let ty = (y0 - top) * texStep;
      for (let y = y0; y < y1; y++, ty += texStep) {
        const tyi = (ty | 0) & TM;
        const c = td[tyi * TS + tx], ao = aoTab[tyi];
        let r = (((c & 255) * mr * ao) >> 8) + fr, g = (((c >> 8 & 255) * mg * ao) >> 8) + fg, b = (((c >> 16 & 255) * mb * ao) >> 8) + fb;
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
    for (const s of list) this.drawSprite(s, ar, ag, ab, fogK, M);

    this.ctx.putImageData(this.img, 0, 0);
  },

  drawSprite(s, ar, ag, ab, fogK, M) {
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
    let mr, mg, mb, fr = 0, fg = 0, fb = 0;
    if (s.bright) { mr = mg = mb = 256; }
    else {
      const L = M.lightAt(s.x, s.y, this.tmp);
      const fogf = 1 / (1 + ty * ty * fogK);
      const glow = Math.max(0, 0.42 - ty * 0.075);
      const k = fogf * 256;
      mr = (ar + glow + L[0] * 1.15) * k; mg = (ag + glow * 0.95 + L[1] * 1.15) * k; mb = (ab + glow * 0.88 + L[2] * 1.15) * k;
      fr = this.fog[0] * (1 - fogf); fg = this.fog[1] * (1 - fogf); fb = this.fog[2] * (1 - fogf);
    }
    const iw = img.w, ih = img.h, d = img.data;
    const flashW = s.flash > 0;
    const mirror = s.mirror;
    const du = iw / wpx, dv = ih / hpx;
    for (let x = x0; x < x1; x++) {
      if (ty >= zbuf[x]) continue;
      let u = ((x - left) * du) | 0;
      if (u < 0) u = 0; else if (u >= iw) u = iw - 1;
      if (mirror) u = iw - 1 - u;
      let v = (y0 - top) * dv;
      for (let y = y0; y < y1; y++, v += dv) {
        let vi = v | 0; if (vi >= ih) vi = ih - 1;
        const c = d[vi * iw + u];
        if (c === 0) continue;
        let r = (((c & 255) * mr) >> 8) + fr, g = (((c >> 8 & 255) * mg) >> 8) + fg, b = (((c >> 16 & 255) * mb) >> 8) + fb;
        if (flashW) { r = (r + 510) / 3; g = (g + 510) / 3; b = (b + 510) / 3; }
        buf[y * W + x] = 0xff000000 | (b > 255 ? 255 : b) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r);
      }
    }
  },

  // Bright pixels bleed light: threshold + blur at quarter size, add back on top.
  postProcess() {
    if (!this.bloomOn || !this.canFilter) return;
    const b = this.bctx, bw = this.bloom.width, bh = this.bloom.height, ctx = this.ctx;
    b.filter = 'brightness(0.46) contrast(5.5) saturate(1.5) blur(2px)';
    b.clearRect(0, 0, bw, bh);
    b.drawImage(this.canvas, 0, 0, bw, bh);
    b.filter = 'none';
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.42;
    ctx.drawImage(this.bloom, 0, 0, this.W, this.H);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
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
    const ctx = this.ctx, k = this.H / 270;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of texts) {
      const p = this.project(t.x, t.y, t.z);
      if (!p) continue;
      const cx = p.x | 0;
      if (cx < 0 || cx >= this.W || p.dist > this.zbuf[cx] + 0.3) continue;
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `bold ${Math.round((t.big ? 13 : 9) * k)}px monospace`;
      ctx.fillStyle = '#000'; ctx.fillText(t.text, p.x + k, p.y + k);
      ctx.fillStyle = t.color; ctx.fillText(t.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  },

  // Carl's first-person hands / weapons, drawn with shaded vector shapes and
  // tinted by the light where he stands.
  drawWeapon(P, t, M) {
    const ctx = this.ctx, W = this.W, H = this.H, k = H / 270;
    const bobX = Math.sin(P.bob) * 5 * k, bobY = Math.abs(Math.cos(P.bob)) * 4 * k;
    const a = P.attackAnim; // 1 -> 0 over the swing
    const wrapCols = [['#e8e0d0', '#a8a090'], ['#e0c070', '#9a7a30'], ['#a0a0b8', '#5a5a70'], ['#d04060', '#701830']][P.gauntlet];
    const L = M ? M.lightAt(P.x, P.y, [0, 0, 0]) : [0.5, 0.5, 0.5];
    const amb = FLOORS[G.floor].amb;
    const lum = clamp(0.45 + (L[0] + L[1] + L[2]) / 3 * 0.6 + (amb[0] + amb[1] + amb[2]) / 3, 0.5, 1.1);
    ctx.save();
    if (this.canFilter) ctx.filter = `brightness(${lum.toFixed(2)})`;
    ctx.translate(W / 2 + bobX, H + bobY);
    ctx.scale(k, k);

    const fist = (x, y, s) => {
      // jacket sleeve
      let g = ctx.createLinearGradient(x - 22 * s, 0, x + 22 * s, 0);
      g.addColorStop(0, '#1e1612'); g.addColorStop(0.45, '#4a362a'); g.addColorStop(1, '#16100c');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(x - 20 * s, y + 26); ctx.lineTo(x + 20 * s, y + 26); ctx.lineTo(x + 26 * s, y + 120); ctx.lineTo(x - 26 * s, y + 120); ctx.fill();
      ctx.fillStyle = '#2a1e18'; ctx.fillRect(x - 21 * s, y + 24, 42 * s, 6); // cuff
      // wrist
      g = ctx.createLinearGradient(x - 16 * s, 0, x + 16 * s, 0);
      g.addColorStop(0, '#9a6444'); g.addColorStop(0.5, '#d8a07a'); g.addColorStop(1, '#8a5a3c');
      ctx.fillStyle = g; ctx.fillRect(x - 15 * s, y, 30 * s, 28);
      // fist body
      g = ctx.createRadialGradient(x - 6 * s, y - 10 * s, 2, x, y, 26 * s);
      g.addColorStop(0, '#f2c29a'); g.addColorStop(0.6, '#d29a72'); g.addColorStop(1, '#8e5c3e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 23 * s, 19 * s, 0, 0, Math.PI * 2); ctx.fill();
      // hand wraps
      g = ctx.createLinearGradient(0, y - 6 * s, 0, y + 8 * s);
      g.addColorStop(0, wrapCols[0]); g.addColorStop(1, wrapCols[1]);
      ctx.fillStyle = g; ctx.fillRect(x - 21 * s, y - 4 * s, 42 * s, 11 * s);
      ctx.strokeStyle = wrapCols[1]; ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6 * s, y - 4 * s); ctx.lineTo(x + i * 6 * s + 4 * s, y + 7 * s); ctx.stroke(); }
      // knuckles
      for (let i = 0; i < 4; i++) {
        const kx = x - 13.5 * s + i * 9 * s, ky = y - 13 * s;
        g = ctx.createRadialGradient(kx - 1.5 * s, ky - 2 * s, 0.5, kx, ky, 5.5 * s);
        g.addColorStop(0, '#ffd8b4'); g.addColorStop(0.7, '#d29a72'); g.addColorStop(1, '#94603f');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kx, ky, 5 * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(70,35,20,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, 23 * s, 19 * s, 0, 0, Math.PI * 2); ctx.stroke();
    };

    const w = P.weapon;
    if (P.kickAnim > 0) { // boot enters from the bottom
      const e = Math.sin(P.kickAnim * Math.PI);
      const g = ctx.createLinearGradient(-30, 0, 50, 0);
      g.addColorStop(0, '#2a1a10'); g.addColorStop(0.5, '#6a4428'); g.addColorStop(1, '#22140a');
      ctx.fillStyle = g; ctx.fillRect(-10, 30 - e * 110, 40, 90);
      ctx.beginPath(); ctx.ellipse(10, 20 - e * 110, 40, 26, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120a06'; ctx.fillRect(-30, 36 - e * 110, 74, 9);
      ctx.fillStyle = '#c8b070'; for (let i = 0; i < 4; i++) ctx.fillRect(-4 + i * 9, 6 - e * 110, 4, 3);
    }
    if (w === 'fists') {
      const e = Math.sin(a * Math.PI);
      const lp = P.punchSide;
      fist(-70 + (lp ? e * 50 : 0), -55 - (lp ? e * 70 : 0), lp ? 1 - e * 0.35 : 1);
      fist(70 - (!lp ? e * 50 : 0), -55 - (!lp ? e * 70 : 0), !lp ? 1 - e * 0.35 : 1);
    } else if (w === 'club') {
      const e = Math.sin(a * Math.PI);
      ctx.save();
      ctx.translate(75 - e * 60, -40 - e * 30);
      ctx.rotate(-0.5 - e * 1.1);
      let g = ctx.createLinearGradient(-14, 0, 14, 0);
      g.addColorStop(0, '#3a2412'); g.addColorStop(0.4, '#8a5e36'); g.addColorStop(1, '#2e1c0e');
      ctx.fillStyle = g; ctx.fillRect(-9, -130, 18, 130);
      ctx.beginPath(); ctx.moveTo(-10, -95); ctx.lineTo(-16, -155); ctx.lineTo(16, -158); ctx.lineTo(10, -95); ctx.fill();
      ctx.strokeStyle = 'rgba(30,16,6,0.6)'; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 3, -150); ctx.lineTo(-5 + i * 3, -5); ctx.stroke(); }
      for (let i = 0; i < 6; i++) {
        for (const sx of [-1, 1]) {
          const ny = -146 + i * 9 + (sx > 0 ? 4 : 0);
          ctx.fillStyle = '#d8d8e0'; ctx.fillRect(sx < 0 ? -22 : 13, ny, 9, 2);
          ctx.fillStyle = '#707078'; ctx.fillRect(sx < 0 ? -15 : 12, ny - 1, 3, 4);
        }
      }
      ctx.fillStyle = '#5a1010'; ctx.fillRect(-8, -110, 6, 4); ctx.fillRect(2, -132, 5, 3); // old stains
      ctx.restore();
      fist(75 - e * 60, -40 - e * 30, 0.9);
    } else if (w === 'crossbow') {
      const r = a * 12;
      ctx.translate(0, r);
      let g = ctx.createLinearGradient(-14, 0, 14, 0);
      g.addColorStop(0, '#2e1c0e'); g.addColorStop(0.5, '#7a5230'); g.addColorStop(1, '#2a180a');
      ctx.fillStyle = g; ctx.fillRect(-13, -122, 26, 122);
      g = ctx.createLinearGradient(0, -140, 0, -92);
      g.addColorStop(0, '#9a9aa8'); g.addColorStop(1, '#2a2a32');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-92, -100); ctx.quadraticCurveTo(0, -142, 92, -100); ctx.lineTo(92, -92); ctx.quadraticCurveTo(0, -130, -92, -92); ctx.fill();
      ctx.fillStyle = '#6a3a1a'; ctx.fillRect(-90, -101, 6, 10); ctx.fillRect(84, -101, 6, 10);
      const loaded = P.ammo.bolts > 0 && a < 0.4;
      ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (loaded) { ctx.moveTo(-88, -97); ctx.lineTo(0, -86); ctx.lineTo(88, -97); } else { ctx.moveTo(-88, -97); ctx.lineTo(88, -97); }
      ctx.stroke();
      if (loaded) {
        ctx.fillStyle = '#9a7a52'; ctx.fillRect(-2, -152, 4, 66);
        ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.moveTo(0, -164); ctx.lineTo(-5, -150); ctx.lineTo(5, -150); ctx.fill();
        ctx.fillStyle = '#c03030'; ctx.fillRect(-4, -96, 8, 6);
      }
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(-16, -70, 32, 10);
      fist(-40, -30, 0.8); fist(40, -20, 0.8);
    } else if (w === 'lobber') {
      const e = Math.sin(a * Math.PI);
      if (!(a > 0.3 && a < 0.8) && P.ammo.lobbers > 0) {
        const jy = -95 + e * 40;
        const g = ctx.createRadialGradient(50, jy - 10, 3, 60, jy, 28);
        g.addColorStop(0, '#9aaa6a'); g.addColorStop(0.6, '#5a6a3a'); g.addColorStop(1, '#2a3418');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(60, jy, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a5a2a'; ctx.fillRect(50, jy - 40, 20, 18);
        ctx.fillStyle = '#d8c070'; ctx.fillRect(38, jy - 3, 44, 10);
        ctx.fillStyle = '#5a2a10'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('XXX', 60, jy + 5);
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, jy - 40); ctx.quadraticCurveTo(66, jy - 52, 70, jy - 55); ctx.stroke();
        const fl = (t * 14 | 0) % 2;
        ctx.fillStyle = fl ? '#fff2a0' : '#ff9a30'; ctx.beginPath(); ctx.arc(70, jy - 57, fl ? 4 : 5, 0, Math.PI * 2); ctx.fill();
      }
      fist(60, -60 + e * 40, 1);
      fist(-80, -40, 0.9);
    }
    ctx.restore();
  },
};
