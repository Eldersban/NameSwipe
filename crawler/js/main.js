'use strict';
// ---------------------------------------------------------------------------
// Boot, input handling, pointer lock, and the main loop.
// ---------------------------------------------------------------------------

const Main = {
  canvas: null, last: 0, locked: false,

  boot() {
    this.canvas = $('view');
    Render.init(this.canvas);
    buildSprites();
    UI.init();
    // A dungeon behind the title screen so the menu has something to sit on.
    G.player = newPlayer();
    G.floor = 0;
    G.map = new Dungeon(0, 12345);
    Render.setTheme(buildTheme('stone', 1000), FLOORS[0].fog);
    G.player.x = G.map.start.x; G.player.y = G.map.start.y;
    for (const d of G.map.spawns.decor) G.decor.push({ kind: d.kind, x: d.x, y: d.y, ph: Math.random() * 3 });
    G.decor.push({ kind: 'mordecai', x: G.map.mordecai.x, y: G.map.mordecai.y });
    G.donut = { x: G.player.x + 1, y: G.player.y + 0.5, cd: 0, anim: 0, castT: 0, quipT: 99, moving: false };
    UI.showTitle();
    this.bindInput();
    window.addEventListener('resize', () => Render.resize());
    requestAnimationFrame(t => this.loop(t));
  },

  lock() {
    const c = this.canvas;
    if (document.pointerLockElement === c) return;
    try {
      const r = c.requestPointerLock && c.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* pointer lock unavailable: arrow keys still turn */ }
  },

  bindInput() {
    const K = G.input.keys;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      $('click-hint').hidden = this.locked || G.state !== 'playing';
      if (!this.locked && G.state === 'playing') this.pause();
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked || G.state !== 'playing') return;
      G.input.mdx += clamp(e.movementX, -200, 200);
      G.input.mdy += clamp(e.movementY, -200, 200);
    });
    this.canvas.addEventListener('mousedown', e => {
      Sound.init();
      if (G.state !== 'playing') return;
      if (!this.locked) { this.lock(); return; }
      if (e.button === 0) { G.input.mouseDown = true; playerAttack(); }
      if (e.button === 2) playerKick();
    });
    $('click-hint').addEventListener('mousedown', () => { Sound.init(); this.lock(); });
    document.addEventListener('mouseup', e => { if (e.button === 0) G.input.mouseDown = false; });
    document.addEventListener('contextmenu', e => { if (G.state === 'playing') e.preventDefault(); });
    document.addEventListener('wheel', e => {
      if (G.state !== 'playing') return;
      cycleWeapon(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener('keydown', e => {
      Sound.init();
      const code = e.code;
      if (code === 'Tab' || (G.state === 'playing' && ['Space', 'ArrowUp', 'ArrowDown'].includes(code))) e.preventDefault();
      if (e.repeat && ['Tab', 'KeyM', 'Escape', 'KeyE', 'KeyQ'].includes(code)) return;
      K[code] = true;
      switch (G.state) {
        case 'playing':
          if (code === 'KeyE' || code === 'Space') interact();
          else if (code === 'KeyQ') drinkPotion();
          else if (code === 'KeyF') playerKick();
          else if (code === 'KeyR') donutUlt();
          else if (code >= 'Digit1' && code <= 'Digit4') switchWeapon(WEAPONS[+code.slice(5) - 1].id);
          else if (code === 'Tab' || code === 'KeyC') { G.state = 'sheet'; document.exitPointerLock(); UI.showSheet(); }
          else if (code === 'KeyM') { G.state = 'map'; document.exitPointerLock(); UI.showMap(); }
          else if (code === 'Escape' || code === 'KeyP') this.pause();
          break;
        case 'sheet':
          if (code === 'Tab' || code === 'KeyC' || code === 'Escape') this.resume();
          break;
        case 'map':
          if (code === 'KeyM' || code === 'Escape') this.resume();
          break;
        case 'shop':
          if (code === 'Escape' || code === 'KeyE') UI.closeShop();
          break;
        case 'paused':
          if (code === 'Escape' || code === 'KeyP') this.resume();
          break;
        case 'intro':
          if (code === 'Enter' || code === 'Space') this.begin();
          break;
      }
    });
    document.addEventListener('keyup', e => { K[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in K) K[k] = false; G.input.mouseDown = false; });

    // all menu buttons are delegated from the screen container
    $('screen').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      Sound.init(); Sound.play('click');
      if (b.dataset.buy) return UI.buy(b.dataset.buy);
      if (b.dataset.open) return UI.openBox(b.dataset.open);
      if (b.dataset.stat) {
        const P = G.player;
        if (P.points > 0) {
          P.points--; P.stats[b.dataset.stat]++;
          if (b.dataset.stat === 'con') P.hp += 10;
          UI.showSheet();
        }
        return;
      }
      switch (b.dataset.act) {
        case 'new': startNewGame(); break;
        case 'continue': continueGame(); break;
        case 'help': UI.showHelp('title'); break;
        case 'settings': UI.showSettings('title'); break;
        case 'title': UI.showTitle(); break;
        case 'begin': this.begin(); break;
        case 'resume': case 'close': this.resume(); break;
        case 'sheet': G.state = 'sheet'; UI.showSheet(); break;
        case 'help-pause': UI.showHelp('back-pause'); break;
        case 'settings-pause': UI.showSettings('back-pause'); break;
        case 'back-pause': UI.showPause(); break;
        case 'close-shop': UI.closeShop(); break;
        case 'quit': saveIfAlive(); UI.showTitle(); break;
        case 'retry': { const d = G.player.deaths; continueGame(); G.player.deaths = d; break; }
        case 'next-floor': enterFloor(G.floor + 1, false); break;
      }
    });
  },

  begin() {
    UI.hideScreen();
    G.state = 'playing';
    systemSay(FLOORS[G.floor].intro, 'sys');
    this.lock();
  },
  pause() {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    G.input.mouseDown = false;
    if (document.pointerLockElement) document.exitPointerLock();
    UI.showPause();
  },
  resume() {
    UI.hideScreen();
    G.state = 'playing';
    this.lock();
  },

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
    this.last = t;
    try {
      if (G.state === 'playing') update(dt);
      else if (G.state === 'title') { G.player.a += dt * 0.08; G.time += dt; }
      else if (G.state === 'intro') { G.time += dt; }
      if (G.map) {
        Render.frame(G, gatherSprites());
        Render.drawTexts(G.texts);
        if (G.state !== 'title') Render.drawWeapon(G.player, G.time);
      }
      if (G.state !== 'title') UI.updateHud();
      $('hud').hidden = G.state === 'title';
      $('click-hint').hidden = this.locked || G.state !== 'playing';
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(t2 => this.loop(t2));
  },
};

function saveIfAlive() { /* progress is saved on floor entry; nothing to do mid-floor */ }

window.addEventListener('load', () => Main.boot());
