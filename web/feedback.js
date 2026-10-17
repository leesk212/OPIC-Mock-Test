// Renders AL feedback JSON (see prompts/feedback.md) into a container element.
// Shared by exam.html (right after a test) and feedback.html (history).
window.OPIcFeedback = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const gradeChip = g => { const c = el('span', 'grade g-' + String(g || '').toLowerCase(), g || '—'); return c; };
  const TYPE = { intro: '자기소개', d: '묘사', h: '루틴·습관', p: '과거 경험', c: '비교·변화', rp1: '롤플레이 · 질문하기', rp2: '롤플레이 · 문제 해결', rp3: '롤플레이 · 관련 경험', a1: '어드밴스 · 변화', a2: '어드밴스 · 이슈·의견' };

  function render(box, fb, result) {
    box.innerHTML = '';
    const items = (result && result.items) || [];
    const byN = Object.fromEntries(items.map(i => [i.n, i]));
    const o = fb.overall || {};

    const head = el('div', 'fb-head');
    const left = el('div', 'fb-score');
    left.appendChild(gradeChip(o.grade));
    const flu = el('div', 'fb-flu');
    flu.appendChild(el('span', 'lbl', '유창성'));
    const bar = el('div', 'fb-bar'); const fill = el('i'); fill.style.width = Math.max(0, Math.min(10, Number(o.fluency) || 0)) * 10 + '%'; bar.appendChild(fill);
    flu.appendChild(bar); flu.appendChild(el('b', null, (o.fluency ?? '—') + ' / 10'));
    left.appendChild(flu);
    head.appendChild(left);
    const sum = el('div', 'fb-sum');
    if (o.summary) sum.appendChild(el('p', null, o.summary));
    if (o.next_focus) { const p = el('p', 'fb-next'); p.appendChild(el('b', null, '내일 집중: ')); p.appendChild(document.createTextNode(o.next_focus)); sum.appendChild(p); }
    head.appendChild(sum);
    box.appendChild(head);

    if (Array.isArray(fb.memorize) && fb.memorize.length) {
      const m = el('div', 'fb-mem');
      m.appendChild(el('div', 'lbl', '외워 둘 문장'));
      const ol = el('ol');
      fb.memorize.forEach(s => ol.appendChild(el('li', null, s)));
      m.appendChild(ol);
      box.appendChild(m);
    }

    (fb.items || []).forEach(it => {
      const src = byN[it.n] || {};
      const card = el('details', 'fb-item');
      if ((fb.items || []).length <= 3) card.open = true;
      const sm = el('summary');
      sm.appendChild(gradeChip(it.grade));
      sm.appendChild(el('span', 'fb-q', `Q${it.n} · ${TYPE[src.type] || src.type || ''}${src.topic ? ' · ' + src.topic : ''}`));
      if (src.sec != null) sm.appendChild(el('span', 'sub', Math.floor(src.sec / 60) + ':' + String(src.sec % 60).padStart(2, '0')));
      card.appendChild(sm);
      if (src.question) card.appendChild(el('p', 'fb-question', src.question));
      if (src.audio) { const a = el('audio'); a.controls = true; a.src = '/' + src.audio; a.preload = 'none'; card.appendChild(a); }
      if (it.blockers && it.blockers.length) {
        card.appendChild(el('div', 'lbl', 'AL을 막는 것'));
        const ul = el('ul'); it.blockers.forEach(b => ul.appendChild(el('li', null, b))); card.appendChild(ul);
      }
      if (it.corrections && it.corrections.length) {
        card.appendChild(el('div', 'lbl', '문장 교정'));
        it.corrections.forEach(c => {
          const r = el('div', 'fb-corr');
          r.appendChild(el('div', 'said', c.said));
          r.appendChild(el('div', 'better', c.better));
          if (c.why) r.appendChild(el('div', 'why', c.why));
          card.appendChild(r);
        });
      }
      if (it.al_version) { card.appendChild(el('div', 'lbl', 'AL 버전 (내 내용 그대로)')); card.appendChild(el('p', 'fb-al', it.al_version)); }
      if (it.mission) { const p = el('p', 'fb-mission'); p.appendChild(el('b', null, '재답변 미션: ')); p.appendChild(document.createTextNode(it.mission)); card.appendChild(p); }
      if (it.expressions && it.expressions.length) {
        card.appendChild(el('div', 'lbl', '다음에 쓸 표현'));
        const ul = el('ul', 'fb-expr');
        it.expressions.forEach(x => { const li = el('li'); li.appendChild(el('b', null, x.expr)); if (x.use) li.appendChild(el('span', 'sub', ' — ' + x.use)); if (x.example) li.appendChild(el('div', 'ex', x.example)); ul.appendChild(li); });
        card.appendChild(ul);
      }
      const tr = src.transcript || src.memo;
      if (tr) { const d = el('details', 'fb-tr'); d.appendChild(el('summary', null, '내 답변 받아쓰기')); d.appendChild(el('p', null, tr)); card.appendChild(d); }
      box.appendChild(card);
    });
    if (fb.model || fb.graded_at) box.appendChild(el('p', 'note', `채점: ${fb.source === 'api' ? '즉시(API)' : '야간 채점'} · ${fb.model || ''} · ${fb.graded_at || ''}`));
  }

  // Requests feedback for a saved result and renders it, polling while it is queued.
  async function request(box, name, result, { force = false, statusEl } = {}) {
    const say = t => { if (statusEl) statusEl.textContent = t; };
    const [date, tag] = name.split('_');
    say('피드백 요청 중…');
    let r, j;
    try { r = await fetch(`/api/feedback?date=${date}${tag ? '&tag=' + tag : ''}${force ? '&force=1' : ''}`, { method: 'POST' }); j = await r.json(); }
    catch (e) { say('서버에 연결하지 못했어요.'); return; }
    if (j.status === 'ready') { say(''); render(box, j.feedback, result); return; }
    if (j.status === 'queued') { say('API 키가 없어서 오늘 밤 00:15 채점 대기열에 넣었어요. 내일 "기록·피드백"에서 볼 수 있어요.'); return; }
    say('피드백을 만들지 못했어요: ' + (j.error || r.status));
  }

  return { render, request, TYPE };
})();
