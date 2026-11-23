/* workspace: teia 3D de esferas conectadas. Dados em graph.js, gerado por build.js a partir de content/. */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CFG = window.WS_CONFIG || {};
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const data = window.WORKSPACE;
  if (!data || !window.ForceGraph3D) { document.body.classList.remove('intro'); document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;inset:auto 0 50%;text-align:center">Could not load the workspace.</p>'); return; }
  const TYPES = data.tipos;
  // ?skip pula a abertura; ?review pula a abertura e mostra os nós escondidos, marcados
  const params = new URLSearchParams(location.search);
  const REVIEW = params.has('review');
  const SKIP = REVIEW || params.has('skip');
  if (REVIEW) document.body.insertAdjacentHTML('beforeend', '<span class="review-tag">Review mode · dashed spheres are hidden from the public site</span>');

  // Anos de carreira, sempre calculados a partir do início (janeiro de 1999)
  const start = new Date((CFG.careerStart || '1999-01-01') + 'T00:00:00');
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  if (now.getMonth() < start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())) years--;
  const fillYears = (root) => root.querySelectorAll('.years').forEach((el) => (el.textContent = years));
  fillYears(document);

  // Tema
  const root = document.documentElement;
  const isLight = () => root.dataset.theme === 'light';
  document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
    root.dataset.theme = b.dataset.themeSet;
    try { localStorage.setItem('ws-theme', b.dataset.themeSet); } catch (e) {}
    refresh();
  }));

  // Sem escolha salva, o tema acompanha o sistema da pessoa (inclusive se ela trocar com o site aberto)
  try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => { let saved = null; try { saved = localStorage.getItem('ws-theme'); } catch (x) {} if (!saved) { root.dataset.theme = e.matches ? 'light' : 'dark'; refresh(); } }); } catch (e) {}

  // Estrutura
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const neighbors = new Map(data.nodes.map((n) => [n.id, new Set()]));
  for (const l of data.links) { neighbors.get(l.source).add(l.target); neighbors.get(l.target).add(l.source); }
  const hub = data.nodes.find((n) => n.tipo === 'hub');
  if (hub) Object.assign(hub, { fx: 0, fy: 0, fz: 0 });

  // Cores das esferas filhas: puxadas de dentro da esfera central, em degradê, estáveis entre visitas
  const PAIRS = [['#ef8fd9', '#f2a45c'], ['#f2a45c', '#efd862'], ['#efd862', '#45bfa6'], ['#45bfa6', '#5b5fd8'], ['#8d8ff0', '#e86bd0'], ['#c983e2', '#f19ac4'], ['#f4b48a', '#e86bd0'], ['#62c9b6', '#c983e2']];
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
  const pairOf = {};
  let ai = 0;
  for (const n of [...data.nodes].sort((a, b) => a.ordem - b.ordem)) if (n.tipo === 'area') pairOf[n.id] = PAIRS[ai++ % PAIRS.length];
  // BFS a partir do hub: cada nó herda a cor da área de onde vem
  const order = [];
  if (hub) {
    const seen = new Set([hub.id]); const q = [hub.id];
    while (q.length) { const id = q.shift(); order.push(id); for (const m of neighbors.get(id)) if (!seen.has(m)) { seen.add(m); q.push(m); if (!pairOf[m]) pairOf[m] = pairOf[id] || PAIRS[Math.floor(hash(m) * PAIRS.length)]; } }
  }
  for (const n of data.nodes) { if (!order.includes(n.id)) order.push(n.id); if (!pairOf[n.id]) pairOf[n.id] = PAIRS[Math.floor(hash(n.id) * PAIRS.length)]; }
  const dotStyle = (n) => n.tipo === 'hub' ? '--c1:#e86bd0;--c2:#f2a45c' : `--c1:${pairOf[n.id][0]};--c2:${pairOf[n.id][1]}`;

  let entryT0 = null; const ENTRY_MS = 2600;
  let selected = null, hovered = null, calling = null, spreadId = null;
  const scaleOf = new Map();
  const focusId = () => (hovered || selected)?.id;
  const linkEnds = (l) => [typeof l.source === 'object' ? l.source.id : l.source, typeof l.target === 'object' ? l.target.id : l.target];
  const linkLit = (l) => { const f = focusId(); if (!f) return false; const [a, b] = linkEnds(l); return a === f || b === f; };
  const linkCall = (l) => calling && linkEnds(l).includes(calling);
  const baseSize = (n) => (n.tipo === 'hub' ? 22 : n.tipo === 'area' ? 8 + n.grau * 0.6 : 2 + Math.min(n.grau, 6) * 0.8);
  // destaque: área fica do tamanho das maiores áreas; filho fica maior que os outros filhos
  const AREA_MAX = (() => { const v = data.nodes.filter((n) => n.tipo === 'area' && !n.destaque).map(baseSize).sort((a, b) => b - a); return v.length > 1 ? (v[0] + v[1]) / 2 : v[0] || 8; })();
  const sizeOf = (n) => (!n.destaque ? baseSize(n) : n.tipo === 'area' ? AREA_MAX : Math.max(baseSize(n), AREA_MAX * 0.8));
  // Camadas: o profissional fica à frente; o pessoal vai para trás, menor e mais apagado
  const BACK_AREAS = new Set(CFG.backAreas || ['about-me', 'endurance', 'photography', 'social', 'tools', 'education']);
  const back = new Set();
  for (const id of BACK_AREAS) {
    if (!byId.has(id)) continue;
    const q = [id]; back.add(id);
    while (q.length) { const c = q.shift(); for (const m of neighbors.get(c)) { const t = byId.get(m); if (back.has(m) || t.tipo === 'hub' || (t.tipo === 'area' && !BACK_AREAS.has(m))) continue; back.add(m); q.push(m); } }
  }
  const isBack = (n) => back.has(n.id) && !n.destaque;

  // A teia nasce já assentada (sem tranco) e os nós vão acendendo aos poucos
  const revealed = new Set();
  let orbGoAt = 0; // clique tratado pela área da esfera: o clique 'de fundo' da biblioteca chega depois e não pode fechar
  const Graph = ForceGraph3D({ controlType: 'orbit' })($('#graph'))
    .backgroundColor('rgba(0,0,0,0)')
    .showNavInfo(false)
    .graphData({ nodes: data.nodes, links: data.links })
    .warmupTicks(220)
    .cooldownTime(Infinity)
    .d3VelocityDecay(0.55)
    .linkVisibility((l) => { const [a, b] = linkEnds(l); return revealed.has(a) && revealed.has(b); })
    .nodeId('id')
    .nodeVal(sizeOf)
    .nodeRelSize(4)
    .nodeOpacity(0)
    .nodeResolution(8)
    .nodeLabel(() => '')
    .linkColor((l) => (linkLit(l) ? 'rgba(255,255,255,1)' : linkCall(l) ? 'rgba(255,255,255,0.9)' : isLight() ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)'))
    .linkWidth((l) => (linkLit(l) ? 0.9 : linkCall(l) ? 0.6 : 0.34))
    .linkOpacity(0.55)
    .linkDirectionalParticles((l) => (reduceMotion ? 0 : linkLit(l) || linkCall(l) ? 4 : 1))
    .linkDirectionalParticleSpeed((l) => (linkLit(l) ? 0.012 : linkCall(l) ? 0.008 : 0.003))
    .linkDirectionalParticleWidth((l) => (linkLit(l) ? 1.6 : 1))
    .linkDirectionalParticleColor(() => (isLight() ? '#c46a8e' : '#f3c2ae'))
    .onNodeHover((n) => { if (n && n !== hovered) window.WS_SOUND && WS_SOUND.hover(); hovered = n || null; $('#graph').style.cursor = n ? 'pointer' : ''; refresh(); wantLift(n); })
    .onNodeClick((n) => { if (!document.body.classList.contains('intro')) go(n.id); })
    .onBackgroundClick(() => { if (selected && performance.now() - orbGoAt > 700) go(''); });

  if (params.has('debug')) window.WS_GRAPH = Graph;
  if (params.has('debug')) setTimeout(() => (window.WS_DBG = { around, target }), 0);
  // Posições: cada esfera tem um lugar calculado na área visível da tela (sem física decidindo onde ela vai parar).
  // 1) pontos espalhados por igual no retângulo da janela, fora do disco da esfera central;
  // 2) os pontos são divididos em fatias por ângulo, do tamanho de cada ramo (área + filhos), e cada ramo fica junto.
  // A física continua só para o movimento: uma força suave puxa cada esfera para o seu lugar.
  Graph.d3Force('charge').strength(0);
  Graph.d3Force('link').strength(0);
  Graph.d3Force('center', null); // sem recentralizar: cada esfera fica exatamente no lugar calculado
  const fitDist = () => { const fov = (Graph.camera().fov || 40) * Math.PI / 180; return 330 / Math.tan(fov / 2); };
  const HOME = { x: 0, y: 0, z: fitDist() };
  Graph.cameraPosition(HOME);
  // Árvore a partir do centro: cada nó pertence a um único ramo
  const kids = new Map(data.nodes.map((n) => [n.id, []]));
  if (hub) {
    const seen = new Set([hub.id]); let level = [hub.id];
    while (level.length) {
      const next = [];
      for (const id of level) for (const m of [...neighbors.get(id)].sort((a, b) => byId.get(a).ordem - byId.get(b).ordem || a.localeCompare(b))) {
        if (seen.has(m)) continue; seen.add(m); kids.get(id).push(m); next.push(m);
      }
      level = next;
    }
  }
  const sizeTree = (id) => 1 + kids.get(id).reduce((s, k) => s + sizeTree(k), 0);
  const target = new Map(), around = new Map();
  function layout() {
    if (!hub) return;
    const H = HOME.z * Math.tan(((Graph.camera().fov || 40) * Math.PI / 180) / 2), W = H * innerWidth / innerHeight;
    const pxw = (2 * H) / innerHeight; // 1px da tela em unidades do mundo, no plano do centro
    const Wm = W - 150 * pxw, Ht = H - 96 * pxw, Hb = H - 110 * pxw; // folga para rótulos, botões e dica
    const c = Math.min(innerWidth, innerHeight) * 0.27 * pxw * 0.5 + 70 * pxw; // raio da esfera central + respiro
    const N = sizeTree(hub.id) - 1;
    // Pontos iniciais (Halton 2,3) e relaxamento até ficarem equidistantes
    const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
    const pts = [];
    for (let i = 1; pts.length < N && i < 5000; i++) {
      const x = (halton(i, 2) * 2 - 1) * Wm, y = -Hb + halton(i, 3) * (Ht + Hb);
      if (Math.hypot(x, y) > c) pts.push({ x, y });
    }
    const s = Math.sqrt((4 * Wm * (Ht + Hb) / 2 - Math.PI * c * c) / Math.max(1, N)) * 1.05;
    for (let it = 0; it < 120; it++) {
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j], dx = b.x - a.x, dy = (b.y - a.y) * 1.15, d = Math.hypot(dx, dy) || 0.01;
        if (d < s) { const g = (s - d) / d * 0.25; a.x -= dx * g; a.y -= dy * g / 1.15; b.x += dx * g; b.y += dy * g / 1.15; }
      }
      for (const p of pts) {
        p.x = Math.max(-Wm, Math.min(Wm, p.x)); p.y = Math.max(-Hb, Math.min(Ht, p.y));
        const r = Math.hypot(p.x, p.y); if (r < c) { const k = c / (r || 0.01); p.x *= k; p.y *= k; }
      }
    }
    // Divide por ângulo (começando no alto, sentido horário) e distribui ramo a ramo
    const ang = (p) => { let a = Math.atan2(p.x, p.y); if (a < -0.35) a += Math.PI * 2; return a; };
    function assign(id, ps) {
      if (id !== hub.id) {
        const cx = ps.reduce((t, p) => t + p.x, 0) / ps.length, cy = ps.reduce((t, p) => t + p.y, 0) / ps.length;
        let bi = 0, bd = Infinity;
        ps.forEach((p, i) => { const d = Math.hypot(p.x - cx, p.y - cy) - (byId.get(id).tipo === 'area' ? Math.hypot(p.x, p.y) * 0.15 : 0); if (d < bd) { bd = d; bi = i; } });
        target.set(id, ps[bi]); ps = ps.filter((_, i) => i !== bi);
      }
      ps.sort((a, b) => ang(a) - ang(b));
      let k = 0;
      for (const ch of kids.get(id)) { const n = sizeTree(ch); assign(ch, ps.slice(k, k + n)); k += n; }
    }
    assign(hub.id, pts);
    // Profundidade: leve variação para dar volume; o pessoal fica um pouco atrás. A posição na tela é compensada.
    for (const [id, p] of target) {
      const z = (hash(id + 'z') - 0.5) * 0.22 * H - (back.has(id) && !byId.get(id).destaque ? 0.18 * H : 0), f = (HOME.z - z) / HOME.z;
      p.tx = p.x * f; p.ty = p.y * f; p.tz = z;
    }
  }
  layout();
  for (const n of data.nodes) { const p = target.get(n.id); if (p) { n.x = p.tx; n.y = p.ty; n.z = p.tz; } }
  const driftSeed = new Map();
  function drift(n) {
    if (reduceMotion) return { x: 0, y: 0, z: 0 };
    let q = driftSeed.get(n.id);
    if (!q) { const h = hash(n.id + 'd'), h2 = hash(n.id + 'e'); q = { a: h * 6.28, b: h2 * 6.28, fx: 0.17 + h * 0.13, fy: 0.14 + h2 * 0.14, fz: 0.1 + h * 0.08, amp: n.tipo === 'area' ? 5.5 : 8 }; driftSeed.set(n.id, q); }
    const t = performance.now() / 1000;
    return {
      x: q.amp * (Math.sin(t * q.fx + q.a) + 0.45 * Math.sin(t * q.fx * 2.3 + q.b)),
      y: q.amp * (Math.cos(t * q.fy + q.b) + 0.4 * Math.sin(t * q.fy * 1.9 + q.a)),
      z: q.amp * 0.8 * Math.sin(t * q.fz + q.a + q.b),
    };
  }
  Graph.d3Force('place', (alpha) => {
    for (const n of data.nodes) {
      const p = around.get(n.id) || target.get(n.id); if (!p || n.fx !== undefined) continue;
      const k = 0.14 * Math.max(alpha, 0.5);
      // Respiração própria de cada esfera: pequenos desvios com ritmos diferentes, como se se reorganizassem
      const d = drift(n);
      n.vx += (p.tx + d.x - n.x) * k; n.vy += (p.ty + d.y - n.y) * k; n.vz += (p.tz + d.z - n.z) * k;
    }
  });

  // Na abertura a teia sobe um pouco para dar espaço ao texto
  const controls = Graph.controls();
  // Balanço suave da câmera (vai e volta), em vez de girar a volta inteira: nada passa por trás da esfera central
  controls.autoRotate = false;
  let sway = false, swayA = 0, swayT0 = performance.now(); // balanço em bloco desligado: agora cada esfera respira sozinha (drift)
  controls.enableDamping = true;
  controls.addEventListener('start', () => { sway = false; $('#hint').style.opacity = 0; });
  // Dica de navegação volta depois de 15 s sem nenhuma ação; some na próxima ação
  let idleTimer;
  const poke = () => {
    clearTimeout(idleTimer);
    const h = $('#hint'); if (h.style.opacity === '1') h.style.opacity = 0;
    idleTimer = setTimeout(() => { if (!document.body.classList.contains('intro')) $('#hint').style.opacity = 1; }, 15000);
  };
  ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, poke, { passive: true }));
  poke();
  addEventListener('resize', () => {
    Graph.width(innerWidth).height(innerHeight);
    layout();
    Graph.d3ReheatSimulation();
  });

  function refresh() {
    Graph.linkColor(Graph.linkColor()).linkWidth(Graph.linkWidth())
      .linkDirectionalParticles(Graph.linkDirectionalParticles())
      .linkDirectionalParticleSpeed(Graph.linkDirectionalParticleSpeed())
      .linkDirectionalParticleWidth(Graph.linkDirectionalParticleWidth())
      .linkDirectionalParticleColor(Graph.linkDirectionalParticleColor());
  }

  // Formação da teia: nós acendem aos poucos a partir do centro
  let grown = 0;
  function grow() {
    if (grown >= order.length) return;
    revealed.add(order[grown++]);
    Graph.linkVisibility(Graph.linkVisibility());
    if (grown < order.length) setTimeout(grow, reduceMotion ? 0 : grown < 9 ? 260 : 110);
  }
  setTimeout(grow, 300);

  // Esferas e rótulos em HTML que acompanham os nós
  const labelLayer = $('#labels'), orbLayer = $('#orbs'), orb = $('#orb');
  orbLayer.appendChild(orb); // a esfera central entra na mesma camada: quem está na frente dela aparece por cima
  const labels = new Map(), orbs = new Map();
  const hubKids = new Set(data.nodes.filter((n) => n.tipo !== 'hub' && neighbors.get(hub.id).has(n.id)).map((n) => n.id));
  for (const n of data.nodes) {
    if (n.tipo !== 'hub') {
      const o = document.createElement('div');
      o.className = 'node-orb' + (n.oculto ? ' hidden-node' : '');
      const [c1, c2] = pairOf[n.id];
      const h = hash(n.id + 'h');
      o.style.cssText = `--c1:${c1};--c2:${c2};--t:${(5 + h * 4).toFixed(1)}s;--t2:${(10 + h * 9).toFixed(1)}s;--delay:-${(h * 6).toFixed(1)}s;filter:hue-rotate(${Math.round(h * 36 - 18)}deg) saturate(.92);opacity:0`;
      o.innerHTML = '<i></i>';
      if (hubKids.has(n.id)) o.classList.add('alive');
      o.dataset.id = n.id; orbLayer.appendChild(o); orbs.set(n.id, o);
      const el = document.createElement('div');
      el.className = 'label' + (hubKids.has(n.id) ? ' big' : '');
      el.textContent = n.rotulo || n.titulo;
      el.style.opacity = 0;
      // O nome também é link: mesmo clique e mesmo hover da esfera
      el.addEventListener('click', (e) => { e.stopPropagation(); if (!document.body.classList.contains('intro')) go(n.id); });
      el.addEventListener('mouseenter', () => { if (n !== hovered) window.WS_SOUND && WS_SOUND.hover(); hovered = n; refresh(); wantLift(n); });
      el.addEventListener('mouseleave', () => { if (hovered === n) { hovered = null; refresh(); wantLift(null); } });
      labelLayer.appendChild(el); labels.set(n.id, el);
    }
  }
  // Hover: a esfera vem para a frente pelo raio da câmera (fica sob o mouse) e puxa as ligadas
  let lifted = null, liftT = 0, liftTimer = null;
  function wantLift(n) {
    clearTimeout(liftTimer);
    if (reduceMotion || document.body.classList.contains('intro')) return;
    if (n && (n.tipo === 'hub' || n.id === spreadId)) n = null;
    if (n === lifted) return;
    liftTimer = setTimeout(() => {
      if (lifted) drop(lifted);
      lifted = n; liftT = 0;
      if (n) { n.home = { x: n.x, y: n.y, z: n.z }; Graph.d3AlphaTarget && Graph.d3ReheatSimulation(); }
    }, n ? 140 : 450);
  }
  const dropping = new Set();
  function drop(n) { n.dropT = 1; dropping.add(n); Graph.d3ReheatSimulation(); }
  function stepLift() {
    const cam = Graph.camera().position;
    const place = (n, t) => {
      const h = n.home, v = { x: cam.x - h.x, y: cam.y - h.y, z: cam.z - h.z }, l = Math.hypot(v.x, v.y, v.z) || 1, d = Math.min(110, l * 0.3) * t;
      n.fx = h.x + v.x / l * d; n.fy = h.y + v.y / l * d; n.fz = h.z + v.z / l * d;
    };
    if (lifted) { liftT += (1 - liftT) * 0.08; place(lifted, liftT); }
    for (const n of dropping) {
      n.dropT += (0 - n.dropT) * 0.08;
      if (n.dropT < 0.02 || n === lifted) { dropping.delete(n); if (n !== lifted && n.id !== spreadId) { n.fx = n.fy = n.fz = undefined; } }
      else place(n, n.dropT);
    }
  }
  // Fios em degradê: cada fio sai da cor de uma esfera e chega na cor da outra (cores por vértice no cilindro do fio)
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  function gradLinks() {
    for (const l of data.links) {
      const o = l.__lineObj; if (!o || !o.geometry || !o.material || o.geometry.__grad) continue;
      const [a, b] = linkEnds(l), ca = rgb(pairOf[a][a === hub?.id ? 0 : 1]), cb = rgb(pairOf[b][b === hub?.id ? 0 : 1]);
      const g = o.geometry.clone(), pos = g.attributes.position, arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const t = Math.max(0, Math.min(1, pos.getZ(i))); for (let k = 0; k < 3; k++) arr[i * 3 + k] = ca[k] + (cb[k] - ca[k]) * t; }
      g.setAttribute('color', new pos.constructor(arr, 3)); g.__grad = true;
      o.geometry = g;
      if (!o.material.vertexColors) { o.material.vertexColors = true; o.material.needsUpdate = true; }
    }
  }
  function draw() {
    if (document.body.classList.contains('classic')) { requestAnimationFrame(draw); return; }
    gradLinks();
    stepLift();
    if (sway && !selected) {
      const a = 0.2 * Math.sin((performance.now() - swayT0) / 15000 * Math.PI * 2), da = a - swayA; swayA = a;
      const cp = Graph.camera().position, tg = controls.target, x = cp.x - tg.x, z = cp.z - tg.z, cs = Math.cos(da), sn = Math.sin(da);
      cp.x = tg.x + x * cs + z * sn; cp.z = tg.z - x * sn + z * cs; Graph.camera().lookAt(tg);
    }
    const cam = Graph.camera(), t = controls.target;
    const dir = { x: t.x - cam.position.x, y: t.y - cam.position.y, z: t.z - cam.position.z };
    const f = focusId();
    for (const n of data.nodes) {
      if (n.x === undefined) continue;
      const v = { x: n.x - cam.position.x, y: n.y - cam.position.y, z: n.z - cam.position.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      const behind = v.x * dir.x + v.y * dir.y + v.z * dir.z <= 0;
      const p = Graph.graph2ScreenCoords(n.x, n.y, n.z);
      if (n.tipo === 'hub') {
        const q = Graph.graph2ScreenCoords(n.x, n.y + 46, n.z);
        // Esfera central com tamanho ligado à janela (acompanha o zoom da câmera)
        const cp = Graph.camera().position, zf = HOME.z / (Math.hypot(cp.x, cp.y, cp.z) || HOME.z);
        let d = Math.max(40, Math.abs(q.y - p.y) * 2, Math.min(innerWidth, innerHeight) * 0.27 * zf);
        // Entrada: a esfera nasce gigante (toma a tela) e encolhe até o lugar, com leve rebote
        if (entryT0 !== null) {
          const t = Math.min(1, (performance.now() - entryT0) / ENTRY_MS), u = Math.max(0, (t - 0.16) / 0.84);
          const c = 0.7, e = 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); // segura grande, encolhe rápido e assenta com rebote
          const big = Math.hypot(innerWidth, innerHeight) * 1.25 / d;
          const k = big + (1 - big) * e, cx = innerWidth / 2, cy = innerHeight / 2;
          p.x = cx + (p.x - cx) * e; p.y = cy + (p.y - cy) * e;
          d *= Math.max(0.6, k);
          orb.style.setProperty('--txt', Math.max(0, (t - 0.55) / 0.45).toFixed(2));
          if (t > 0.45) document.body.classList.remove('entering');
          if (t >= 1) { entryT0 = null; orb.classList.remove('entering'); orb.style.removeProperty('--txt'); }
        }
        orb.style.width = orb.style.height = d.toFixed(1) + 'px';
        orb.style.setProperty('--d', d.toFixed(1) + 'px');
        orb.style.transform = `translate(${(p.x - d / 2).toFixed(1)}px, ${(p.y - d / 2).toFixed(1)}px)`;
        orb.style.opacity = behind ? 0 : 1;
        orb.style.zIndex = String(10000 - Math.round(dist));
        continue;
      }
      const ob = orbs.get(n.id), el = labels.get(n.id);
      if (behind || !revealed.has(n.id)) { ob.style.opacity = 0; el.style.opacity = 0; continue; }
      const R = Math.cbrt(sizeOf(n)) * 4 * 1.15 * (isBack(n) ? 0.72 : 1);
      const q = Graph.graph2ScreenCoords(n.x, n.y + R, n.z);
      const tgt = hovered && hovered.id === n.id ? 1.5 : selected && selected.id === n.id ? 1.35 : spreadId && neighbors.get(spreadId).has(n.id) ? 1.18 : 1;
      const sc = (scaleOf.get(n.id) || 1) + (tgt - (scaleOf.get(n.id) || 1)) * 0.18; scaleOf.set(n.id, sc);
      const d = Math.max(6, Math.abs(q.y - p.y) * 2) * sc;
      ob.style.width = ob.style.height = d.toFixed(1) + 'px';
      ob.style.transform = `translate(${(p.x - d / 2).toFixed(1)}px, ${(p.y - d / 2).toFixed(1)}px)`;
      ob.style.zIndex = String(10000 - Math.round(dist));
      const lit = !f || n.id === f || neighbors.get(f).has(n.id);
      ob.style.opacity = ((lit ? Math.max(0.4, Math.min(1, (950 - dist) / 500)) : 0.2) * (isBack(n) && !(f && lit) ? 0.55 : 1)).toFixed(2);
      // Ao lado do painel aberto: brilho normal e pulsando, chamando o clique
      const beside = !!selected && n !== selected && around.has(n.id);
      if (ob.classList.contains('beside') !== beside) ob.classList.toggle('beside', beside);
      if (beside) ob.style.opacity = '1';
      const near = Math.max(0, Math.min(1, (560 - dist) / 260));
      // Acesos direto só os nós ligados à esfera central (Portfolio, Career, Konkrë, About me); o resto acende de vez em quando
      let o = hubKids.has(n.id) ? Math.max(0.6, near) : near * 0.35;
      if (isBack(n)) o *= 0.6;
      if (f) o = n.id === f || neighbors.get(f).has(n.id) ? 1 : 0.08;
      if (n.id === calling && !f) o = Math.max(o, 0.85);
      el.style.opacity = o.toFixed(2);
      el.style.transform = `translate(${(p.x + d / 2 + 8).toFixed(1)}px, ${p.y.toFixed(1)}px) translateY(-50%)`;
      el.style.pointerEvents = o > 0.15 ? 'auto' : 'none';
      el.style.zIndex = ob.style.zIndex;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // De tempos em tempos uma esfera e seus fios chamam o clique
  function call() {
    if (calling) orbs.get(calling)?.classList.remove('calling', 'alive');
    calling = null;
    if (!selected && !document.hidden && !reduceMotion) {
      // Só estas acendem, em rodízio (pedido do Paulo)
      const ids = CFG.callIds || ['superside', 'casas-bahia', 'youtube', 'macys', 'wikimedia'];
      const list = ids.map((id) => data.nodes.find((k) => k.id === id)).filter((k) => k && k.x !== undefined);
      const n = list.length ? list[(callIdx++) % list.length] : null;
      if (n) { calling = n.id; orbs.get(n.id).classList.add('calling', 'alive'); window.WS_SOUND && WS_SOUND.call(); }
    }
    refresh();
    setTimeout(call, calling ? 5200 : 2400);
  }
  let callIdx = 0;
  setTimeout(call, 4000);

  // Câmera com partida e chegada suaves
  function flyTo(n, ms) {
    if (n.x === undefined) return;
    const d = 210;
    const len = Math.hypot(n.x, n.y, n.z);
    const pos = len < 1 ? { x: -200, y: 90, z: d * 2.5 } : { x: n.x * (1 + d / len), y: n.y * (1 + d / len), z: n.z * (1 + d / len) };
    sway = false;
    Graph.cameraPosition(pos, { x: n.x, y: n.y, z: n.z }, reduceMotion ? 0 : ms);
  }
  function flyHome() {
    Graph.cameraPosition(HOME, { x: 0, y: 0, z: 0 }, reduceMotion ? 0 : 1600);
    setTimeout(() => { swayA = 0; swayT0 = performance.now(); }, 1700);
  }

  // Painel: a esfera clicada vem para frente e se expande numa tela de vidro
  const panel = $('#panel');
  let openTimer = null;
  const CFG_ROOT = 'paulo-asano';
  // Rótulos dos filtros (market e media) lidos dos chips do Portfolio
  const FACETS = {};
  { const pf = byId.get('portfolio'); if (pf) for (const m of pf.html.matchAll(/data-filter="([^"]+)">([^<]+)</g)) FACETS[m[1]] = m[2].replace(/&amp;/g, '&'); }
  const facetLabel = (f) => FACETS[f] || f;
  // Clique numa faceta: abre o Portfolio já filtrado
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-facet]');
    if (!b) return;
    const f = b.dataset.facet;
    go('portfolio');
    let tries = 0;
    const t = setInterval(() => { const c = document.querySelector(`#panel-body .chips [data-filter="${f}"]`); if (c) { clearInterval(t); c.click(); } else if (++tries > 30) clearInterval(t); }, 100);
  });
  function renderPanel(n) {
    const conns = [...neighbors.get(n.id)].map((id) => byId.get(id))
      .sort((a, b) => (a.tipo === 'hub' ? -1 : b.tipo === 'hub' ? 1 : a.ordem - b.ordem || a.titulo.localeCompare(b.titulo)));
    const type = TYPES[n.tipo] || { label: n.tipo };
    const me = n.id === CFG_ROOT;
    $('#panel-body').innerHTML = me ? `
      <div class="me-head"><img class="me-photo me-cut" src="media/paulo.png" alt="Paulo Asano"><img class="me-photo me-circle" src="media/paulo-circle.jpg" alt=""><h1 class="me-name">Paulo<br>Asano</h1></div>
      <p class="kicker me-role"><span class="dot" style="${dotStyle(n)}"></span>Creative Direction, Automation and AI Integration</p>
      ${n.resumo ? `<p class="lede me-lede">${esc(n.resumo)}</p>` : ''}
      <div class="prose">${n.html}</div>
      ${conns.length ? `<div class="connections"><h2>Threads</h2><ul>${conns.map((c) => `
        <li><button type="button" data-node="${c.id}"><span class="dot" style="${dotStyle(c)}"></span>${esc(c.titulo)}</button></li>`).join('')}</ul></div>` : ''}` : `
      <p class="kicker"><span class="dot" style="${dotStyle(n)}"></span>${esc(n.tipo === 'hub' ? 'Creative Direction, Automation and AI Integration' : (n.data || ''))}</p>
      ${n.logo ? `<h1 class="brand"><span class="sr">${esc(n.titulo)}</span><img class="logo-l" src="media/logos/${esc(n.logo)}.png" alt=""><img class="logo-d" src="media/logos/${esc(n.logo)}-dark.png" alt=""></h1>` : `<h1>${esc(n.titulo)}</h1>`}
      ${n.oculto ? '<span class="prov">Hidden from the public site</span>' : ''}
      ${n.resumo ? `<p class="lede">${esc(n.resumo)}</p>` : ''}
      ${n.capa ? `<img class="cover" src="${esc(n.capa)}" alt="">` : ''}
      <div class="prose">${n.html}</div>
      ${n.tags.length ? `<ul class="tags">${n.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${conns.length || n.mercado ? `<div class="connections"><h2>Threads</h2><ul>${conns.map((c) => `
        <li><button type="button" data-node="${c.id}"><span class="dot" style="${dotStyle(c)}"></span>${esc(c.titulo)}</button></li>`).join('')}</ul>${n.mercado ? `<ul class="facets">${[n.mercado, ...n.midias].map((f, i) => `<li><button type="button" class="${i ? 'f-media' : 'f-market'}" data-facet="${esc(f)}">${esc(facetLabel(f))}</button></li>`).join('')}</ul>` : ''}</div>` : ''}`;
    panel.classList.toggle('wide', n.largura === 'wide');
    // Vídeo vertical ao lado do texto: cresce até a altura da coluna de texto
    // Regra: mídia ao lado do texto (vídeo, foto ou carrossel) sempre com a mesma altura do bloco de texto
    const fitSplit = () => panel.querySelectorAll('.split').forEach((sp) => {
      const t = sp.querySelector(':scope > .split-text');
      const v = [...sp.children].find((c) => c !== t);
      if (!v || !t) return;
      if (innerWidth <= 720) { v.style.width = ''; return; }
      let ar = 240 / 426;
      if (v.tagName === 'IMG') { if (!v.naturalWidth) return v.addEventListener('load', fitSplit, { once: true }); ar = v.naturalWidth / v.naturalHeight; }
      else if (v.classList.contains('carousel')) ar = 4 / 5;
      // largura em que a altura da mídia = altura do texto (bissecção; o texto cresce quando a mídia alarga)
      let lo = 120, hi = sp.clientWidth * 0.6;
      for (let i = 0; i < 12; i++) { const w = (lo + hi) / 2; v.style.width = w + 'px'; if (w / ar < t.offsetHeight) lo = w; else hi = w; }
      v.style.width = lo.toFixed(1) + 'px';
    });
    // Mosaico das agências: miniatura de vídeo do Vimeo (clientes sem imagem na página); se falhar, o quadro sai
    panel.querySelectorAll('.ag-mosaic img[data-vimeo]').forEach((im) => {
      const tile = im.closest('a');
      fetch('https://vimeo.com/api/oembed.json?width=960&url=' + encodeURIComponent('https://vimeo.com/' + im.dataset.vimeo))
        .then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (!j.thumbnail_url) throw 0; im.src = j.thumbnail_url; })
        .catch(() => {
          // quadro sem miniatura sai, e o mosaico se reorganiza no mesmo padrão de linhas
          const m = tile.closest('.ag-mosaic'); tile.remove(); if (!m) return;
          const tiles = [...m.querySelectorAll('a')], P = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [2, 3, 2], 8: [2, 4, 2] };
          m.textContent = ''; let k = 0;
          for (const c of P[tiles.length] || [tiles.length]) { const r = document.createElement('div'); r.className = 'ag-row'; tiles.slice(k, k + c).forEach((t) => r.appendChild(t)); k += c; m.appendChild(r); }
        });
    });
    requestAnimationFrame(fitSplit); setTimeout(fitSplit, 400); setTimeout(fitSplit, 1200);
    // Carrossel de fotos: troca sozinho, setas e pontos
    panel.querySelectorAll('.carousel').forEach((c) => {
      const imgs = [...c.querySelectorAll('img')]; if (imgs.length < 2) return;
      let i = 0, timer;
      const dots = document.createElement('div'); dots.className = 'c-dots';
      dots.innerHTML = imgs.map((_, k) => `<button type="button" aria-label="Photo ${k + 1}"></button>`).join('');
      c.insertAdjacentHTML('beforeend', '<button type="button" class="c-prev" aria-label="Previous">‹</button><button type="button" class="c-next" aria-label="Next">›</button>');
      c.appendChild(dots);
      const show = (k) => { i = (k + imgs.length) % imgs.length; imgs.forEach((im, n) => im.classList.toggle('on', n === i)); [...dots.children].forEach((d, n) => d.classList.toggle('on', n === i)); };
      const auto = () => { clearInterval(timer); timer = setInterval(() => { if (!document.body.contains(c)) return clearInterval(timer); show(i + 1); }, 3800); };
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('.c-prev')) show(i - 1); else if (e.target.closest('.c-next')) show(i + 1);
        else { const d = e.target.closest('.c-dots button'); if (d) show([...dots.children].indexOf(d)); else return; }
        auto();
      });
      show(0); auto();
    });
    if (!window.__fitSplit) { window.__fitSplit = true; addEventListener('resize', () => requestAnimationFrame(fitSplit)); }
    // Vídeos com fundo transparente (WebM com alfa); Safari não mostra alfa em WebM e fica com o MP4
    const noAlpha = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!noAlpha) panel.querySelectorAll('video[data-webm]').forEach((v) => { v.poster = v.dataset.posterAlpha || v.poster; v.src = v.dataset.webm; v.classList.add('keyed'); v.play && v.play().catch(() => {}); });
    // Galeria em bento por linhas justificadas: cada linha fecha a largura inteira, sem buracos.
    // Padrão (destaque, mosaico 1+2, pares, trios) varia por cliente; vídeo ganha o destaque.
    panel.querySelectorAll('.gallery').forEach((g) => {
      const items = [...g.children];
      if (items.length < 2) return;
      const ar = (m) => (+m.getAttribute('width') || 4) / (+m.getAttribute('height') || 3);
      const fv = items.findIndex((m) => m.tagName === 'VIDEO');
      const hi = items.findIndex((m) => m.hasAttribute('data-hero'));
      if (hi >= 0) items.unshift(items.splice(hi, 1)[0]); else if (fv > 0) items.unshift(items.splice(fv, 1)[0]);
      let k = 0, seq = 0;
      const rnd = () => hash(n.id + 'b' + seq++);
      const row = (cls) => { const d = document.createElement('div'); d.className = 'brow ' + cls; g.appendChild(d); return d; };
      const put = (d, m, grow) => { m.style.flex = `${grow} 1 0`; m.style.aspectRatio = ar(m).toFixed(4); d.appendChild(m); };
      g.textContent = '';
      // 1º: destaque sozinho se for horizontal
      if (ar(items[0]) > 1.2) { put(row('solo'), items[0], 1); k = 1; }
      while (k < items.length) {
        if (items[k].hasAttribute('data-full')) { put(row('solo'), items[k], 1); k++; continue; }
        let left = 0; while (k + left < items.length && !items[k + left].hasAttribute('data-full')) left++;
        const r = rnd();
        if (left >= 3 && r < 0.4) { // mosaico: um grande + coluna com 2 empilhados
          const [A, B, C] = items.slice(k, k + 3); k += 3;
          const d = row('mosaic' + (r < 0.2 ? ' flip' : ''));
          const col = document.createElement('div'); col.className = 'bcol';
          [B, C].forEach((m) => { m.style.aspectRatio = ar(m).toFixed(4); col.appendChild(m); });
          A.style.flex = `${ar(A) * (1 / ar(B) + 1 / ar(C))} 1 0`; A.style.aspectRatio = ''; A.classList.add('fill');
          col.style.flex = '1 1 0';
          d.append(A, col);
        } else {
          const size = left <= 3 ? left : (r < 0.7 ? 2 : 3);
          const d = row('n' + size);
          items.slice(k, k + size).forEach((m) => put(d, m, ar(m))); k += size;
        }
      }
    });
    fillYears(panel);
    panel.querySelectorAll('.prose a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    panel.scrollTop = 0;
    document.title = `${n.titulo} · ${(CFG.siteName || 'workspace')}`;
  }
  function morph(n) {
    if (reduceMotion) return;
    const src = n.tipo === 'hub' ? orb : orbs.get(n.id);
    const r = src.getBoundingClientRect();
    if (!r.width) return;
    const m = document.createElement('div');
    m.className = 'morph' + (n.tipo === 'hub' ? '' : ' child');
    if (n.tipo !== 'hub') { m.style.setProperty('--c1', pairOf[n.id][0]); m.style.setProperty('--c2', pairOf[n.id][1]); }
    m.innerHTML = '<i></i>';
    document.body.appendChild(m);
    const pw = Math.min(780, innerWidth - 48), ph = Math.min(innerHeight * 0.8, 560);
    m.animate([
      { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '50%', opacity: 0.95 },
      { left: (innerWidth - pw) / 2 + 'px', top: (innerHeight - ph) / 2 + 'px', width: pw + 'px', height: ph + 'px', borderRadius: '28px', opacity: 0 },
    ], { duration: 820, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' }).onfinish = () => m.remove();
  }
  function openPanel(n, fly) {
    clearTimeout(openTimer);
    window.WS_SOUND && WS_SOUND.open();
    const wasOpen = !panel.hidden;
    if (wasOpen) { panel.classList.remove('pop'); panel.classList.add('unpop'); }
    sway = false; Graph.cameraPosition(HOME, { x: 0, y: 0, z: 0 }, reduceMotion ? 0 : 1400);
    openTimer = setTimeout(() => {
      morph(n);
      openTimer = setTimeout(() => {
        renderPanel(n);
        panel.hidden = false;
        panel.classList.remove('unpop'); void panel.offsetWidth; panel.classList.add('pop');
        document.body.classList.add('panel-open');
      }, reduceMotion ? 0 : 380);
    }, reduceMotion ? 0 : wasOpen ? 900 : 950);
  }
  function closePanel() {
    clearTimeout(openTimer);
    if (panel.hidden) return;
    stopMedia();
    panel.classList.remove('pop'); panel.classList.add('unpop');
    document.body.classList.remove('panel-open');
    document.title = window.WS_TITLE || 'Paulo Asano';
    setTimeout(() => { if (!selected) { panel.hidden = true; panel.classList.remove('unpop'); } }, 340);
  }
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.back')) { const prev = backStack.pop(); goingBack = true; return go(prev || ''); }
    if (e.target.closest('.close')) { backStack.length = 0; return go(''); }
    const t = e.target.closest('[data-node]');
    if (t) { e.preventDefault(); go(t.dataset.node); }
  });

  // Rotas: #/slug abre um nó (link direto para compartilhar)
  // Ao abrir um painel, as esferas ligadas ao nó se arrumam em volta dele, fora da área do conteúdo, para clicar direto
  function spread(n) {
    around.clear(); spreadId = null;
    if (!n) { Graph.d3ReheatSimulation(); return; }
    const ids = [...neighbors.get(n.id)].filter((m) => byId.get(m).tipo !== 'hub' && byId.get(m).x !== undefined);
    if (!ids.length) { Graph.d3ReheatSimulation(); return; }
    spreadId = n.id;
    if (n.tipo !== 'hub') around.set(n.id, { tx: 0, ty: 0, tz: -60 }); // a esfera aberta vai para trás do painel
    const w = innerWidth, h = innerHeight, g = 24;
    const pw = Math.min(n.largura === 'wide' ? Math.min(920, w - 340) : 780, w - 2 * g), ph = h * (n.largura === 'wide' ? 0.86 : 0.8);
    const L = (w - pw) / 2, T = (h - ph) / 2, pad = 34, top = 92, bottom = 70, side = 40;
    // Faixas livres em volta do painel: colunas à esquerda e à direita, e linhas em cima e embaixo quando houver espaço
    const bands = [];
    const colW = L - pad - side;
    if (colW > 24) {
      bands.push({ x0: side + colW / 2, y0: top, x1: side + colW / 2, y1: h - bottom, side: 'l' });
      bands.push({ x0: w - side - colW / 2, y0: top, x1: w - side - colW / 2, y1: h - bottom, side: 'r' });
    }
    const tGap = T - pad - 22, bGap = h - (T + ph) - pad - 40;
    if (tGap > 34) bands.push({ x0: L + 40, y0: 22 + tGap / 2, x1: L + pw - 40, y1: 22 + tGap / 2, side: 't' });
    if (bGap > 34) bands.push({ x0: L + 40, y0: T + ph + pad + bGap / 2, x1: L + pw - 40, y1: T + ph + pad + bGap / 2, side: 'b' });
    if (!bands.length) bands.push({ x0: side, y0: h - bottom / 2, x1: w - side, y1: h - bottom / 2 });
    const len = (b) => Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
    const total = bands.reduce((t, b) => t + len(b), 0);
    // Reparte as esferas entre as faixas pelo comprimento, e dentro de cada faixa em espaçamento igual
    let left = ids.length, rest = total;
    const H = HOME.z * Math.tan(((Graph.camera().fov || 40) * Math.PI / 180) / 2), pxw = 2 * H / h;
    const sorted = ids.map((id) => { const m = byId.get(id); return { id, a: Math.atan2(m.y, m.x) }; }).sort((p, q) => p.a - q.a);
    // Primeiro decide quantas vão em cada faixa, depois pega as esferas mais próximas daquele lado
    const counts = bands.map((b, i) => { const c = i === bands.length - 1 ? left : Math.round(left * len(b) / rest); left -= c; rest -= len(b); return c; });
    const pool = sorted.map((p) => p.id);
    bands.forEach((b, i) => {
      const k = counts[i]; if (!k) return;
      const cx = (b.x0 + b.x1) / 2 - w / 2, cy = (b.y0 + b.y1) / 2 - h / 2;
      pool.sort((p, q) => { const P = byId.get(p), Q = byId.get(q); return (Q.x * cx - Q.y * cy) - (P.x * cx - P.y * cy); });
      const mine = pool.splice(0, k);
      const vert = b.x0 === b.x1;
      mine.sort((p, q) => vert ? byId.get(q).y - byId.get(p).y : byId.get(p).x - byId.get(q).x);
      mine.forEach((id, j) => {
        const t = (j + 0.5) / k, x = b.x0 + (b.x1 - b.x0) * t, y = b.y0 + (b.y1 - b.y0) * t;
        around.set(id, { tx: (x - w / 2) * pxw, ty: -(y - h / 2) * pxw, tz: 0 });
      });
    });
    Graph.d3ReheatSimulation();
  }
  const backStack = []; let goingBack = false, lastRoute = '';
  function go(id) { location.hash = id ? `#/${id}` : '#/'; }
  // Esfera central: o clique vale em toda a área desenhada (o raio 3D é menor e os fios na frente roubavam o clique)
  (() => {
    let down = null;
    const g = $('#graph');
    g.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    g.addEventListener('pointerup', (e) => {
      if (!down || document.body.classList.contains('intro') || document.body.classList.contains('classic')) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (moved > 6 || dt > 600) return;
      // Uma esfera menor na frente, de fato sob o mouse, tem prioridade
      const inside = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width && Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) <= b.width / 2; };
      const front = [...orbs.values()].find((o) => +o.style.opacity > 0.15 && +(o.style.zIndex || 0) > +(orb.style.zIndex || 0) && inside(o));
      if (front) { orbGoAt = performance.now(); setTimeout(() => go(front.dataset.id), 0); return; }
      const r = orb.getBoundingClientRect(); if (!r.width || orb.style.opacity === '0') return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) <= r.width / 2) { orbGoAt = performance.now(); setTimeout(() => go(hub.id), 0); }
    });
  })();
  // Classic view: o mesmo conteúdo como site convencional, com menu no topo e sem o mapa
  let classic = false;
  const modeBtn = $('#mode-btn'), cnav = $('#cnav');
  const kidsOf = (id) => [...neighbors.get(id)].map((k) => byId.get(k)).filter((k) => k.tipo !== 'hub' && k.id !== id && !(byId.get(id).tipo === 'area' && k.tipo === 'area' && !BACK_AREAS.has(k.id)))
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));
  function buildNav() {
    const tops = [...neighbors.get(hub.id)].map((k) => byId.get(k)).filter((k) => (k.tipo === 'area' || k.tipo === 'venture') && !(CFG.classicHide || []).includes(k.id)).sort((a, b) => a.ordem - b.ordem);
    // Topo: só o nome. Menu numa coluna à esquerda, centralizada; os subitens abrem em cascata
    cnav.innerHTML = `<a class="cn-home" href="#/" data-node="">Paulo Asano</a><aside class="cside"><ul>${tops.map((t) => {
      const kids = kidsOf(t.id);
      return `<li class="cn-item${kids.length ? ' has-kids' : ''}"><a href="#/${t.id}" data-node="${t.id}">${esc(t.rotulo || t.titulo)}</a>${kids.length ? `<div class="cn-drop"><ul>${kids.map((k, i) => `<li style="--i:${i}"><a href="#/${k.id}" data-node="${k.id}">${esc(k.rotulo || k.titulo)}</a></li>`).join('')}</ul></div>` : ''}</li>`;
    }).join('')}</ul></aside>`;
  }
  // Menu lateral: centralizado pela altura no estado de repouso; ao abrir no hover cresce só para baixo (não foge do mouse)
  function placeSide() {
    const side = cnav.querySelector('.cside'), ul = side && side.querySelector(':scope > ul'); if (!ul || cnav.hidden) return;
    if (side.matches(':hover')) return;
    ul.style.marginTop = Math.max(0, (side.clientHeight - ul.offsetHeight) / 2) + 'px';
  }
  addEventListener('resize', () => requestAnimationFrame(placeSide));
  function markNav(n) {
    const top = n.tipo === 'hub' ? '' : (n.tipo === 'area' || (n.tipo === 'venture' && neighbors.get(hub.id).has(n.id))) ? n.id : [...neighbors.get(n.id)].find((k) => byId.get(k).tipo === 'area' && [...neighbors.get(hub.id)].includes(k)) || '';
    cnav.querySelectorAll('.cn-item > a').forEach((a) => a.classList.toggle('on', a.dataset.node === top || (n.tipo !== 'hub' && byId.get(a.dataset.node) && kidsOf(a.dataset.node).some((k) => k.id === n.id))));
    cnav.querySelector('.cn-home').classList.toggle('on', n.tipo === 'hub');
    cnav.querySelectorAll('.cn-item').forEach((li) => li.classList.toggle('open', li.querySelector(':scope > a').classList.contains('on')));
    cnav.querySelectorAll('.cn-drop a').forEach((a) => a.classList.toggle('on', a.dataset.node === n.id));
    requestAnimationFrame(placeSide);
  }
  function setMode(on, save = true) {
    classic = on;
    document.body.classList.toggle('classic', on);
    modeBtn.textContent = on ? 'Map view' : 'Classic view';
    modeBtn.setAttribute('aria-pressed', String(on));
    cnav.hidden = !on;
    if (save) store.set('ws-mode', on ? 'classic' : 'map');
    if (on) { if (!cnav.innerHTML) buildNav(); Graph.pauseAnimation(); route(); window.scrollTo(0, 0); }
    else {
      Graph.resumeAnimation();
      const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
      selected = null; panel.hidden = true; document.body.classList.remove('panel-open'); flyHome();
      if (byId.get(id) && id !== hub.id) setTimeout(route, 200); else if (location.hash !== '#/') history.replaceState(null, '', '#/');
    }
  }
  modeBtn.addEventListener('click', () => setMode(!classic));
  cnav.addEventListener('click', (e) => { const a = e.target.closest('a[data-node]'); if (!a) return; e.preventDefault(); go(a.dataset.node); panel.scrollTop = 0; });
  // Para qualquer vídeo do painel na hora (fechar, voltar, Esc, clique fora, pular de página, Classic)
  function stopMedia() {
    panel.querySelectorAll('iframe').forEach((f) => { const src = f.getAttribute('src'); if (src && src !== 'about:blank') { f.dataset.src = src; f.setAttribute('src', 'about:blank'); } });
    panel.querySelectorAll('video').forEach((v) => { if (!v.muted) v.pause(); });
  }
  function route() {
    if (document.body.classList.contains('intro')) return;
    stopMedia();
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    // Seta de voltar: só aparece quando se pula de uma página aberta direto para outra
    if (!goingBack && lastRoute && byId.get(lastRoute) && byId.get(id) && id !== lastRoute) backStack.push(lastRoute);
    if (!byId.get(id) && !classic) backStack.length = 0;
    goingBack = false; lastRoute = id;
    $('#panel .back').hidden = !backStack.length;
    if (classic) {
      const c = byId.get(id) || hub;
      selected = c; clearTimeout(openTimer); renderPanel(c); panel.hidden = false; panel.classList.remove('unpop', 'pop');
      markNav(c); window.WS_TRACK && WS_TRACK.node(c.id);
      return;
    }
    const n = byId.get(id);
    if (n) {
      if (calling) { orbs.get(calling)?.classList.remove('calling', 'alive'); calling = null; }
      selected = n; openPanel(n); window.WS_TRACK && WS_TRACK.node(n.id);
      spread(n);
    } else if (selected) {
      selected = null; closePanel(); flyHome(); spread(null); window.WS_SOUND && (WS_SOUND.close(), WS_SOUND.duck(false));
    }
    refresh();
  }
  addEventListener('hashchange', route);
  // Vídeo tocando no painel (Vimeo/YouTube): a trilha pausa e só volta quando o painel fecha
  addEventListener('message', (e) => {
    let host = ''; try { host = new URL(e.origin).hostname; } catch (x) { return; }
    if (!/(^|\.)vimeo\.com$/.test(host)) return;
    let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
    if (!d || !d.event) return;
    if (d.event === 'ready') e.source && e.source.postMessage(JSON.stringify({ method: 'addEventListener', value: 'play' }), e.origin);
    if (d.event === 'play' || d.event === 'playing') window.WS_SOUND && WS_SOUND.duck(true);
  });
  // Plano B: clicar dentro de um vídeo embutido tira o foco da página
  addEventListener('blur', () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'IFRAME' && a.closest('#panel')) window.WS_SOUND && WS_SOUND.duck(true); }, 0));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#results').hidden) return hideResults(); if (selected) go(''); }
  });

  // Abas do Portfolio (por cliente, setor, entrega)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.views [data-view]');
    if (!b) return;
    const box = b.closest('.prose');
    box.querySelectorAll('.views button').forEach((x) => x.classList.toggle('on', x === b));
    box.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === b.dataset.view));
  });

  // Filtro de setores em Clients
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.chips [data-filter]');
    if (!b) return;
    const box = b.closest('.prose'), f = b.dataset.filter;
    box.querySelectorAll('.chips button').forEach((x) => x.classList.toggle('on', x === b));
    box.querySelectorAll('ul.logos').forEach((ul) => {
      let any = false;
      ul.querySelectorAll('li').forEach((li) => { const on = f === 'all' || (li.dataset.tags || li.dataset.sector || '').split(' ').includes(f); li.classList.toggle('off', !on); any = any || on; });
      ul.classList.toggle('off', !any);
    });
    box.querySelectorAll('h3.sector').forEach((h) => {
      let el = h.nextElementSibling, any = false;
      while (el && !el.matches('h3.sector')) { if (el.matches('ul.logos') && !el.classList.contains('off')) any = true; el = el.nextElementSibling; }
      h.classList.toggle('off', !any);
    });
  });

  // Feedback: botão no canto inferior esquerdo, formulário com o nome da trava já preenchido
  (() => {
    const ep = (CFG.feedback && CFG.feedback.endpoint) || '';
    const btn = $('#fb-open'), box = $('#fb'), f = $('#fb-form'), err = $('#fb-error'), ok = $('#fb-done');
    if (!btn) return;
    btn.hidden = !(ep || /[?&]review\b/.test(location.search));
    const close = () => { box.hidden = true; document.body.classList.remove('fb-on'); };
    btn.addEventListener('click', () => {
      const v = store.get('ws-visitor');
      if (v && v.name && !f.name.value) f.name.value = v.name;
      err.hidden = true; ok.hidden = true; f.classList.remove('sent');
      box.hidden = false; document.body.classList.add('fb-on');
      setTimeout(() => (f.name.value ? f.message : f.name).focus(), 60);
    });
    $('#fb-close').addEventListener('click', close);
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) { close(); e.stopImmediatePropagation(); } }, true);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = f.name.value.trim(), message = f.message.value.trim(), linkedin = f.linkedin.value.trim();
      if (name.length < 2) { err.textContent = 'Please tell me your name.'; err.hidden = false; return f.name.focus(); }
      if (message.length < 2) { err.textContent = 'Please write your feedback.'; err.hidden = false; return f.message.focus(); }
      if (f.website.value) return; // honeypot
      if (!ep) { err.textContent = 'Feedback is not connected yet.'; err.hidden = false; return; }
      err.hidden = true; f.classList.add('sending');
      try {
        await fetch(ep, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ name, linkedin, message, page: location.hash, lang: navigator.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
        f.classList.add('sent'); ok.hidden = false; f.message.value = '';
        setTimeout(close, 2600);
      } catch (x) { err.textContent = 'Something went wrong. Please try again.'; err.hidden = false; }
      f.classList.remove('sending');
    });
  })();

  // Lightbox das galerias
  document.addEventListener('click', (e) => {
    const img = e.target.closest('.gallery img, .gallery video');
    if (!img) return;
    const lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = img.tagName === 'VIDEO' ? `<video src="${img.getAttribute('src')}" autoplay muted loop playsinline></video>` : `<img src="${img.getAttribute('src')}" alt="">`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const lb = $('.lightbox'); if (lb) { lb.remove(); e.stopImmediatePropagation(); } } }, true);

  // Busca
  const search = $('.search'), input = $('#search'), results = $('#results');
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plain = (html) => html.replace(/<[^>]+>/g, ' ');
  function hideResults() { results.hidden = true; }
  $('#search-btn').addEventListener('click', () => input.focus());
  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    if (!q) return hideResults();
    const hits = data.nodes.filter((n) => !n.oculto || REVIEW).map((n) => {
      const title = norm(n.titulo), body = norm(`${n.resumo} ${n.tags.join(' ')} ${plain(n.html)}`), kw = (n.kw || []).map(norm);
      const k = kw.some((w) => w === q) ? 2.8 : q.length > 2 && kw.some((w) => w.startsWith(q)) ? 2.4 : q.length > 3 && kw.some((w) => w.includes(q)) ? 1.5 : 0;
      return { n, score: Math.max(title.startsWith(q) ? 3 : title.includes(q) ? 2 : body.includes(q) ? 1 : 0, k) };
    }).filter((h) => h.score).sort((a, b) => b.score - a.score).slice(0, 8);
    results.innerHTML = hits.length ? hits.map(({ n }) =>
      `<li><button type="button" data-node="${n.id}"><span class="dot" style="${dotStyle(n)}"></span>${esc(n.titulo)}</button></li>`).join('')
      : '<li class="none">No results</li>';
    results.hidden = false;
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = results.querySelector('[data-node]'); if (b) b.click(); } });
  results.addEventListener('click', (e) => { const b = e.target.closest('[data-node]'); if (b) { go(b.dataset.node); input.value = ''; hideResults(); input.blur(); } });

  // Abertura: cada frase entra no centro e sobe, formando um bloco. Depois, nome e convite.
  const linesEl = $('#lines');
  const sentences = linesEl.dataset.text.split('|');
  const lineEls = sentences.map((t, i) => {
    const d = document.createElement('div');
    d.className = 'line' + (i === 0 ? ' first' : '');
    d.innerHTML = `<div><p>${t}</p></div>`;
    linesEl.appendChild(d); return d;
  });
  fillYears(linesEl);
  linesEl.querySelectorAll('.site-name').forEach((el) => (el.textContent = CFG.siteName || 'workspace'));
  const visitor = store.get('ws-visitor');
  const needGate = CFG.gate !== false && !(visitor && visitor.name);
  const deepLink = byId.get(decodeURIComponent(location.hash.replace(/^#\/?/, '')));
  let shownLines = 0, lineTimer = null, done = false;
  const wrap = $('#intro-wrap');
  // O bloco visível fica sempre centralizado na vertical; cada frase nova entra embaixo e o bloco se recentraliza
  function placeCentered() {
    const y = (innerHeight - wrap.offsetHeight) / 2;
    wrap.style.transform = `translate(-50%, ${y.toFixed(1)}px)`;
  }
  addEventListener('resize', () => { if (!document.body.classList.contains('intro')) return; placeCentered(); });
  const continues = (el) => !/[.?!]\s*$/.test(el.textContent.trim());
  function nextLine() {
    clearTimeout(lineTimer);
    if (shownLines >= lineEls.length) return finishLines();
    lineEls.forEach((l) => l.classList.remove('latest'));
    const l = lineEls[shownLines++];
    l.classList.add('on', 'latest');
    placeCentered();
    requestAnimationFrame(() => requestAnimationFrame(() => l.classList.add('in')));
    // Frase quebrada em 2 linhas: a segunda entra quase junto
    if (continues(l) && shownLines < lineEls.length) { lineTimer = setTimeout(nextLine, reduceMotion ? 0 : 260); return; }
    const words = l.textContent.split(/\s+/).length;
    lineTimer = setTimeout(nextLine, reduceMotion ? 200 : shownLines === 1 ? 2800 : 1050 + words * 75);
  }
  function finishLines() {
    if (done) return; done = true;
    clearTimeout(lineTimer);
    lineEls.forEach((l) => { l.classList.add('on', 'in'); l.classList.remove('latest'); });
    $('#skip').hidden = true;
    $('.intro-below').classList.add('show');
    placeCentered();
    setTimeout(() => {
      if (needGate) { $('#gate').classList.add('on'); setTimeout(() => $('#gate input[name=name]').focus({ preventScroll: true }), 400); }
      else showWelcome();
    }, reduceMotion ? 0 : 500);
  }
  function showWelcome() {
    $('#gate').classList.remove('on');
    $('#welcome').classList.add('on');
    placeCentered();
    setTimeout(() => $('#enter').focus({ preventScroll: true }), 500);
  }
  $('#skip').addEventListener('click', finishLines);
  $('#intro').addEventListener('click', (e) => { if (!done && !e.target.closest('form,button')) nextLine(); });

  $('#gate').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, err = $('#gate-error');
    const name = f.name.value.trim();
    if (name.length < 2) { err.textContent = 'Please tell me your name.'; err.hidden = false; return f.name.focus(); }
    err.hidden = true;
    const v = { name, at: new Date().toISOString() };
    store.set('ws-visitor', v);
    window.WS_TRACK && WS_TRACK.identify(v);
    showWelcome();
  });

  function enter() {
    clearTimeout(lineTimer);
    if (params.has('classic') || store.get('ws-mode') === 'classic') { document.body.classList.remove('intro'); while (grown < order.length) grow(); setMode(true, params.has('classic') ? false : true); return; }
    if (!reduceMotion) { entryT0 = performance.now(); orb.classList.add('entering'); document.body.classList.add('entering'); }
    document.body.classList.remove('intro');
    while (grown < order.length) grow();
    setTimeout(() => {
      const target = (deepLink || hub || {}).id;
      if (!target) return;
      if (location.hash === '#/' + target) route(); else go(target);
    }, reduceMotion ? 0 : ENTRY_MS + 500);
  }
  $('#enter').addEventListener('click', () => { if (window.WS_SOUND) { WS_SOUND.start(); setTimeout(() => WS_SOUND.enter(), 60); } enter(); });

  if (SKIP || (deepLink && !needGate)) enter();
  else setTimeout(nextLine, reduceMotion ? 0 : 900);
})();

