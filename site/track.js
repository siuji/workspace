// Registro de cadastro e visita. Só envia algo se WS_CONFIG.tracking.enabled for true e houver endpoint.
// Coleta: nome e LinkedIn do cadastro, nós abertos, tempo no site, data e hora, origem (referrer/utm),
// dispositivo e fuso. Cidade/país aproximados devem ser resolvidos no Apps Script, não aqui.
(function () {
  const cfg = (window.WS_CONFIG && window.WS_CONFIG.tracking) || {};
  const on = !!(cfg.enabled && cfg.endpoint);
  const started = Date.now();
  const visitId = Math.random().toString(36).slice(2) + started.toString(36);
  const nodes = [];
  let visitor = null;

  function source() {
    const p = new URLSearchParams(location.search);
    const utm = p.get('utm_source');
    if (utm) return utm;
    const r = document.referrer;
    if (!r) return 'direct';
    if (/linkedin\./i.test(r) || /lnkd\.in/i.test(r)) return 'linkedin';
    if (/whatsapp|wa\.me/i.test(r)) return 'whatsapp';
    if (/google\./i.test(r)) return 'google';
    try { return new URL(r).hostname; } catch (e) { return 'other'; }
  }
  function device() {
    const ua = navigator.userAgent;
    return { ua, screen: `${screen.width}x${screen.height}`, lang: navigator.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }
  function send(type, extra) {
    if (!on) return;
    const body = JSON.stringify(Object.assign({ type, visitId, at: new Date().toISOString(), visitor, source: source(), device: device() }, extra || {}));
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'text/plain' }));
      else fetch(cfg.endpoint, { method: 'POST', body, keepalive: true, mode: 'no-cors' });
    } catch (e) {}
  }

  window.WS_TRACK = {
    enabled: on,
    identify(v) { visitor = v; send('signup'); },
    node(id) { nodes.push({ id, t: Math.round((Date.now() - started) / 1000) }); send('node', { node: id }); },
  };
  addEventListener('pagehide', () => send('end', { seconds: Math.round((Date.now() - started) / 1000), nodes }));
})();
