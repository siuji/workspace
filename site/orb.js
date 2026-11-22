// Esfera central viva: as manchas de cor passeiam por dentro com ritmo variável
// (momentos calmos, momentos rápidos, rompantes de uma cor) e a borda se deforma de vez em quando.
(function () {
  const els = () => document.querySelectorAll('#orb i, .m-orb i');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // cor, posição base (%), raio base (%), fase própria
  const B = [
    { c: '232,107,208', x: 70, y: 22, r: 46 },
    { c: '242,164,92', x: 22, y: 62, r: 42 },
    { c: '239,216,98', x: 82, y: 58, r: 26 },
    { c: '56,183,160', x: 46, y: 84, r: 36 },
    { c: '29,27,58', x: 62, y: 62, r: 34 },
    { c: '70,72,207', x: 70, y: 82, r: 40 },
  ].map((b, i) => ({ ...b, p: i * 1.7, q: i * 2.3 + 1, f: 0.7 + (i % 3) * 0.25, boost: 0 }));
  let clock = 0, speed = 1, target = 1, nextShift = 0, last = performance.now();
  let burst = null, nextBurst = performance.now() + 2500;
  let deform = 0.15, deformTarget = 0.15, nextDeform = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ease = (x) => x * x * (3 - 2 * x);

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // ritmo: a cada poucos segundos escolhe nova velocidade (calma ↔ agitada)
    if (now > nextShift) { target = Math.random() < 0.3 ? rnd(2.2, 3.6) : rnd(0.5, 1.4); nextShift = now + rnd(2500, 6000); }
    speed += (target - speed) * Math.min(1, dt * 1.2);
    clock += dt * speed;
    // rompante: uma cor cresce e invade por ~1.6 s
    if (!burst && now > nextBurst) { burst = { b: B[Math.floor(Math.random() * B.length)], t0: now, d: rnd(1300, 2200) }; nextBurst = now + rnd(5000, 11000); }
    B.forEach((b) => (b.boost = 0));
    if (burst) {
      const k = (now - burst.t0) / burst.d;
      if (k >= 1) burst = null; else burst.b.boost = Math.sin(Math.PI * ease(k));
    }
    // deformação da borda: quase redonda na maior parte do tempo, às vezes mais orgânica
    if (now > nextDeform) { deformTarget = Math.random() < 0.35 ? rnd(0.6, 1) : rnd(0.08, 0.3); nextDeform = now + rnd(3000, 7000); }
    deform += (deformTarget - deform) * Math.min(1, dt * 0.8);

    const g = B.map((b) => {
      const ax = 18 + b.boost * 6, ay = 16 + b.boost * 6;
      const x = b.x + Math.sin(clock * 0.9 * b.f + b.p) * ax + Math.sin(clock * 0.37 + b.q) * 6;
      const y = b.y + Math.cos(clock * 0.8 * b.f + b.q) * ay + Math.cos(clock * 0.29 + b.p) * 6;
      const r = b.r * (1 + 0.18 * Math.sin(clock * 1.3 * b.f + b.p) + b.boost * 0.9);
      return `radial-gradient(circle at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgb(${b.c}) 0, rgba(${b.c},0) ${r.toFixed(1)}%)`;
    });
    const hx = 34 + Math.sin(clock * 0.6) * 10, hy = 24 + Math.cos(clock * 0.5) * 8;
    const bg = `radial-gradient(circle at ${hx.toFixed(1)}% ${hy.toFixed(1)}%, rgba(255,240,250,.9), rgba(255,240,250,0) 26%), ${g.join(', ')}, #c983e2`;
    const a = 9 * deform, s = clock * 0.7;
    const br = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (50 + a * Math.sin(s * (0.8 + i * 0.13) + i * 1.9)).toFixed(1) + '%');
    const radius = `${br[0]} ${br[1]} ${br[2]} ${br[3]} / ${br[4]} ${br[5]} ${br[6]} ${br[7]}`;
    els().forEach((el) => { el.style.background = bg; el.style.borderRadius = radius; });
    // Esferas menores acesas (as 4 fixas + a do rodízio): mesma vida, com as cores de cada uma
    const alive = document.querySelectorAll('.node-orb.alive i');
    alive.forEach((el) => {
      let c = el._c;
      if (!c) {
        const cs = getComputedStyle(el.parentNode), toRgb = (v) => { const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const r = getComputedStyle(d).color.match(/\d+/g).slice(0, 3).join(','); d.remove(); return r; };
        const c1 = toRgb(cs.getPropertyValue('--c1').trim()), c2 = toRgb(cs.getPropertyValue('--c2').trim());
        const mix = (a, b, k) => a.split(',').map((x, i) => Math.round(x * (1 - k) + b.split(',')[i] * k)).join(',');
        c = el._c = { cols: [c1, c2, mix(c1, '255,255,255', 0.45), mix(c2, '26,24,48', 0.5)], ph: Math.random() * 10 };
      }
      const k = clock * 1.1 + c.ph;
      const g = c.cols.map((col, i) => {
        const x = 50 + Math.sin(k * (0.9 + i * 0.17) + i * 1.7) * 24, y = 50 + Math.cos(k * (0.8 + i * 0.13) + i * 2.3) * 22;
        const r = 48 + 14 * Math.sin(k * 1.2 + i);
        return `radial-gradient(circle at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgb(${col}) 0, rgba(${col},0) ${r.toFixed(1)}%)`;
      });
      el.style.background = `radial-gradient(circle at 32% 26%, rgba(255,250,252,.8), rgba(255,250,252,0) 30%), ${g.join(', ')}, rgb(${c.cols[0]})`;
      const a2 = 9 * deform, s2 = k * 0.7;
      const b2 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (50 + a2 * Math.sin(s2 * (0.8 + i * 0.13) + i * 1.9)).toFixed(1) + '%');
      el.style.borderRadius = `${b2[0]} ${b2[1]} ${b2[2]} ${b2[3]} / ${b2[4]} ${b2[5]} ${b2[6]} ${b2[7]}`;
      el._on = true;
    });
    // As que apagaram voltam ao visual normal
    document.querySelectorAll('.node-orb:not(.alive) i').forEach((el) => { if (el._on) { el._on = false; el.style.background = ''; el.style.borderRadius = ''; } });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
