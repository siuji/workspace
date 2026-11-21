#!/usr/bin/env node
// workspace: transforma a pasta content/ (markdown com [[links]]) em um site estático em dist/.
// Uso:
//   node build.js          gera dist/
//   node build.js --serve  gera dist/, abre um servidor local em http://localhost:4321 e refaz a cada alteração
// Sem dependências externas: só Node 18+.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { marked } = require('./tools/marked.umd.js');
// Palavras extras da busca (content/keywords.json): sinônimos em inglês e português por nó
let KEYWORDS = {};
try { KEYWORDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'keywords.json'), 'utf8')); } catch (e) { console.warn('keywords.json: ' + e.message); }

const ROOT = __dirname;
const CONTENT = path.join(ROOT, 'content');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4321;

// Tipos de nó conhecidos. Um tipo novo funciona sem mexer aqui (ganha cor neutra);
// para dar cor e nome próprios, adicione uma linha.
const TYPES = {
  hub:     { label: 'Paulo',   color: '#f1ece3' },
  area:    { label: 'Area',    color: '#e8795a' },
  work:    { label: 'Work',    color: '#72b9e2' },
  venture: { label: 'Venture', color: '#bdb3a5' },
  life:    { label: 'Life',    color: '#86d2a2' },
  path:    { label: 'Path',    color: '#ad92e4' },
};

// Anos de carreira: sempre calculados a partir de janeiro de 1999 (o site recalcula no navegador também).
const CAREER_START = new Date(1999, 0, 1);
const careerYears = () => { const d = new Date(); let y = d.getFullYear() - CAREER_START.getFullYear(); if (d.getMonth() < CAREER_START.getMonth()) y--; return y; };

const slugify = (s) =>
  s.toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\.md$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Frontmatter simples: chave: valor, listas [a, b] ou com "- item" nas linhas seguintes.
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  let lastKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && lastKey) {
      if (!Array.isArray(data[lastKey])) data[lastKey] = [];
      data[lastKey].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    lastKey = kv[1];
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((x) => unquote(x.trim())).filter(Boolean);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    else v = unquote(v);
    data[lastKey] = v === '' ? [] : v;
  }
  return { data, body: raw.slice(m[0].length) };
}
const unquote = (s) => s.replace(/^["'](.*)["']$/, '$1');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || e.name.startsWith('_')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const HIDDEN = new Set();
function makeGraph(notes, review = false) {
  // Resolve [[links]] pelo nome do arquivo (como o Obsidian) ou pelo título.
  const index = new Map();
  for (const n of notes) {
    index.set(n.id, n.id);
    if (n.data.titulo) index.set(slugify(n.data.titulo), n.id);
    for (const a of [].concat(n.data.apelidos || [])) index.set(slugify(a), n.id);
  }

  const byIdNote = new Map(notes.map((n) => [n.id, n]));
  const links = new Map(); // "a|b" -> {source, target}
  const warnings = [];
  const addLink = (a, b) => {
    if (a === b) return;
    const key = [a, b].sort().join('|');
    if (!links.has(key)) links.set(key, { source: a, target: b });
  };

  const nodes = notes.map((n) => {
    const out = new Set();
    let md = n.body.replace(/\{\{years\}\}/g, `<span class="years">${careerYears()}</span>`);
    // Imagens no estilo Obsidian: ![[foto.jpg]]
    md = md.replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, f, alt) => `![${alt || ''}](media/${encodeURI(path.basename(f.trim()))})`);
    // Links: [[alvo]] ou [[alvo|texto]]
    md = md.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, target, text) => {
      const id = index.get(slugify(target));
      const label = (text || (id && byIdNote.get(id).data.titulo) || target).trim();
      if (!id) { warnings.push(`${n.file}: link para "${target}" não encontrado`); return `<span class="broken">${esc(label)}</span>`; }
      out.add(id);
      return `<a href="#/${id}" data-node="${id}">${esc(label)}</a>`;
    });
    // Imagens markdown com caminho relativo apontando para media/
    md = md.replace(/\]\((?:\.\.\/)*(?:content\/)?media\//g, '](media/');
    for (const extra of [].concat(n.data.conecta || [])) {
      const id = index.get(slugify(extra));
      if (id) out.add(id); else if (!HIDDEN.has(slugify(extra))) warnings.push(`${n.file}: "conecta: ${extra}" não encontrado`);
    }
    for (const id of out) addLink(n.id, id);

    const tipo = n.data.tipo || 'life';
    return {
      id: n.id,
      titulo: n.data.titulo || n.base,
      rotulo: n.data.rotulo || String(n.data.titulo || n.base).replace(/\s*\(.*?\)\s*/g, '').trim(),
      tipo,
      resumo: n.data.resumo || '',
      tags: [].concat(n.data.tags || []),
      kw: KEYWORDS[n.id] || [],
      data: n.data.data ? String(n.data.data) : '',
      capa: n.data.capa ? `media/${path.basename(String(n.data.capa))}` : '',
      placeholder: n.data.status === 'placeholder',
      largura: n.data.largura || '',
      logo: n.data.logo ? String(n.data.logo) : '',
      oculto: n.data.publicar === false,
      ordem: typeof n.data.ordem === 'number' ? n.data.ordem : 100,
      html: marked.parse(md),
    };
  });

  // Grau de cada nó para o tamanho
  const degree = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  for (const l of links.values()) { degree[l.source]++; degree[l.target]++; }
  nodes.forEach((n) => (n.grau = degree[n.id]));

  const types = { ...TYPES };
  for (const n of nodes) if (!types[n.tipo]) types[n.tipo] = { label: n.tipo, color: '#8a8f98' };

  const graph = { geradoEm: new Date().toISOString(), tipos: types, nodes, links: [...links.values()] };
  return { graph, warnings, types, nodes };
}

