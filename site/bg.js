// Fundo leve: degradê quase imperceptível e poeira esparsa cintilando devagar. Segue o tema (escuro/claro).
(function () {
  const c = document.getElementById('bg'); if (!c) return;
  const x = c.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, D = Math.min(devicePixelRatio || 1, 2), dust = [], col = {};
  const rnd = (a, b) => a + Math.random() * (b - a);
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    col = { a: s.getPropertyValue('--bg-1').trim(), b: s.getPropertyValue('--bg').trim(), d: s.getPropertyValue('--dust').trim() };
  }
  function size() {
    W = innerWidth; H = innerHeight; c.width = W * D; c.height = H * D; c.style.width = W + 'px'; c.style.height = H + 'px'; x.setTransform(D, 0, 0, D, 0, 0);
    dust = Array.from({ length: Math.round(W * H / 9000) }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(.3, 1), a: rnd(.06, .35), p: rnd(0, 6.3), v: rnd(.3, 1), dx: rnd(-.04, .04), dy: rnd(-.03, .03) }));
  }
  let running = false;
  function frame(t) {
    const g = x.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .5, Math.max(W, H) * .8);
    g.addColorStop(0, col.a); g.addColorStop(1, col.b); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (const d of dust) {
      if (!reduce) { d.x = (d.x + d.dx + W) % W; d.y = (d.y + d.dy + H) % H; }
      const a = d.a * (.6 + .4 * Math.sin(t * .001 * d.v + d.p));
      x.fillStyle = `rgba(${col.d},${a.toFixed(3)})`; x.beginPath(); x.arc(d.x, d.y, d.r, 0, 6.283); x.fill();
    }
    if (!document.hidden && !reduce) requestAnimationFrame(frame); else running = false;
  }
  const start = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
  readTheme(); size();
  addEventListener('resize', () => { size(); start(); });
  document.addEventListener('visibilitychange', start);
  new MutationObserver(() => { readTheme(); start(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  start();
})();
