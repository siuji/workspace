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
    amb = ctx.createGain(); amb.gain.value = 0.2; amb.connect(master); amb.connect(verb);
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
  function chord(now) {
    const root = pick(ROOTS) - 12, vc = pick(VOICINGS), t = ctx.currentTime, glide = now ? 0.01 : rnd(4, 7);
    voices.forEach((v, i) => { const f = hz(root + vc[i]); v.a.frequency.setTargetAtTime(f, t, glide); v.b.frequency.setTargetAtTime(f * (i === 3 ? 2 : 1), t, glide); });
    timers.push(setTimeout(() => on && chord(), rnd(14000, 24000)));
  }
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
    timers.push(setTimeout(sparkle, 3000));
    if (voices.length && !timers.length) chord();
    mark();
  }
  function stop() {
    on = false; save('off');
    timers.forEach(clearTimeout); timers = [];
    if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => !on && ctx.suspend(), 1500); }
    mark();
  }
  function mark() { if (!btn) return; btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('on', on); btn.setAttribute('aria-label', on ? 'Sound off' : 'Sound on'); btn.title = on ? 'Sound off' : 'Sound on'; }
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); if (on) stop(); else start(true); });
  // Quem já entrou antes (e não desligou) ganha o som no primeiro clique em qualquer lugar
  const first = () => { if (pref() === 'on') start(); removeEventListener('pointerdown', first, true); };
  addEventListener('pointerdown', first, true);
  // Aba escondida: silencia; volta suave
  document.addEventListener('visibilitychange', () => { if (!ctx || !on) return; master.gain.setTargetAtTime(document.hidden ? 0 : 0.9, ctx.currentTime, 0.5); });
  mark();
  window.WS_SOUND = api;
})();
