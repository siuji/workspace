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
  const sizeOf = (n) => (n.tipo === 'hub' ? 22 : n.tipo === 'area' ? 8 + n.grau * 0.6 : 2 + n.grau * 0.8);
  // Camadas: o profissional fica à frente; o pessoal vai para trás, menor e mais apagado
  const BACK_AREAS = new Set(CFG.backAreas || ['personal', 'endurance', 'photography', 'social', 'tools', 'education']);
  const back = new Set();
  for (const id of BACK_AREAS) {
    if (!byId.has(id)) continue;
    const q = [id]; back.add(id);
    while (q.length) { const c = q.shift(); for (const m of neighbors.get(c)) { const t = byId.get(m); if (back.has(m) || t.tipo === 'hub' || (t.tipo === 'area' && !BACK_AREAS.has(m))) continue; back.add(m); q.push(m); } }
  }
  const isBack = (n) => back.has(n.id);

  // A teia nasce já assentada (sem tranco) e os nós vão acendendo aos poucos
  const revealed = new Set();
  const Graph = ForceGraph3D({ controlType: 'orbit' })($('#graph'))
    .backgroundColor('rgba(0,0,0,0)')
    .showNavInfo(false)
    .graphData({ nodes: data.nodes, links: data.links })
    .warmupTicks(220)
    .cooldownTime(6000)
    .d3VelocityDecay(0.55)
    .linkVisibility((l) => { const [a, b] = linkEnds(l); return revealed.has(a) && revealed.has(b); })
    .nodeId('id')
    .nodeVal(sizeOf)
    .nodeRelSize(4)
    .nodeOpacity(0)
    .nodeResolution(8)
    .nodeLabel(() => '')
    .linkColor((l) => (linkLit(l) ? '#e8795a' : linkCall(l) ? pairOf[calling][0] : isLight() ? 'rgba(40,34,50,0.22)' : 'rgba(232,222,210,0.18)'))
    .linkWidth((l) => (linkLit(l) ? 0.7 : linkCall(l) ? 0.55 : 0.3))
    .linkOpacity(0.55)
    .linkDirectionalParticles((l) => (reduceMotion ? 0 : linkLit(l) || linkCall(l) ? 4 : 1))
    .linkDirectionalParticleSpeed((l) => (linkLit(l) ? 0.012 : linkCall(l) ? 0.008 : 0.003))
    .linkDirectionalParticleWidth((l) => (linkLit(l) ? 1.6 : 1))
    .linkDirectionalParticleColor(() => (isLight() ? '#c46a8e' : '#f3c2ae'))
    .onNodeHover((n) => { hovered = n || null; $('#graph').style.cursor = n ? 'pointer' : ''; refresh(); wantLift(n); })
    .onNodeClick((n) => { if (!document.body.classList.contains('intro')) go(n.id); })
    .onBackgroundClick(() => { if (selected) go(''); });

  if (params.has('debug')) window.WS_GRAPH = Graph;
  Graph.d3Force('charge').strength((n) => (back.has(n.id) ? -70 : -180));
  Graph.d3Force('link').distance((l) => { const [a, b] = linkEnds(l); const t = [byId.get(a).tipo, byId.get(b).tipo]; const base = t.includes('hub') ? (back.has(a) || back.has(b) ? 90 : 130) : t.includes('area') ? 70 : 50; return spreadId && (a === spreadId || b === spreadId) && !t.includes('hub') ? base * 1.9 : base; });
  // Contenção: a teia ocupa a janela toda (elipsoide mais largo em telas largas) sem fugir das bordas
  const R = 230;
  const shape = () => ({ rx: R * Math.min(1.6, Math.max(1, innerWidth / innerHeight)), ry: R, rz: R });
  Graph.d3Force('contain', (alpha) => {
    const { rx, ry, rz } = shape();
    for (const n of data.nodes) {
      if (n.fx !== undefined || n.x === undefined) continue;
      n.vx += n.x * 0.006 * alpha * (rx / ry - 1);
      const k = Math.hypot(n.x / rx, n.y / ry, n.z / rz);
      if (back.has(n.id)) { const r = Math.hypot(n.x, n.y, n.z); if (r > 120) { const g = (1 - 120 / r) * 0.6 * alpha; n.vx -= n.x * g; n.vy -= n.y * g; n.vz -= n.z * g; } }
      if (k > 0.85) { const f = (1 - 0.85 / k) * 0.7 * alpha; n.vx -= n.x * f; n.vy -= n.y * f; n.vz -= n.z * f; }
    }
  });
  // Distância da câmera calculada para a altura da teia caber na janela
  const fitDist = () => { const fov = (Graph.camera().fov || 40) * Math.PI / 180; return (R * 0.88) / Math.tan(fov / 2); };
  const HOME = { x: 0, y: 0, z: fitDist() };
  Graph.cameraPosition(HOME);

  // Na abertura a teia sobe um pouco para dar espaço ao texto
  const controls = Graph.controls();
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.35;
  controls.enableDamping = true;
  controls.addEventListener('start', () => { controls.autoRotate = false; $('#hint').style.opacity = 0; });
  addEventListener('resize', () => {
    Graph.width(innerWidth).height(innerHeight);
    HOME.z = fitDist();
    if (!selected) { const c = Graph.camera().position, len = Math.hypot(c.x, c.y, c.z) || 1, f = Math.hypot(HOME.y, HOME.z) / len; Graph.cameraPosition({ x: c.x * f, y: c.y * f, z: c.z * f }); }
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
  const labels = new Map(), orbs = new Map();
  for (const n of data.nodes) {
    if (n.tipo !== 'hub') {
      const o = document.createElement('div');
      o.className = 'node-orb' + (n.oculto ? ' hidden-node' : '');
      const [c1, c2] = pairOf[n.id];
      const h = hash(n.id + 'h');
      o.style.cssText = `--c1:${c1};--c2:${c2};--t:${(5 + h * 4).toFixed(1)}s;--delay:-${(h * 6).toFixed(1)}s;filter:hue-rotate(${Math.round(h * 36 - 18)}deg) saturate(.92);opacity:0`;
      o.innerHTML = '<i></i>';
      orbLayer.appendChild(o); orbs.set(n.id, o);
      const el = document.createElement('div');
      el.className = 'label' + (n.tipo === 'area' ? ' big' : '');
      el.textContent = n.rotulo || n.titulo;
      el.style.opacity = 0;
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
  function draw() {
    stepLift();
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
        let d = Math.max(40, Math.abs(q.y - p.y) * 2);
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
      const near = Math.max(0, Math.min(1, (560 - dist) / 260));
      let o = n.tipo === 'area' ? Math.max(0.6, near) : near;
      if (isBack(n)) o *= 0.6;
      if (f) o = n.id === f || neighbors.get(f).has(n.id) ? 1 : 0.08;
      if (n.id === calling && !f) o = Math.max(o, 0.85);
      el.style.opacity = o.toFixed(2);
      el.style.transform = `translate(${(p.x + d / 2 + 8).toFixed(1)}px, ${(p.y - 6).toFixed(1)}px)`;
      el.style.zIndex = ob.style.zIndex;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // De tempos em tempos uma esfera e seus fios chamam o clique
  function call() {
    if (calling) orbs.get(calling)?.classList.remove('calling');
    calling = null;
    if (!selected && !document.hidden && !reduceMotion) {
      const pool = data.nodes.filter((n) => n.tipo !== 'hub' && n.x !== undefined && !isBack(n));
      const areaFirst = pool.filter((n) => n.tipo === 'area');
      const list = Math.random() < 0.6 && areaFirst.length ? areaFirst : pool;
      const n = list[Math.floor(Math.random() * list.length)];
      if (n) { calling = n.id; orbs.get(n.id).classList.add('calling'); }
    }
    refresh();
    setTimeout(call, calling ? 5200 : 2400);
  }
  setTimeout(call, 4000);

  // Câmera com partida e chegada suaves
  function flyTo(n, ms) {
    if (n.x === undefined) return;
    const d = 210;
    const len = Math.hypot(n.x, n.y, n.z);
    const pos = len < 1 ? { x: -200, y: 90, z: d * 2.5 } : { x: n.x * (1 + d / len), y: n.y * (1 + d / len), z: n.z * (1 + d / len) };
    controls.autoRotate = false;
    Graph.cameraPosition(pos, { x: n.x, y: n.y, z: n.z }, reduceMotion ? 0 : ms);
  }
  function flyHome() {
    Graph.cameraPosition(HOME, { x: 0, y: 0, z: 0 }, reduceMotion ? 0 : 1600);
    setTimeout(() => (controls.autoRotate = !reduceMotion), 1700);
  }

  // Painel: a esfera clicada vem para frente e se expande numa tela de vidro
  const panel = $('#panel');
  let openTimer = null;
  function renderPanel(n) {
    const conns = [...neighbors.get(n.id)].map((id) => byId.get(id))
      .sort((a, b) => (a.tipo === 'hub' ? -1 : b.tipo === 'hub' ? 1 : a.ordem - b.ordem || a.titulo.localeCompare(b.titulo)));
    const type = TYPES[n.tipo] || { label: n.tipo };
    $('#panel-body').innerHTML = `
      <p class="kicker"><span class="dot" style="${dotStyle(n)}"></span>${esc(n.tipo === 'hub' ? 'Creative Direction, Automation and AI Integration' : (n.data || ''))}</p>
      ${n.logo ? `<h1 class="brand"><span class="sr">${esc(n.titulo)}</span><img class="logo-l" src="media/logos/${esc(n.logo)}.png" alt=""><img class="logo-d" src="media/logos/${esc(n.logo)}-dark.png" alt=""></h1>` : `<h1>${esc(n.titulo)}</h1>`}
      ${n.oculto ? '<span class="prov">Hidden from the public site</span>' : ''}
      ${n.resumo ? `<p class="lede">${esc(n.resumo)}</p>` : ''}
      ${n.capa ? `<img class="cover" src="${esc(n.capa)}" alt="">` : ''}
      <div class="prose">${n.html}</div>
      ${n.tags.length ? `<ul class="tags">${n.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${conns.length ? `<div class="connections"><h2>Threads</h2><ul>${conns.map((c) => `
        <li><button type="button" data-node="${c.id}"><span class="dot" style="${dotStyle(c)}"></span>${esc(c.titulo)}</button></li>`).join('')}</ul></div>` : ''}`;
    panel.classList.toggle('wide', n.largura === 'wide');
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
    const wasOpen = !panel.hidden;
    if (wasOpen) { panel.classList.remove('pop'); panel.classList.add('unpop'); }
    flyTo(n, 1400);
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
    panel.classList.remove('pop'); panel.classList.add('unpop');
    document.body.classList.remove('panel-open');
    document.title = window.WS_TITLE || 'Paulo Asano';
    setTimeout(() => { if (!selected) { panel.hidden = true; panel.classList.remove('unpop'); } }, 340);
  }
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.close')) return go('');
    const t = e.target.closest('[data-node]');
    if (t) { e.preventDefault(); go(t.dataset.node); }
  });

  // Rotas: #/slug abre um nó (link direto para compartilhar)
  // Ao entrar num nó com vários filhos, ele fica parado e os filhos se abrem em volta
  function spread(n) {
    if (n.tipo === 'hub' || spreadId === n.id) return;
    const kids = [...neighbors.get(n.id)].filter((m) => byId.get(m).tipo !== 'hub').length;
    const prev = spreadId && byId.get(spreadId);
    if (prev) { prev.fx = prev.fy = prev.fz = undefined; }
    spreadId = kids >= 3 ? n.id : null;
    if (!spreadId) return;
    n.fx = n.x; n.fy = n.y; n.fz = n.z;
    Graph.d3Force('link').distance(Graph.d3Force('link').distance());
    Graph.d3ReheatSimulation();
  }
  function go(id) { location.hash = id ? `#/${id}` : '#/'; }
  function route() {
    if (document.body.classList.contains('intro')) return;
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const n = byId.get(id);
    if (n) {
      if (calling) { orbs.get(calling)?.classList.remove('calling'); calling = null; }
      selected = n; openPanel(n); window.WS_TRACK && WS_TRACK.node(n.id);
      spread(n);
    } else if (selected) {
      selected = null; closePanel(); flyHome();
    }
    refresh();
  }
  addEventListener('hashchange', route);
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
    const hits = data.nodes.map((n) => {
      const title = norm(n.titulo), body = norm(`${n.resumo} ${n.tags.join(' ')} ${plain(n.html)}`);
      return { n, score: title.startsWith(q) ? 3 : title.includes(q) ? 2 : body.includes(q) ? 1 : 0 };
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
    if (!reduceMotion) { entryT0 = performance.now(); orb.classList.add('entering'); document.body.classList.add('entering'); }
    document.body.classList.remove('intro');
    while (grown < order.length) grow();
    setTimeout(() => {
      const target = (deepLink || hub || {}).id;
      if (!target) return;
      if (location.hash === '#/' + target) route(); else go(target);
    }, reduceMotion ? 0 : ENTRY_MS + 500);
  }
  $('#enter').addEventListener('click', enter);

  if (SKIP || (deepLink && !needGate)) enter();
  else setTimeout(nextLine, reduceMotion ? 0 : 900);
})();