function build() {
  const t0 = Date.now();
  const files = walk(CONTENT).filter((f) => f.endsWith('.md'));
  const all = files.map((file) => {
    const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const base = path.basename(file, '.md');
    return { id: slugify(base), base, file: path.relative(ROOT, file), data, body };
  });
  for (const n of all) if (n.data.publicar === false) HIDDEN.add(n.id);
  const pub = makeGraph(all.filter((n) => n.data.publicar !== false));
  const review = makeGraph(all, true);
  const { graph, warnings, types, nodes } = pub;


  // Monta dist/
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync(SITE, DIST, { recursive: true });
  const media = path.join(CONTENT, 'media');
  if (fs.existsSync(media)) fs.cpSync(media, path.join(DIST, 'media'), { recursive: true });
  // graph.js (e não .json) para o site abrir até com duplo clique no index.html, sem servidor
  fs.writeFileSync(path.join(DIST, 'graph.js'), `window.WORKSPACE = ${JSON.stringify(graph).replace(/</g, '\\u003c')};\n`);
  // Modo revisão (?review): inclui os nós escondidos, marcados
  fs.writeFileSync(path.join(DIST, 'graph-review.js'), `window.WORKSPACE = ${JSON.stringify(review.graph).replace(/</g, '\\u003c')};\n`);

  // Versão em texto para buscadores e para quem está sem JavaScript
  const byType = {};
  for (const n of [...nodes].sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo))) (byType[n.tipo] ||= []).push(n);
  const fallback = Object.entries(byType).map(([t, list]) =>
    `<h2>${esc(types[t].label)}</h2><ul>${list.map((n) => `<li><strong>${esc(n.titulo)}</strong>${n.resumo ? ` ${esc(n.resumo)}` : ''}</li>`).join('')}</ul>`).join('');
  const indexHtml = path.join(DIST, 'index.html');
  // Versão nos arquivos para o navegador nunca usar uma cópia antiga depois de publicar
  const v = Date.now().toString(36);
  const html = fs.readFileSync(indexHtml, 'utf8').replace('<!--FALLBACK-->', fallback)
    .replace(/(href|src)="((?:style|config|track|bg|sound)\.(?:css|js))"/g, `$1="$2?v=${v}"`)
    .replace(/'(vendor\/3d-force-graph\.min\.js|graph-review\.js|graph\.js|app\.js)'/g, `'$1?v=${v}'`);
  fs.writeFileSync(indexHtml, html);

  for (const w of warnings) console.warn('  aviso:', w);
  console.log(`workspace: ${nodes.length} nós, ${graph.links.length} conexões, ${warnings.length} avisos (${Date.now() - t0} ms)`);
}

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(DIST, path.normalize(p));
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(PORT, () => console.log(`workspace: abra http://localhost:${PORT}`));

  let timer;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 150); };
  for (const dir of [CONTENT, SITE]) fs.watch(dir, { recursive: true }, rebuild);
}

build();
if (process.argv.includes('--serve')) serve();
