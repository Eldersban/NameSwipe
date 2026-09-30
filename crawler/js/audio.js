'use strict';
// ---------------------------------------------------------------------------
// Synthesized sound effects and a small generative soundtrack (WebAudio).
// ---------------------------------------------------------------------------

const Sound = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let musicOn = true, sfxVol = 0.7, musicVol = 0.35;
  let musicTimer = null, step = 0, nextTime = 0, theme = 0, intensity = 0;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicVol; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  function tone(type, f0, f1, dur, vol, bus, delay = 0) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterType, f0, f1, delay = 0, q = 1) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain(); env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const fx = {
    swing() { noise(0.12, 0.25, 'bandpass', 900, 2500, 0, 2); },
    punch() { noise(0.09, 0.8, 'lowpass', 1400, 200); tone('sine', 160, 60, 0.12, 0.6); },
    club() { noise(0.14, 0.9, 'lowpass', 900, 120); tone('triangle', 110, 45, 0.18, 0.7); },
    kick() { noise(0.12, 0.9, 'lowpass', 700, 90); tone('sine', 120, 40, 0.2, 0.8); },
    crossbow() { tone('square', 700, 180, 0.08, 0.15); noise(0.1, 0.3, 'highpass', 3000, 1500); },
    throw() { noise(0.2, 0.3, 'bandpass', 500, 1400, 0, 3); },
    bounce() { tone('triangle', 300, 200, 0.06, 0.2); },
    explode() {
      noise(1.1, 1.0, 'lowpass', 2200, 60);
      tone('sine', 90, 30, 0.8, 0.9);
      noise(0.4, 0.5, 'highpass', 4000, 800, 0.02);
    },
    hit() { tone('square', 220, 90, 0.08, 0.15); noise(0.06, 0.3, 'bandpass', 1200, 500, 0, 2); },
    mobDie() { tone('sawtooth', 300, 60, 0.35, 0.18); noise(0.25, 0.25, 'lowpass', 1200, 200); },
    squeak() { tone('square', 1800, 2600, 0.08, 0.06); tone('square', 2400, 1600, 0.06, 0.05, null, 0.08); },
    hurt() { tone('sawtooth', 140, 70, 0.25, 0.3); noise(0.15, 0.4, 'lowpass', 900, 200); },
    pickup() { tone('square', 880, 880, 0.05, 0.1); tone('square', 1320, 1320, 0.08, 0.1, null, 0.05); },
    coin() { tone('square', 1320, 1320, 0.04, 0.08); tone('square', 1760, 1760, 0.12, 0.08, null, 0.04); },
    potion() { for (let i = 0; i < 4; i++) tone('sine', 400 + i * 120, 500 + i * 120, 0.08, 0.2, null, i * 0.06); },
    levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, 0.14, 0.12, null, i * 0.08)); },
    achieve() {
      [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.2, 0.25, null, i * 0.1));
      tone('square', 1047, 1047, 0.5, 0.12, null, 0.4);
    },
    door() { noise(0.6, 0.35, 'lowpass', 300, 900, 0, 4); tone('sawtooth', 70, 90, 0.5, 0.08); },
    missile() { tone('sine', 1200, 400, 0.25, 0.18); tone('triangle', 1800, 900, 0.2, 0.08); },
    enemyShot() { tone('square', 500, 250, 0.12, 0.1); },
    fireball() { noise(0.35, 0.35, 'bandpass', 400, 1200, 0, 1.5); },
    roar() { tone('sawtooth', 90, 45, 1.2, 0.45); noise(1.0, 0.5, 'lowpass', 600, 100); },
    box() { [659, 784, 988, 1319].forEach((f, i) => tone('square', f, f, 0.1, 0.12, null, i * 0.07)); noise(0.3, 0.2, 'highpass', 5000, 2000, 0.3); },
    buy() { tone('square', 988, 988, 0.05, 0.1); tone('square', 1319, 1319, 0.12, 0.1, null, 0.06); },
    deny() { tone('square', 200, 150, 0.2, 0.15); },
    chest() { noise(0.3, 0.3, 'lowpass', 400, 1200); this.coin(); },
    descend() { [784, 659, 523, 392, 262].forEach((f, i) => tone('triangle', f, f, 0.25, 0.25, null, i * 0.12)); },
    death() { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.95, 0.4, 0.2, null, i * 0.3)); },
    teleport() { tone('sine', 200, 1600, 0.4, 0.25); },
    click() { tone('square', 600, 600, 0.03, 0.08); },
    step() { noise(0.05, 0.05, 'lowpass', 500, 200); },
  };

  function play(name) {
    if (!ac || !fx[name]) return;
    try { fx[name](); } catch (e) { /* audio is best-effort */ }
  }

  // --- generative soundtrack: bass drone + minor arpeggio per floor theme ---
  const SCALES = [
    [0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 1, 5, 7, 8], [0, 3, 6, 7, 10], [0, 3, 5, 6, 7, 10],
  ];
  const ROOTS = [45, 43, 41, 40, 44];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function startMusic() {
    if (musicTimer) return;
    nextTime = ac.currentTime + 0.1;
    musicTimer = setInterval(schedule, 50);
  }

  function schedule() {
    if (!ac) return;
    const bpm = 96 + intensity * 30;
    const stepDur = 60 / bpm / 2;
    while (nextTime < ac.currentTime + 0.2) {
      if (musicOn) playStep(step, nextTime, stepDur);
      step++;
      nextTime += stepDur;
    }
  }

  function note(type, freq, t, dur, vol, cutoff) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function playStep(s, t, d) {
    const sc = SCALES[theme % SCALES.length], root = ROOTS[theme % ROOTS.length];
    const bar = Math.floor(s / 16) % 4;
    const shift = [0, 0, 5, 3][bar];
    if (s % 8 === 0) note('sawtooth', midi(root - 12 + shift), t, d * 7, 0.22, 300);
    if (s % 4 === 2 && intensity > 0.3) note('square', midi(root + shift), t, d * 0.9, 0.05, 900);
    const pat = [0, 2, 1, 3, 2, 4, 3, 1];
    if (s % 2 === 0 || intensity > 0.5) {
      const deg = pat[(s >> (intensity > 0.5 ? 0 : 1)) % pat.length];
      const n = root + 12 + shift + sc[deg % sc.length] + (deg >= sc.length ? 12 : 0);
      note('triangle', midi(n), t, d * 1.6, 0.06 + intensity * 0.04, 2000);
    }
    // percussion
    if (s % 8 === 0 || (intensity > 0.5 && s % 8 === 5)) kickDrum(t);
    if (s % 8 === 4) hat(t, 0.08);
    if (intensity > 0.3 && s % 2 === 1) hat(t, 0.03);
  }

  function kickDrum(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25);
  }

  function hat(t, v) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.06);
  }

  return {
    init, play,
    setTheme(i) { theme = i; },
    setIntensity(v) { intensity += (v - intensity) * 0.05; },
    toggleMusic() { musicOn = !musicOn; return musicOn; },
    get musicOn() { return musicOn; },
    setSfx(v) { sfxVol = v; if (sfxBus) sfxBus.gain.value = v; },
    setMusic(v) { musicVol = v; if (musicBus) musicBus.gain.value = v; },
    get sfxVol() { return sfxVol; },
    get musicVol() { return musicVol; },
  };
})();