// Arquivo (só no ?review): bolinha tracejada ao lado da busca, lista as páginas prontas e guardadas
(function () {
  if (!/[?&]review\b/.test(location.search)) return;
  const finder = document.querySelector('.finder .search'); if (!finder || !window.WORKSPACE) return;
  const kept = WORKSPACE.nodes.filter((n) => n.oculto && n.tipo === 'work').sort((a, b) => a.titulo.localeCompare(b.titulo));
  if (!kept.length) return;
  const wrap = document.createElement('div'); wrap.className = 'archive';
  wrap.innerHTML = `<button type="button" class="archive-orb" aria-label="Archive: ${kept.length} hidden pages" title="Archive"><i></i><b>${kept.length}</b></button>
    <div class="archive-list" hidden><p>Archive · hidden pages</p><ul>${kept.map((n) => `<li><a href="#/${n.id}">${n.titulo}</a></li>`).join('')}</ul></div>`;
  finder.parentNode.insertBefore(wrap, finder);
  finder.parentNode.classList.add('has-archive');
  const list = wrap.querySelector('.archive-list');
  wrap.querySelector('.archive-orb').addEventListener('click', (e) => { e.stopPropagation(); list.hidden = !list.hidden; });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) list.hidden = true; });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) list.hidden = true; });
})();
