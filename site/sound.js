/* Som do workspace: ambiente leve que evolui sem repetir + sons de interface sutis. Tudo sintetizado (Web Audio), sem arquivos.
   Liga no clique de entrar (ou no primeiro clique de quem já entrou antes). Botão liga/desliga; a escolha fica salva. */
(function () {
  const KEY = 'ws-sound';
  const pref = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) {} };
  const AC = window.AudioContext || window.webkitAudioContext;
  const btn = document.getElementById('sound-btn');
  if (!AC) { if (btn) btn.hidden = true; return; }

  let ctx = null, master = null, amb = null, fx = null, verb = null, on = false, timers = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Escala suspensa, sem tônica marcada: soa espacial e não cansa
  const SCALE = [0, 2, 5, 7, 9]; // pentatônica
  const ROOTS = [50, 53, 48, 55, 51]; // D, F, C, G, Eb (variações lentas de cor)
  const VOICINGS = [[0, 7, 14, 16], [0, 7, 12, 17], [0, 5, 12, 14], [0, 7, 9, 16], [0, 2, 7, 12]];

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    verb = ctx.createConvolver(); verb.buffer = impulse(5.5, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.55; verb.connect(wet).connect(master);
    amb = ctx.createGain(); amb.gain.value = 0.11; amb.connect(master); amb.connect(verb);
    fx = ctx.createGain(); fx.gain.value = 0.9; fx.connect(master); fx.connect(verb);
    pad();
  }

  // Pad: 4 vozes com osciladores levemente desafinados, filtro que respira devagar, acordes que mudam sozinhos
  let voices = [];
  function pad() {
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 0.4;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.031; lfoG.gain.value = 380; lfo.connect(lfoG).connect(filt.frequency); lfo.start();
    const g = ctx.createGain(); g.gain.value = 0.11; filt.connect(g).connect(amb);
    for (let i = 0; i < 4; i++) {
      const v = { a: ctx.createOscillator(), b: ctx.createOscillator(), g: ctx.createGain(), pan: ctx.createStereoPanner ? ctx.createStereoPanner() : null };
      v.a.type = 'sine'; v.b.type = i % 2 ? 'triangle' : 'sine'; v.b.detune.value = rnd(5, 11) * (i % 2 ? 1 : -1);
      v.g.gain.value = 0.22;
      v.a.connect(v.g); v.b.connect(v.g);
      if (v.pan) { v.pan.pan.value = [-0.5, 0.3, -0.2, 0.55][i]; v.g.connect(v.pan).connect(filt); } else v.g.connect(filt);
      // Cada voz oscila de volume no próprio ritmo, para o pad nunca ficar parado
      const t = ctx.createOscillator(), tg = ctx.createGain(); t.frequency.value = rnd(0.04, 0.09); tg.gain.value = 0.12; t.connect(tg).connect(v.g.gain); t.start();
      v.a.start(); v.b.start(); voices.push(v);
    }
    chord(true);
  }
  // Acordes do pad seguem a progressão da trilha (com troca suave)
  function chord(now, ch, at) {
    ch = ch || PROG[0];
    const t = at || ctx.currentTime, glide = now ? 0.01 : 0.6;
    voices.forEach((v, i) => { const f = hz(ch.r + 12 + ch.t[i]); v.a.frequency.setTargetAtTime(f, t, glide); v.b.frequency.setTargetAtTime(f * (i === 3 ? 2 : 1), t, glide); });
  }

  // Trilha original, clima de estrada (groove motorik, reto e hipnótico): 116 bpm, mi menor, baixo em colcheias constantes,
  // "guitarra" abafada nos contratempos, bumbo e caixa macios, arpejo com eco. Camadas entram e saem a cada 8 compassos.
  const BPM = 116, STEP = 60 / BPM / 4;
  const PROG = [{ r: 40, t: [0, 7, 15, 19] }, { r: 40, t: [0, 7, 15, 22] }, { r: 38, t: [0, 7, 16, 19] }, { r: 36, t: [0, 7, 16, 23] }];
  let seq = null, step = 0, nextT = 0, layers = null, arpPat = [], bassPat = [], bus = null, delay = null;
  function buildSeq() {
    bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(amb);
    delay = ctx.createDelay(1); delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.32; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    delay.connect(dl).connect(fb).connect(delay); dl.connect(bus);
  }
  function newPatterns() {
    const n = 8; arpPat = Array.from({ length: n }, () => (Math.random() < 0.6 ? Math.floor(Math.random() * 6) : -1));
    // baixo em colcheias, quase sempre na tônica, com uma ou outra subida de quinta/oitava no fim do compasso
    const B = [[0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 7, -1], [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1, 7, -1], [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1], [0, -1, 0, -1, 0, -1, 12, -1, 0, -1, 0, -1, 0, -1, 10, -1]];
    bassPat = pick(B);
  }
  function section(bar) {
    // começa com baixo e guitarra, a bateria entra no compasso 4; depois, a cada 8 compassos, sorteia camadas (às vezes um respiro)
    if (bar === 0) { layers = { kick: false, snare: false, hat: false, bass: true, gtr: true, arp: false }; newPatterns(); return; }
    if (bar === 4) { layers = { kick: true, snare: true, hat: true, bass: true, gtr: true, arp: false }; return; }
    if (bar % 8) return;
    const breath = Math.random() < 0.18;
    layers = breath ? { kick: false, snare: false, hat: true, bass: true, gtr: false, arp: true } : { kick: true, snare: true, hat: true, bass: true, gtr: Math.random() < 0.85, arp: Math.random() < 0.5 };
    newPatterns();
  }
  function snare(t, v) {
    if (!noiseBuf) hat(t, 0);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.16 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.connect(f).connect(g).connect(bus); g.connect(verb); s.start(t); s.stop(t + 0.2);
  }
  // "Guitarra" abafada: acorde curto em dente de serra passando por um filtro fechado
  function gtr(t, ch, v) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.12); f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    let out = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = -0.35; g.connect(p); out = p; }
    f.connect(g); out.connect(bus);
    [0, 7, 12].forEach((k, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(ch.r + 12 + k), t); o.detune.value = (i - 1) * 6; o.connect(f); o.start(t); o.stop(t + 0.2); });
  }
  function kick(t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.45);
  }
  let noiseBuf = null;
  function hat(t, v) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(0.06 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    let out = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = 0.25; g.connect(p); out = p; }
    s.connect(f).connect(g); out.connect(bus); s.start(t); s.stop(t + 0.08);
  }
  function bass(t, m, len) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(hz(m), t);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + len + 0.05);
  }
  function pluck(t, m, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(hz(m), t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    let out = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.5, 0.5); g.connect(p); out = p; }
    o.connect(g); out.connect(bus); out.connect(delay); o.start(t); o.stop(t + 0.55);
  }
  function tick() {
    if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.05; // aba voltou do segundo plano: não despeja notas atrasadas
    while (nextT < ctx.currentTime + 0.15) {
      const s16 = step % 16, bar = Math.floor(step / 16), ch = PROG[Math.floor(bar / 2) % PROG.length];
      if (s16 === 0) { section(bar); if (bar % 2 === 0) chord(false, ch, nextT); if (bar % 4 === 0 && Math.random() < 0.5) newPatterns(); }
      const t = nextT;
      if (layers.kick && s16 % 4 === 0) kick(t, s16 === 0 ? 1 : 0.75);
      if (layers.snare && (s16 === 4 || s16 === 12)) snare(t, s16 === 12 ? 1 : 0.85);
      if (layers.hat && s16 % 2 === 0) hat(t, s16 % 4 === 2 ? rnd(0.7, 1) : rnd(0.3, 0.5));
      const b = bassPat[s16]; if (layers.bass && b >= 0) bass(t, ch.r - 12 + b, STEP * 1.7);
      if (layers.gtr && s16 % 4 === 2) gtr(t, ch, rnd(0.7, 1));
      if (layers.gtr && s16 === 14 && Math.random() < 0.4) gtr(t + STEP, ch, 0.6);
      if (layers.arp && s16 % 2 === 0) { const k = arpPat[(s16 / 2) % arpPat.length]; if (k >= 0) { const tones = [0, ch.t[1], ch.t[2], ch.t[3], 12 + ch.t[2], 24]; pluck(t, ch.r + 24 + tones[k], rnd(0.45, 0.8)); } }
      nextT += STEP; step++;
    }
  }
  function playSeq() { if (seq) return; if (!bus) buildSeq(); step = 0; nextT = ctx.currentTime + 0.1; layers = null; seq = setInterval(tick, 25); tick(); }
  function stopSeq() { clearInterval(seq); seq = null; }
  // Brilhos esparsos: notas altas e suaves, em tempos e alturas sempre diferentes
  function sparkle() {
    if (!on) return;
    if (!document.hidden) {
      const m = 74 + pick(SCALE) + pick([0, 12]);
      tone(hz(m), { type: 'sine', gain: rnd(0.012, 0.026), attack: rnd(0.4, 1.4), release: rnd(3, 6), out: amb, pan: rnd(-0.7, 0.7) });
      if (Math.random() < 0.35) setTimeout(() => on && tone(hz(m + pick([5, 7, 12])), { type: 'sine', gain: 0.012, attack: 0.8, release: 5, out: amb, pan: rnd(-0.7, 0.7) }), rnd(600, 1800));
    }
    timers.push(setTimeout(sparkle, rnd(4000, 11000)));
  }

  function tone(f, o) {
    const t = ctx.currentTime + (o.delay || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.attack || 0.01) + (o.release || 0.3));
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack || 0.01) + (o.release || 0.3));
    osc.connect(g);
    if (o.pan !== undefined && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p).connect(o.out || fx); } else g.connect(o.out || fx);
    osc.start(t); osc.stop(t + (o.attack || 0.01) + (o.release || 0.3) + 0.1);
  }
  function air(o) { // sopro de ruído filtrado (movimento de câmera/abertura)
    const t = ctx.currentTime, len = o.dur, b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(o.from, t); f.frequency.exponentialRampToValueAtTime(o.to, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain, t + len * 0.4); g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(f).connect(g).connect(fx); s.start(t);
  }

  let lastHover = 0;
  const api = {
    hover() { if (!on || performance.now() - lastHover < 90) return; lastHover = performance.now(); tone(hz(86 + pick(SCALE)), { gain: 0.018, attack: 0.005, release: 0.35, pan: rnd(-0.4, 0.4) }); },
    open() { if (!on) return; air({ from: 300, to: 2400, dur: 0.9, gain: 0.05 }); const r = 62 + pick(SCALE); [0, 7, 12].forEach((k, i) => tone(hz(r + k), { gain: 0.03, attack: 0.02, release: 1.8, delay: 0.12 + i * 0.07, pan: (i - 1) * 0.3 })); },
    close() { if (!on) return; air({ from: 2000, to: 300, dur: 0.7, gain: 0.035 }); tone(hz(74), { gain: 0.02, attack: 0.01, release: 0.9, to: hz(67) }); },
    call() { if (!on) return; tone(hz(81 + pick(SCALE)), { gain: 0.012, attack: 0.3, release: 2.4, out: amb, pan: rnd(-0.6, 0.6) }); },
    click() { if (!on) return; tone(hz(79), { gain: 0.02, attack: 0.003, release: 0.18 }); },
    enter() { if (!on) return; air({ from: 120, to: 1600, dur: 2.6, gain: 0.06 }); tone(hz(38), { type: 'sine', gain: 0.08, attack: 1.2, release: 3.5 }); },
    start, stop, get on() { return on; },
  };

  function start(fromEnter) {
    if (pref() === 'off' && !fromEnter) return;
    if (!ctx) build();
    if (ctx.state === 'suspended') ctx.resume();
    if (on) return;
    on = true; save('on');
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 1.6);
    playSeq();
    mark();
  }
  function stop() {
    on = false; save('off');
    timers.forEach(clearTimeout); timers = []; stopSeq();
    if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => !on && ctx.suspend(), 1500); }
    mark();
  }
  function mark() { if (!btn) return; btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('on', on); btn.setAttribute('aria-label', on ? 'Sound off' : 'Sound on'); btn.title = on ? 'Sound off' : 'Sound on'; }
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); if (on) stop(); else start(true); });
  // Quem já entrou antes (e não desligou) ganha o som no primeiro clique em qualquer lugar
  const first = (e) => { removeEventListener('pointerdown', first, true); if (e.target.closest && e.target.closest('#sound-btn')) return; if (pref() !== 'off') start(); };
  addEventListener('pointerdown', first, true);
  // Aba escondida: silencia; volta suave
  document.addEventListener('visibilitychange', () => { if (!ctx || !on) return; master.gain.setTargetAtTime(document.hidden ? 0 : 0.9, ctx.currentTime, 0.5); });
  mark();
  window.WS_SOUND = api;
})();
