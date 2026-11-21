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

  let selected = null, hovered = null, calling = null;
  const focusId = () => (hovered || selected)?.id;
  const linkEnds = (l) => [typeof l.source === 'object' ? l.source.id : l.source, typeof l.target === 'object' ? l.target.id : l.target];
  const linkLit = (l) => { const f = focusId(); if (!f) return false; const [a, b] = linkEnds(l); return a === f || b === f; };
  const linkCall = (l) => calling && linkEnds(l).includes(calling);
  const sizeOf = (n) => (n.tipo === 'hub' ? 22 : n.tipo === 'area' ? 8 + n.grau * 0.6 : 2 + n.grau * 0.8);
  // Camadas: o profissional fica à frente; o pessoal vai para trás, menor e mais apagado
  const BACK_AREAS = new Set(CFG.backAreas || ['endurance', 'photography', 'social', 'tools', 'education']);
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
    .onNodeHover((n) => { hovered = n || null; $('#graph').style.cursor = n ? 'pointer' : ''; refresh(); })
    .onNodeClick((n) => { if (!document.body.classList.contains('intro')) go(n.id); })
    .onBackgroundClick(() => { if (selected) go(''); });

  Graph.d3Force('charge').strength(-180);
  Graph.d3Force('link').distance((l) => { const [a, b] = linkEnds(l); const t = [byId.get(a).tipo, byId.get(b).tipo]; return t.includes('hub') ? (back.has(a) || back.has(b) ? 300 : 150) : t.includes('area') ? 70 : 50; });
  const HOME = { x: 0, y: 40, z: 520 };
  Graph.cameraPosition(HOME);

  // Na abertura a teia sobe um pouco para dar espaço ao texto
  const controls = Graph.controls();
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.35;
  controls.enableDamping = true;
  controls.addEventListener('start', () => { controls.autoRotate = false; $('#hint').style.opacity = 0; });
  addEventListener('resize', () => Graph.width(innerWidth).height(innerHeight));

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
  function draw() {
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
        const d = Math.max(40, Math.abs(q.y - p.y) * 2);
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
      const d = Math.max(6, Math.abs(q.y - p.y) * 2);
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
      <h1>${esc(n.titulo)}</h1>
      ${n.oculto ? '<span class="prov">Hidden from the public site</span>' : ''}
      ${n.resumo ? `<p class="lede">${esc(n.resumo)}</p>` : ''}
      ${n.capa ? `<img class="cover" src="${esc(n.capa)}" alt="">` : ''}
      <div class="prose">${n.html}</div>
      ${n.tags.length ? `<ul class="tags">${n.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${conns.length ? `<div class="connections"><h2>Threads</h2><ul>${conns.map((c) => `
        <li><button type="button" data-node="${c.id}"><span class="dot" style="${dotStyle(c)}"></span>${esc(c.titulo)}</button></li>`).join('')}</ul></div>` : ''}`;
    panel.classList.toggle('wide', n.largura === 'wide');
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
  function go(id) { location.hash = id ? `#/${id}` : '#/'; }
  function route() {
    if (document.body.classList.contains('intro')) return;
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const n = byId.get(id);
    if (n) {
      if (calling) { orbs.get(calling)?.classList.remove('calling'); calling = null; }
      selected = n; openPanel(n); window.WS_TRACK && WS_TRACK.node(n.id);
    } else if (selected) {
      selected = null; closePanel(); flyHome();
    }
    refresh();
  }
  addEventListener('hashchange', route);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#results').hidden) return hideResults(); if (selected) go(''); }
  });

  // Lightbox das galerias
  document.addEventListener('click', (e) => {
    const img = e.target.closest('.gallery img');
    if (!img) return;
    const lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = `<img src="${img.getAttribute('src')}" alt="">`;
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
    document.body.classList.remove('intro');
    while (grown < order.length) grow();
    setTimeout(() => {
      const target = (deepLink || hub || {}).id;
      if (!target) return;
      if (location.hash === '#/' + target) route(); else go(target);
    }, reduceMotion ? 0 : 2000);
  }
  $('#enter').addEventListener('click', enter);

  if (SKIP || (deepLink && !needGate)) enter();
  else setTimeout(nextLine, reduceMotion ? 0 : 900);
})();
