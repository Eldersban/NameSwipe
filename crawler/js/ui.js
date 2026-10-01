'use strict';
// ---------------------------------------------------------------------------
// HUD, message feed, achievement banners, and all menu screens (title,
// floor intro, pause, character sheet, safe-room shop & loot boxes, map,
// death, floor summary, victory).
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  settings: { sens: 1, invert: false, sfx: 0.7, music: 0.35, quality: 'high', bloom: true },
  achQueue: [], achShowing: false, bossRef: null, lastPrompt: '',

  init() {
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('crawl-carl-settings') || '{}')); } catch (e) { /* defaults */ }
    Sound.setSfx(this.settings.sfx); Sound.setMusic(this.settings.music);
    this.mini = $('minimap').getContext('2d');
  },
  saveSettings() { try { localStorage.setItem('crawl-carl-settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ } },

  // ------------------------------------------------------------- HUD
  updateHud() {
    const P = G.player; if (!P) return;
    const mh = maxHp(P), F = FLOORS[G.floor];
    $('hp-fill').style.width = clamp(P.hp / mh * 100, 0, 100) + '%';
    $('hp-text').textContent = `${Math.ceil(Math.max(0, P.hp))} / ${Math.round(mh)}`;
    $('xp-fill').style.width = clamp(P.xp / xpNeed(P.level) * 100, 0, 100) + '%';
    $('lvl').textContent = P.level;
    $('points').hidden = P.points <= 0;
    $('points').textContent = `+${P.points} stat pts [TAB]`;
    $('floor-name').textContent = `Floor ${G.floor + 1} · ${F.name}`;
    const t = Math.max(0, G.timeLeft), m = Math.floor(t / 60), s = Math.floor(t % 60);
    $('timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
    $('timer').classList.toggle('urgent', t < 60);
    $('viewers').textContent = fmt(P.viewers);
    $('gold').textContent = fmt(P.gold);
    const W = WEAPONS.find(w => w.id === P.weapon);
    $('weapon-name').textContent = P.weapon === 'fists' ? GAUNTLETS[P.gauntlet].name : W.name;
    $('ammo').textContent = W.ammo ? `${P.ammo[W.ammo]} ${W.ammo === 'bolts' ? 'bolts' : 'jugs'}` : '∞';
    $('potions').textContent = P.potions;
    $('boxes').textContent = P.boxes.length;
    const slots = $('slots');
    slots.innerHTML = WEAPONS.map(w => `<span class="slot ${P.weapons[w.id] ? '' : 'locked'} ${P.weapon === w.id ? 'on' : ''}">${w.key}</span>`).join('');
    $('kick-cd').style.setProperty('--p', clamp(1 - Math.max(0, P.kickCd) / 2.2, 0, 1));
    $('ult-cd').style.setProperty('--p', clamp(1 - Math.max(0, P.donutUltCd) / 22, 0, 1));
    $('ult-cd').classList.toggle('ready', P.donutUltCd <= 0);
    $('kick-cd').classList.toggle('ready', P.kickCd <= 0);
    $('hurt').style.opacity = P.hurtT > 0 ? P.hurtT * 2 : (P.hp < mh * 0.25 ? 0.25 + Math.sin(G.time * 5) * 0.1 : 0);
    // interaction prompt
    const it = G.state === 'playing' ? findInteract() : null;
    const label = it ? `<b>E</b> ${esc(it.label)}` : '';
    if (label !== this.lastPrompt) { $('prompt').innerHTML = label; $('prompt').hidden = !label; this.lastPrompt = label; }
    const safe = G.map && G.map.zone[G.map.idx(P.x | 0, P.y | 0)] === Z_SAFE;
    $('safe-badge').hidden = !safe;
    // boss bar
    if (this.bossRef && !this.bossRef.dead) $('boss-fill').style.width = (this.bossRef.hp / this.bossRef.maxHp * 100) + '%';
    this.drawMinimap();
  },

  drawMinimap() {
    const M = G.map, P = G.player, ctx = this.mini; if (!M) return;
    const S = 132, R = 11, cell = S / (R * 2);
    ctx.fillStyle = '#0a080cdd'; ctx.fillRect(0, 0, S, S);
    const ox = P.x - R, oy = P.y - R;
    for (let y = Math.floor(oy); y < oy + R * 2 + 1; y++) for (let x = Math.floor(ox); x < ox + R * 2 + 1; x++) {
      if (!M.inside(x, y)) continue;
      const i = M.idx(x, y);
      if (!M.seen[i]) continue;
      const t = M.tiles[i];
      ctx.fillStyle = t === T_EMPTY ? (M.zone[i] === Z_SAFE ? '#2a5a34' : M.zone[i] === Z_BOSS ? '#5a2424' : '#3a3440')
        : (t === T_DOOR || t === T_BOSSDOOR) ? (M.door[i] > 0.8 ? '#6a5030' : '#c08040') : '#8a8290';
      ctx.fillRect((x - ox) * cell, (y - oy) * cell, cell + 0.5, cell + 0.5);
    }
    const dot = (x, y, c, r = 2.5) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc((x - ox) * cell, (y - oy) * cell, r, 0, 7); ctx.fill(); };
    if (M.seen[M.idx(M.stairs.x | 0, M.stairs.y | 0)]) dot(M.stairs.x, M.stairs.y, G.bossDead ? '#50d0ff' : '#ff4040', 3.5);
    dot(M.mordecai.x, M.mordecai.y, '#60ff90');
    for (const m of G.mobs) if (!m.dead && m.state === 'chase' && Math.hypot(m.x - P.x, m.y - P.y) < R) dot(m.x, m.y, m.d.boss ? '#ff2020' : '#ff7050', m.d.boss ? 3.5 : 2);
    dot(G.donut.x, G.donut.y, '#ffc0f0', 2);
    // player arrow
    ctx.save(); ctx.translate(R * cell, R * cell); ctx.rotate(P.a);
    ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.fill();
    ctx.restore();
  },

  log(text, cls) {
    const feed = $('log');
    const el = document.createElement('div');
    el.className = 'msg ' + cls;
    const who = cls === 'donut' ? 'DONUT' : cls === 'boss' ? 'BOSS' : 'SYSTEM';
    el.innerHTML = `<span class="who">${who}</span> ${esc(text)}`;
    feed.appendChild(el);
    while (feed.children.length > 4) feed.removeChild(feed.firstChild);
    setTimeout(() => el.classList.add('fade'), 7000);
    setTimeout(() => el.remove(), 8500);
  },

  achievement(a) {
    this.achQueue.push(a);
    if (!this.achShowing) this.nextAch();
  },
  nextAch() {
    const a = this.achQueue.shift();
    if (!a) { this.achShowing = false; return; }
    this.achShowing = true;
    const box = $('achv');
    box.innerHTML = `<div class="achv-kicker">New Achievement!</div><div class="achv-title">${esc(a.title)}</div><div class="achv-text">${esc(a.text)}</div>${a.box ? `<div class="achv-reward" style="color:${BOX_TYPES[a.box].color}">Reward: ${BOX_TYPES[a.box].name}</div>` : ''}`;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    setTimeout(() => { box.classList.remove('show'); setTimeout(() => this.nextAch(), 400); }, 5000);
  },

  levelUp(lvl) {
    const el = $('levelup');
    el.textContent = `LEVEL ${lvl}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  },

  hurt() { /* vignette is driven from updateHud via P.hurtT */ },

  bossIntro(m) {
    this.bossRef = m;
    $('boss-name').textContent = m.d.name;
    $('bossbar').hidden = false;
  },
  bossBar(m) { if (!m) { $('bossbar').hidden = true; this.bossRef = null; } },

  // ------------------------------------------------------------- screens
  screen(html, cls = '') {
    const s = $('screen');
    s.className = 'screen ' + cls;
    s.innerHTML = html;
    s.hidden = false;
    $('hud').classList.toggle('dim', true);
  },
  hideScreen() {
    $('screen').hidden = true;
    $('screen').innerHTML = '';
    $('hud').classList.toggle('dim', false);
  },

  showTitle() {
    G.state = 'title';
    const save = loadSave();
    this.screen(`
      <div class="title-wrap">
        <div class="title-kicker">A Dungeon Crawler Carl fan game</div>
        <h1 class="title-logo">CRAWL<span>the world dungeon</span></h1>
        <p class="title-blurb">Earth got demolished. You're in boxer shorts. Your ex-girlfriend's cat can talk now and she's a princess. Punch your way down five floors before each one collapses, while the whole galaxy watches.</p>
        <div class="menu">
          ${save ? `<button class="btn primary" data-act="continue">Continue · Floor ${save.floor + 1}</button>` : ''}
          <button class="btn ${save ? '' : 'primary'}" data-act="new">New Crawl</button>
          <button class="btn" data-act="help">How to Play</button>
          <button class="btn" data-act="settings">Settings</button>
        </div>
        <p class="pc-note">Made for PC: keyboard and mouse required.</p>
      </div>`, 'title');
  },

  showHelp(back) {
    this.screen(`
      <div class="panel help">
        <h2>How to Crawl</h2>
        <div class="help-grid">
          <div><kbd>W A S D</kbd> Move &nbsp; <kbd>Shift</kbd> Sprint</div>
          <div><kbd>Mouse</kbd> Look &nbsp; <kbd>Click</kbd> Attack</div>
          <div><kbd>Right-click</kbd> or <kbd>F</kbd> Kick (knockback + stun)</div>
          <div><kbd>R</kbd> Donut's Magic Missile Barrage</div>
          <div><kbd>1–4</kbd> / <kbd>Wheel</kbd> Switch weapon</div>
          <div><kbd>E</kbd> Open doors, chests, talk, descend</div>
          <div><kbd>Q</kbd> Drink healing potion</div>
          <div><kbd>Tab</kbd> Character sheet &amp; stats</div>
          <div><kbd>M</kbd> Dungeon map &nbsp; <kbd>Esc</kbd> Pause</div>
        </div>
        <h3>The Rules of the Show</h3>
        <ul>
          <li>Each floor has a <b>collapse timer</b>. Reach the stairwell before it hits zero.</li>
          <li>The stairwell is sealed until you kill the <b>floor boss</b> guarding it.</li>
          <li>You start every floor in a <b>Safe Room</b>. Monsters can't enter, you heal fast, and <b>Mordecai</b> sells gear and opens your loot boxes.</li>
          <li>Achievements earn <b>loot boxes</b>. Boxes only open in a Safe Room.</li>
          <li>Level up to earn stat points: <b>STR</b> melee, <b>CON</b> health, <b>DEX</b> ranged/speed/crits, <b>CHA</b> shop prices and viewers.</li>
          <li><b>Hob-Lobbers</b> explode. You are not immune. Throw them far; look up to lob them farther.</li>
          <li><b>Princess Donut</b> fights on her own. She will also comment on your choices.</li>
        </ul>
        <button class="btn primary" data-act="${back}">Back</button>
      </div>`);
  },

  showSettings(back) {
    const s = this.settings;
    this.screen(`
      <div class="panel settings">
        <h2>Settings</h2>
        <label for="set-sens">Mouse sensitivity <output id="o-sens">${s.sens.toFixed(1)}</output></label>
        <input id="set-sens" type="range" min="0.2" max="3" step="0.1" value="${s.sens}">
        <label for="set-sfx">Sound effects <output id="o-sfx">${Math.round(s.sfx * 100)}</output></label>
        <input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}">
        <label for="set-music">Music <output id="o-music">${Math.round(s.music * 100)}</output></label>
        <input id="set-music" type="range" min="0" max="1" step="0.05" value="${s.music}">
        <label for="set-quality">Graphics quality</label>
        <select id="set-quality">
          ${[['low', 'Low (fastest)'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra (sharpest)']].map(([v, l]) => `<option value="${v}" ${s.quality === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <label class="check"><input id="set-bloom" type="checkbox" ${s.bloom ? 'checked' : ''}> Glow effects (bloom)</label>
        <label class="check"><input id="set-invert" type="checkbox" ${s.invert ? 'checked' : ''}> Invert vertical look</label>
        <button class="btn primary" data-act="${back}">Back</button>
      </div>`);
    const bind = (id, key, out, f) => $(id).addEventListener('input', e => {
      s[key] = parseFloat(e.target.value); $(out).textContent = f(s[key]);
      Sound.setSfx(s.sfx); Sound.setMusic(s.music); this.saveSettings();
    });
    bind('set-sens', 'sens', 'o-sens', v => v.toFixed(1));
    bind('set-sfx', 'sfx', 'o-sfx', v => Math.round(v * 100));
    bind('set-music', 'music', 'o-music', v => Math.round(v * 100));
    $('set-invert').addEventListener('change', e => { s.invert = e.target.checked; this.saveSettings(); });
    $('set-quality').addEventListener('change', e => { s.quality = e.target.value; this.saveSettings(); Render.resize(); });
    $('set-bloom').addEventListener('change', e => { s.bloom = e.target.checked; this.saveSettings(); Render.resize(); });
  },

  showFloorIntro(f) {
    const F = FLOORS[f];
    this.screen(`
      <div class="panel intro">
        <div class="intro-floor">Floor ${f + 1} of ${FLOORS.length}</div>
        <h2 class="intro-name">${esc(F.name)}</h2>
        <p class="intro-text">${esc(F.intro)}</p>
        <div class="intro-facts">
          <div><span>Collapse timer</span><b>${Math.floor(F.time / 60)}:00</b></div>
          <div><span>Floor boss</span><b>${esc(MOBS[F.boss].name)}</b></div>
          <div><span>Residents</span><b>${[...new Set(F.pool)].map(k => MOBS[k].name).join(', ')}</b></div>
        </div>
        <button class="btn primary big" data-act="begin">Enter the Floor</button>
        <p class="hint">Click to capture the mouse. Esc to pause.</p>
      </div>`, 'intro');
  },

  showPause() {
    this.screen(`
      <div class="panel pause">
        <h2>Paused</h2>
        <p class="sub">The timer is paused too. The audience is not.</p>
        <div class="menu">
          <button class="btn primary" data-act="resume">Resume</button>
          <button class="btn" data-act="sheet">Character Sheet</button>
          <button class="btn" data-act="help-pause">How to Play</button>
          <button class="btn" data-act="settings-pause">Settings</button>
          <button class="btn danger" data-act="quit">Quit to Title</button>
        </div>
        <p class="hint">Progress saves at the start of each floor.</p>
      </div>`);
  },

  showSheet() {
    const P = G.player, mh = maxHp(P);
    const statRow = (k, label, help) => `
      <div class="stat">
        <div class="stat-name">${label}<small>${help}</small></div>
        <div class="stat-val">${P.stats[k]}</div>
        <button class="btn tiny" data-stat="${k}" ${P.points ? '' : 'disabled'} aria-label="Raise ${label}">+</button>
      </div>`;
    const ach = Object.entries(ACHIEVEMENTS).map(([id, a]) => `<li class="${P.achievements[id] ? 'got' : ''}">${P.achievements[id] ? '★' : '☆'} ${esc(a.title)}</li>`).join('');
    const weaponRows = WEAPONS.map(w => {
      const dmg = w.id === 'lobber' ? weaponDamage(P, 'lobber') : weaponDamage(P, w.id);
      return `<tr class="${P.weapons[w.id] ? '' : 'locked'}"><td>${w.key}</td><td>${esc(w.id === 'fists' ? GAUNTLETS[P.gauntlet].name : w.name)}</td><td>${P.weapons[w.id] ? Math.round(dmg) : '—'}</td><td>${P.weapons[w.id] ? (1 / weaponCooldown(P, w.id)).toFixed(1) + '/s' : 'not owned'}</td></tr>`;
    }).join('');
    this.screen(`
      <div class="panel sheet">
        <div class="sheet-head">
          <div><h2>Carl</h2><div class="sub">Human · Level ${P.level} Crawler · ${fmt(P.viewers)} viewers</div></div>
          <div class="sheet-points ${P.points ? 'has' : ''}">${P.points} unspent point${P.points === 1 ? '' : 's'}</div>
        </div>
        <div class="sheet-grid">
          <section>
            <h3>Attributes</h3>
            ${statRow('str', 'Strength', 'Fists, club, kick damage')}
            ${statRow('con', 'Constitution', '+10 max health each')}
            ${statRow('dex', 'Dexterity', 'Crossbow, lobbers, speed, crits')}
            ${statRow('cha', 'Charisma', 'Shop discounts, viewer gains')}
            <div class="derived">
              <div><span>Health</span><b>${Math.ceil(P.hp)} / ${Math.round(mh)}</b></div>
              <div><span>XP</span><b>${P.xp} / ${xpNeed(P.level)}</b></div>
              <div><span>Crit chance</span><b>${Math.round((0.05 + P.stats.dex * 0.006) * 100)}%</b></div>
              <div><span>Shop prices</span><b>${Math.round(shopDiscount(P) * 100)}%</b></div>
              <div><span>Kick damage</span><b>${Math.round(weaponDamage(P, 'kick'))}</b></div>
              <div><span>Donut's missile</span><b>${Math.round(6 + P.level * 2.4 + G.floor * 3)}</b></div>
            </div>
          </section>
          <section>
            <h3>Arsenal</h3>
            <table class="weapons"><thead><tr><th>Key</th><th>Weapon</th><th>Dmg</th><th>Speed</th></tr></thead><tbody>${weaponRows}</tbody></table>
            <h3>Inventory</h3>
            <div class="inv">
              <div><span>Gold</span><b>${fmt(P.gold)}</b></div>
              <div><span>Healing potions</span><b>${P.potions}</b></div>
              <div><span>Bolts</span><b>${P.ammo.bolts}</b></div>
              <div><span>Hob-Lobbers</span><b>${P.ammo.lobbers}</b></div>
              <div><span>Unopened boxes</span><b>${P.boxes.length}</b></div>
              <div><span>Kills</span><b>${P.kills}</b></div>
            </div>
          </section>
          <section>
            <h3>Achievements · ${Object.keys(P.achievements).length}/${Object.keys(ACHIEVEMENTS).length}</h3>
            <ul class="ach-list">${ach}</ul>
          </section>
        </div>
        <button class="btn primary" data-act="close">Close [Tab]</button>
      </div>`, 'sheet-screen');
  },

  showMap() {
    this.screen(`<div class="panel mapview"><h2>Floor ${G.floor + 1} Map</h2><canvas id="bigmap" width="560" height="560"></canvas>
      <div class="legend"><span><i style="background:#ffe070"></i>You</span><span><i style="background:#60ff90"></i>Safe room</span><span><i style="background:#ff4040"></i>Stairwell (sealed)</span><span><i style="background:#50d0ff"></i>Stairwell (open)</span><span><i style="background:#c08040"></i>Door</span></div>
      <button class="btn primary" data-act="close">Close [M]</button></div>`);
    const c = $('bigmap'), ctx = c.getContext('2d'), M = G.map, P = G.player;
    const cell = Math.floor(560 / Math.max(M.W, M.H));
    ctx.fillStyle = '#0a080c'; ctx.fillRect(0, 0, 560, 560);
    for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
      const i = M.idx(x, y); if (!M.seen[i]) continue;
      const t = M.tiles[i];
      ctx.fillStyle = t === T_EMPTY ? (M.zone[i] === Z_SAFE ? '#2a5a34' : M.zone[i] === Z_BOSS ? '#5a2424' : '#3a3440') : (t === T_DOOR || t === T_BOSSDOOR) ? '#c08040' : '#8a8290';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    const dot = (x, y, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x * cell, y * cell, r, 0, 7); ctx.fill(); };
    if (M.seen[M.idx(M.stairs.x | 0, M.stairs.y | 0)]) dot(M.stairs.x, M.stairs.y, G.bossDead ? '#50d0ff' : '#ff4040', 5);
    dot(M.mordecai.x, M.mordecai.y, '#60ff90', 4);
    ctx.save(); ctx.translate(P.x * cell, P.y * cell); ctx.rotate(P.a); ctx.fillStyle = '#ffe070';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.fill(); ctx.restore();
  },

  // --------------------------------------------------------- safe room
  shopTab: 'shop', lastOpened: null,
  openShop() {
    G.state = 'shop';
    document.exitPointerLock && document.exitPointerLock();
    this.mordecaiLine = pick(MORDECAI_LINES);
    this.lastOpened = null;
    this.renderShop();
  },
  shopPrice(item) {
    const P = G.player;
    let price = item.price;
    if (item.id === 'gauntlet') price += item.scale * P.gauntletsBought;
    if (item.id === 'tonic') price += item.scale * P.tonicsBought;
    return Math.round(price * shopDiscount(P));
  },
  renderShop() {
    const P = G.player;
    const rows = SHOP.map(item => {
      let disabled = false, note = '';
      if (item.once && P.weapons[item.once]) { disabled = true; note = 'Owned'; }
      if (item.needs && !P.weapons[item.needs]) { disabled = true; note = 'Need crossbow'; }
      if (item.id === 'gauntlet' && P.gauntlet >= GAUNTLETS.length - 1) { disabled = true; note = 'Maxed'; }
      const price = this.shopPrice(item);
      const name = item.id === 'gauntlet' && P.gauntlet < GAUNTLETS.length - 1 ? GAUNTLETS[P.gauntlet + 1].name : item.name;
      return `<div class="shop-row">
        <div class="shop-info"><div class="shop-name">${esc(name)}</div><div class="shop-desc">${esc(item.desc)}</div></div>
        <button class="btn buy" data-buy="${item.id}" ${disabled || P.gold < price ? 'disabled' : ''}>${note || price + 'g'}</button>
      </div>`;
    }).join('');
    const counts = {};
    P.boxes.forEach(b => counts[b] = (counts[b] || 0) + 1);
    const boxes = Object.keys(counts).length ? Object.entries(counts).map(([b, n]) => `
      <div class="box-row" style="--c:${BOX_TYPES[b].color}">
        <div class="box-icon"></div><div class="shop-info"><div class="shop-name">${BOX_TYPES[b].name}</div><div class="shop-desc">× ${n}</div></div>
        <button class="btn buy" data-open="${b}">Open</button>
      </div>`).join('') : '<p class="empty">No boxes. Earn achievements and kill bosses to get some.</p>';
    const opened = this.lastOpened ? `<div class="opened ${this.lastOpened.fresh ? 'fresh' : ''}" style="--c:${BOX_TYPES[this.lastOpened.type].color}"><div class="opened-title">${BOX_TYPES[this.lastOpened.type].name}</div><ul>${this.lastOpened.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '';
    this.screen(`
      <div class="panel shop">
        <div class="shop-head">
          <div class="mordecai-say"><b>Mordecai:</b> “${esc(this.mordecaiLine)}”</div>
          <div class="wallet">${fmt(P.gold)}<small>gold</small></div>
        </div>
        <div class="shop-grid">
          <section><h3>Buy</h3>${rows}</section>
          <section><h3>Loot Boxes</h3>${opened}${boxes}</section>
        </div>
        <button class="btn primary" data-act="close-shop">Back to the Dungeon [Esc]</button>
      </div>`, 'shop-screen');
  },
  buy(id) {
    const P = G.player, item = SHOP.find(s => s.id === id), price = this.shopPrice(item);
    if (P.gold < price) { Sound.play('deny'); return; }
    P.gold -= price; P.goldSpent += price;
    switch (id) {
      case 'potion': P.potions++; break;
      case 'bolts': P.ammo.bolts += 12; break;
      case 'lobbers': P.ammo.lobbers += 2; break;
      case 'gauntlet': P.gauntlet++; P.gauntletsBought++; break;
      case 'club': P.weapons.club = true; break;
      case 'crossbow': P.weapons.crossbow = true; P.ammo.bolts += 12; break;
      case 'tonic': P.points++; P.tonicsBought++; break;
    }
    Sound.play('buy');
    if (P.goldSpent >= 300) unlock('shopper');
    this.renderShop();
  },
  openBox(type) {
    const P = G.player;
    const i = P.boxes.indexOf(type); if (i < 0) return;
    P.boxes.splice(i, 1);
    const got = [], f = G.floor;
    const gold = n => { n = Math.round(n); P.gold += n; got.push(`${n} gold`); };
    const potions = n => { P.potions += n; got.push(`${n} Healing Potion${n > 1 ? 's' : ''}`); };
    const lobbers = n => { P.ammo.lobbers += n; got.push(`${n} Hob-Lobber${n > 1 ? 's' : ''}`); };
    const bolts = n => { if (P.weapons.crossbow) { P.ammo.bolts += n; got.push(`${n} crossbow bolts`); } else gold(n * 2); };
    const gauntlet = () => { if (P.gauntlet < GAUNTLETS.length - 1) { P.gauntlet++; got.push(`${GAUNTLETS[P.gauntlet].name} (fist damage ×${GAUNTLETS[P.gauntlet].mult})`); return true; } return false; };
    const point = n => { P.points += n; got.push(`${n} stat point${n > 1 ? 's' : ''}`); };
    switch (type) {
      case 'bronze': {
        const r = Math.random();
        if (r < 0.35) gold(rand(20, 45) * (1 + f * 0.5)); else if (r < 0.6) potions(2); else if (r < 0.8) lobbers(2); else bolts(12);
        break;
      }
      case 'silver':
        gold(rand(50, 100) * (1 + f * 0.5));
        if (!P.weapons.crossbow) { P.weapons.crossbow = true; P.ammo.bolts += 15; got.push('Rusty Crossbow (+15 bolts) — press 3'); }
        else if (!P.weapons.club) { P.weapons.club = true; got.push('Nail-Studded Club — press 2'); }
        else pick([() => potions(3), () => lobbers(3), () => bolts(20)])();
        break;
      case 'gold':
        point(1); gold(rand(100, 180) * (1 + f * 0.5));
        if (!gauntlet()) { potions(2); lobbers(3); }
        break;
      case 'boss':
        point(2); gold(150 * (f + 1)); potions(2); lobbers(3);
        if (!P.weapons.club) { P.weapons.club = true; got.push('Nail-Studded Club — press 2'); } else gauntlet() || bolts(15);
        break;
      case 'fan': {
        const r = Math.random();
        if (r < 0.3) { P.stats.cha++; got.push('A single worn sock (+1 Charisma). The fans are weird.'); }
        else if (r < 0.55) { gold(120 * (1 + f * 0.5)); got.push('...from selling a signed photo of your feet'); }
        else if (r < 0.8) { potions(3); got.push('(fan-made, probably fine)'); }
        else { lobbers(4); got.push('A Hob-Lobber care package with a heartfelt note'); }
        break;
      }
    }
    this.lastOpened = { type, items: got, fresh: true };
    Sound.play('box');
    this.renderShop();
    this.lastOpened.fresh = false;
  },
  closeShop() {
    this.hideScreen();
    G.state = 'playing';
    Main.lock();
  },

  // ---------------------------------------------------------- end states
  showDeath(msg) {
    document.exitPointerLock && document.exitPointerLock();
    const P = G.player;
    this.screen(`
      <div class="panel death">
        <div class="death-kicker">Crawler Down</div>
        <h2>You Died</h2>
        <p class="death-msg">${esc(msg)}</p>
        <div class="intro-facts">
          <div><span>Floor</span><b>${G.floor + 1}</b></div>
          <div><span>Level</span><b>${P.level}</b></div>
          <div><span>Kills</span><b>${P.kills}</b></div>
          <div><span>Viewers</span><b>${fmt(P.viewers)}</b></div>
        </div>
        <div class="menu">
          <button class="btn primary" data-act="retry">Retry Floor ${G.floor + 1}</button>
          <button class="btn" data-act="quit">Quit to Title</button>
        </div>
        <p class="hint">Retrying restarts this floor with the gear you had when you entered it.</p>
      </div>`, 'death-screen');
  },

  showFloorSummary(s) {
    document.exitPointerLock && document.exitPointerLock();
    const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
    this.screen(`
      <div class="panel intro">
        <div class="intro-floor">Floor ${s.floor + 1} Cleared</div>
        <h2 class="intro-name">You Survived. For Now.</h2>
        <p class="intro-text">The stairwell hums. Floor ${s.floor + 1} collapses behind you with everyone still on it. The ratings are excellent.</p>
        <div class="intro-facts">
          <div><span>Time</span><b>${m}:${String(sec).padStart(2, '0')}</b></div>
          <div><span>Kills</span><b>${s.kills}</b></div>
          <div><span>Gold found</span><b>${fmt(s.gold)}</b></div>
          <div><span>New viewers</span><b>+${fmt(s.viewers)}</b></div>
        </div>
        <button class="btn primary big" data-act="next-floor">Descend to Floor ${s.floor + 2}</button>
      </div>`, 'intro');
  },

  showVictory() {
    document.exitPointerLock && document.exitPointerLock();
    const P = G.player;
    const m = Math.floor(P.totalTime / 60);
    this.screen(`
      <div class="panel victory">
        <div class="intro-floor">Season Finale</div>
        <h2 class="intro-name">The Showrunner Is Cancelled</h2>
        <p class="intro-text">You punched your way through five floors in your underwear, and the galaxy loved every second. Donut has already signed three sponsorship deals. The dungeon goes deeper, but that's next season.</p>
        <div class="intro-facts">
          <div><span>Final level</span><b>${P.level}</b></div>
          <div><span>Total kills</span><b>${P.kills}</b></div>
          <div><span>Viewers</span><b>${fmt(P.viewers)}</b></div>
          <div><span>Time in dungeon</span><b>${m} min</b></div>
          <div><span>Achievements</span><b>${Object.keys(P.achievements).length}/${Object.keys(ACHIEVEMENTS).length}</b></div>
          <div><span>Deaths</span><b>${P.deaths}</b></div>
        </div>
        <button class="btn primary big" data-act="quit">Back to Title</button>
      </div>`, 'victory-screen');
  },
};
