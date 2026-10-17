// Storage layer. With server.py (localhost) every /api call goes to the server.
// Anywhere else (GitHub Pages, any static host, file://) this file answers the same
// /api calls inside the browser, so the pages work with no server at all:
//   results + feedback -> localStorage, recordings -> IndexedDB,
//   grading -> the viewer's own API key (kept only in this browser) or copy-paste.
(() => {
  const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && location.protocol.startsWith('http');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const NAME_RE = /^\d{4}-\d{2}-\d{2}(_[A-Za-z0-9-]{1,16})?$/;
  const ls = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    keys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) out.push(k.slice(prefix.length)); } } catch (e) {} return out; },
  };
  const cfg = () => ls.get('opic.cfg') || {};
  const nameOf = (date, tag) => (tag && /^[A-Za-z0-9-]{1,16}$/.test(tag)) ? `${date}_${tag}` : date;

  // ---------- IndexedDB for audio ----------
  let dbp = null;
  const idb = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('opic-mock-test', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('rec');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const idbPut = async (k, v) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('rec', 'readwrite'); t.objectStore('rec').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
  const idbGet = async (k) => { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction('rec').objectStore('rec').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); };

  // ---------- grading ----------
  let rubricP = null;
  const rubric = () => rubricP || (rubricP = fetch(new URL('../prompts/feedback.md', location.href)).then(r => { if (!r.ok) throw new Error('rubric not found'); return r.text(); }));
  const userMsg = result => 'Grade this OPIc mock-test result. Reply with the JSON object only.\n\n' + JSON.stringify(result);
  function extractJson(text) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('no JSON object in the reply');
    const fb = JSON.parse(text.slice(a, b + 1));
    if (!fb || typeof fb.overall !== 'object' || !Array.isArray(fb.items)) throw new Error("feedback JSON needs an 'overall' object and an 'items' list");
    return fb;
  }
  async function grade(result) {
    const c = cfg(), system = await rubric();
    let text;
    if (c.provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': c.api_key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: c.model || 'claude-sonnet-5-5', max_tokens: 8000, system, messages: [{ role: 'user', content: userMsg(result) }] }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(`API ${r.status}: ${(j.error && j.error.message) || ''}`);
      text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    } else {
      const base = (c.base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
      const r = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, c.api_key ? { authorization: 'Bearer ' + c.api_key } : {}),
        body: JSON.stringify({ model: c.model || 'gpt-4o-mini', temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg(result) }] }),
      });
      const j = await r.json(); if (!r.ok) throw new Error(`API ${r.status}: ${(j.error && j.error.message) || ''}`);
      text = j.choices[0].message.content;
    }
    const fb = extractJson(text);
    return Object.assign(fb, { model: c.model || '', source: c.provider, graded_at: new Date().toISOString() });
  }

  // ---------- emulated /api ----------
  const reply = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json' } });
  const fbState = name => { const f = ls.get('opic.feedback.' + name); return f ? { status: 'ready', feedback: f } : (ls.get('opic.pending.' + name) ? { status: 'queued' } : { status: 'none' }); };

  async function handle(url, init) {
    const u = new URL(url, location.href), q = u.searchParams, method = (init && init.method || 'GET').toUpperCase();
    const p = u.pathname.replace(/^.*\/api\//, '/api/');
    const date = q.get('date') || today(), name = q.get('name') || nameOf(date, q.get('tag'));
    const body = init && init.body;
    if (p === '/api/health') { const c = cfg(); return reply(200, { ok: true, today: today(), static: true, instant_feedback: !!c.provider, provider: c.provider || 'manual', model: c.model || '' }); }
    if (p === '/api/set') {
      try { const r = await fetch(new URL(`../sets/${date}.json`, location.href), { cache: 'no-store' }); if (r.ok) return reply(200, await r.json()); } catch (e) {}
      return reply(404, { error: 'no set for this date' });
    }
    if (p === '/api/recording' && method === 'POST') { const n = Number(q.get('n')); if (!(n >= 1 && n <= 20)) return reply(400, { error: 'bad recording' }); try { await idbPut(`${date}/Q${n}.webm`, body); } catch (e) { return reply(500, { error: 'could not store audio' }); } return reply(200, { saved: `recordings/${date}/Q${n}.webm` }); }
    if (p === '/api/result' && method === 'POST') { const r = JSON.parse(body); if (!ls.set('opic.results.' + name, r)) return reply(500, { error: 'browser storage is full or blocked' }); return reply(200, { saved: `browser:${name}`, name }); }
    if (p === '/api/result') { const r = NAME_RE.test(name) && ls.get('opic.results.' + name); return r ? reply(200, r) : reply(404, { error: 'no result' }); }
    if (p === '/api/history') {
      const items = ls.keys('opic.results.').sort().reverse().slice(0, 60).map(n => {
        const r = ls.get('opic.results.' + n) || {}, st = fbState(n);
        return { name: n, date: r.date, part: r.part, count: r.count, totalSec: r.totalSec, theme: r.theme, feedback: st.status, grade: st.feedback && st.feedback.overall && st.feedback.overall.grade };
      });
      return reply(200, { items });
    }
    if (p === '/api/prompt') { const r = ls.get('opic.results.' + name); if (!r) return reply(404, { error: 'no result' }); return reply(200, { prompt: (await rubric()) + '\n\n---\n\n' + userMsg(r) }); }
    if (p === '/api/feedback/import' && method === 'POST') {
      if (!ls.get('opic.results.' + name)) return reply(400, { error: 'unknown result' });
      try { const fb = extractJson(String(body || '')); fb.source = fb.source || 'manual'; fb.graded_at = fb.graded_at || new Date().toISOString(); fb.name = name; ls.set('opic.feedback.' + name, fb); return reply(200, { status: 'ready', feedback: fb }); }
      catch (e) { return reply(400, { status: 'error', error: 'could not read feedback JSON: ' + e.message }); }
    }
    if (p === '/api/feedback' && method === 'POST') {
      const r = ls.get('opic.results.' + name); if (!r) return reply(404, { error: 'save the result first' });
      const st = fbState(name); if (st.status === 'ready' && q.get('force') !== '1') return reply(200, st);
      if (!cfg().provider) { ls.set('opic.pending.' + name, Date.now()); return reply(202, { status: 'queued', name }); }
      try { const fb = await grade(r); fb.name = name; ls.set('opic.feedback.' + name, fb); return reply(200, { status: 'ready', feedback: fb }); }
      catch (e) { return reply(502, { status: 'error', error: e.message }); }
    }
    if (p === '/api/feedback') return reply(200, fbState(name));
    return reply(404, { error: 'not found' });
  }

  if (!LOCAL) {
    const real = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      const u = new URL(url, location.href);
      if (u.origin === location.origin && u.pathname.includes('/api/')) return handle(url, init);
      return real(input, init);
    };
  }

  window.OPIcStore = {
    hosted: !LOCAL,
    cfg, saveCfg: c => ls.set('opic.cfg', c),
    audioURL: async path => {
      if (LOCAL) return '/' + path;
      const k = path.replace(/^recordings\//, ''); const b = await idbGet(k).catch(() => null);
      return b ? URL.createObjectURL(b) : '';
    },
  };
})();
