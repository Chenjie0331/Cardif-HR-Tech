(function (root) {
  'use strict';
  const criteria = [
    { key: 'channel', label: '通路經營', weight: 35 },
    { key: 'training', label: '說明會與教育訓練', weight: 30 },
    { key: 'insurance', label: '壽險銷售與輔導', weight: 25 },
    { key: 'tools', label: '工作工具運用', weight: 10 }
  ];
  const levels = ['0・明確無相關經驗', '1・協助執行', '2・基本運用', '3・持續獨立執行', '4・規劃推動與成果'];
  // shortcut: 初賽的五份虛構履歷採人工整理初評，擴充資料時由 HR 查核或接入經驗證的分析流程。
  const profiles = {
    R001: [[4, 'e0-0'], [4, 'e0-1'], [4, 'e1-0'], [2, 'k2']],
    R002: [[null, 's1'], [1, 'e0-2'], [3, 's0'], [2, 'k2']],
    R003: [[3, 'e0-0'], [3, 'e0-0'], [0, 'e0-2'], [2, 'k2']],
    R004: [[null, 'e1-0'], [1, 'e0-1'], [null, 's0'], [2, 'k1']],
    R005: [[null, 'e1-0'], [3, 'e0-0'], [0, 's0'], [2, 'k2']]
  };
  const validRating = value => value === null || Number.isInteger(value) && value >= 0 && value <= 4;
  function validWeights(value) {
    return value && criteria.every(c => Number.isInteger(value[c.key]) && value[c.key] >= 0 && value[c.key] <= 100)
      && criteria.reduce((sum, c) => sum + value[c.key], 0) === 100;
  }
  function restore(raw, job, ids) {
    const state = { version: 1, job, weights: Object.fromEntries(criteria.map(c => [c.key, c.weight])), ratings: Object.create(null) };
    if (!raw || raw.version !== 1 || raw.job !== job) return state;
    if (validWeights(raw.weights)) state.weights = Object.fromEntries(criteria.map(c => [c.key, raw.weights[c.key]]));
    for (const id of ids) {
      const values = raw.ratings && Object.hasOwn(raw.ratings, id) && raw.ratings[id];
      if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
      state.ratings[id] = Object.create(null);
      for (const c of criteria) if (Object.hasOwn(values, c.key) && validRating(values[c.key])) state.ratings[id][c.key] = values[c.key];
    }
    return state;
  }
  function rating(state, resume, key) {
    if (state.ratings[resume.id] && Object.hasOwn(state.ratings[resume.id], key)) return state.ratings[resume.id][key];
    const index = criteria.findIndex(c => c.key === key);
    return resume.origin !== 'online' && profiles[resume.id] ? profiles[resume.id][index][0] : null;
  }
  function result(state, resume) {
    if (!validWeights(state.weights)) throw new Error('權重合計須為 100%。');
    let lower = 0, pending = 0;
    for (const c of criteria) {
      const value = rating(state, resume, c.key);
      if (value === null) pending += state.weights[c.key];
      else lower += state.weights[c.key] * value / 4;
    }
    return { lower, upper: lower + pending, pending, coverage: 100 - pending };
  }
  function ordered(resumes, state, sort) {
    return sort === 'score' ? resumes.map((resume, index) => ({ resume, index, score: result(state, resume).lower }))
      .sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.resume) : [...resumes];
  }
  function create(context) {
    const { host, job } = context, storageKey = 'cardif-job-comparison-v1';
    let state, readError = false, mounted = false, sort = 'original', sourceId;
    try { state = restore(JSON.parse(localStorage.getItem(storageKey)), job.url, context.resumes().map(r => r.id)); }
    catch { state = restore(null, job.url, []); readError = true; }
    const el = (tag, text, cls) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (cls) item.className = cls; return item; };
    const fmt = number => Number(number.toFixed(1)).toString();
    function save() {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); host.querySelector('.comparison-save').textContent = '已儲存於此瀏覽器'; }
      catch { host.querySelector('.comparison-save').textContent = '儲存失敗，請保留頁面並重試'; context.notify('比較設定無法保存，請保留目前頁面。'); }
    }
    function sources() {
      const resume = context.resumes().find(r => r.id === sourceId) || context.resumes()[0];
      const body = host.querySelector('.comparison-evidence-body'); body.replaceChildren();
      if (!resume) return;
      const lines = root.CardifCore.sentences(resume);
      criteria.forEach((c, index) => {
        const section = el('section'), value = rating(state, resume, c.key);
        section.append(el('h3', c.label), el('p', value === null ? '待確認：目前不足以判定。' : levels[value]));
        const line = resume.origin !== 'online' && profiles[resume.id] && lines.find(l => l.id === profiles[resume.id][index][1]);
        section.append(el('blockquote', line ? root.CardifCore.displayText(line.text) : '請開啟這位應徵者的履歷，依相關工作內容與原文查核。'));
        section.append(el('p', state.ratings[resume.id] && Object.hasOwn(state.ratings[resume.id], c.key) ? '此項已由 HR 調整，請確認評級與證據一致。' : profiles[resume.id] && resume.origin !== 'online' ? '示範履歷初評，可依查核結果調整。' : '尚待 HR 評估。'));
        body.append(section);
      });
    }
    function renderRows() {
      const body = host.querySelector('tbody'); body.replaceChildren();
      for (const resume of ordered(context.resumes(), state, sort)) {
        const tr = el('tr'), name = el('th'); name.scope = 'row';
        const open = el('button', resume.name, 'comparison-person'); open.type = 'button';
        open.addEventListener('click', () => { sourceId = resume.id; host.querySelector('#comparisonSource').value = sourceId; sources(); context.open(resume.id); });
        name.append(open); tr.append(name);
        for (const c of criteria) {
          const cell = el('td'), input = el('select'); input.setAttribute('aria-label', `${resume.name}・${c.label}評級`);
          input.dataset.person = resume.id; input.dataset.criterion = c.key;
          input.append(new Option('待確認', 'pending'), ...levels.map((label, index) => new Option(`${index} / 4`, String(index))));
          const value = rating(state, resume, c.key); input.value = value === null ? 'pending' : String(value);
          input.addEventListener('change', () => {
            state.ratings[resume.id] ??= Object.create(null); state.ratings[resume.id][c.key] = input.value === 'pending' ? null : Number(input.value);
            save(); renderRows(); sources();
            host.querySelector(`[data-person="${resume.id}"][data-criterion="${c.key}"]`)?.focus({ preventScroll: true });
          });
          cell.append(input); tr.append(cell);
        }
        const score = result(state, resume), cell = el('td', undefined, 'comparison-score');
        cell.append(el('strong', score.pending ? `${fmt(score.lower)}–${fmt(score.upper)}` : fmt(score.lower)), el('span', score.pending ? `待確認權重 ${score.pending}%` : '各項已評級'));
        tr.append(cell); body.append(tr);
      }
      host.querySelector('.comparison-count').textContent = `全部 ${context.resumes().length} 位應徵者・滿分 100`;
    }
    function mount() {
      mounted = true;
      host.innerHTML = '<header class="comparison-heading"><h2 id="comparisonTitle">職缺權重與應徵者比較</h2><p class="comparison-job"></p><p>同一職缺共用權重。示範履歷採人工整理初評，HR 可依證據調整評級。</p></header><form class="comparison-weights"><div class="comparison-weight-fields"></div><div class="comparison-weight-actions"><strong class="comparison-total" role="status"></strong><button type="submit" class="button primary">套用至全部應徵者</button><button type="button" class="button secondary" data-comparison-reset>恢復建議權重</button></div></form><p class="comparison-save" role="status"></p><div class="comparison-table-heading"><p class="comparison-count"></p><label>比較順序<select id="comparisonSort"><option value="original">原始名單順序</option><option value="score">已列證據分由高到低</option></select></label></div><p class="comparison-explanation">分數區間包含待確認項目的可能分數。履歷未提及的項目會保留為待確認。評級 0–4 的意義與原文依據可在下方查看。任用資格另行查核。</p><div class="comparison-table-scroll" role="region" aria-label="全部應徵者初步比較" tabindex="0"><table><caption class="sr-only">此職缺全部應徵者的工作能力初步比較</caption><thead><tr><th scope="col">應徵者</th></tr></thead><tbody></tbody></table></div><details class="comparison-evidence"><summary>評級說明與履歷依據</summary><ol class="comparison-scale" start="0"><li>明確無相關經驗</li><li>協助執行</li><li>基本運用</li><li>持續獨立執行</li><li>規劃推動與成果</li></ol><p>參考分數的計算方式：各項權重 ×（評級 ÷ 4），再將四項分數加總。</p><p>尚待確認的項目以 0 到該項滿分呈現區間。這個區間不是錄用機率。</p><label>查看人選<select id="comparisonSource"></select></label><div class="comparison-evidence-body"></div></details>';
      host.querySelector('.comparison-job').textContent = job.title;
      const fields = host.querySelector('.comparison-weight-fields'), head = host.querySelector('thead tr');
      for (const c of criteria) {
        const label = el('label', c.label), wrap = el('span', undefined, 'comparison-percent'), input = el('input');
        input.type = 'number'; input.min = '0'; input.max = '100'; input.step = '1'; input.required = true; input.name = c.key; input.value = state.weights[c.key];
        input.setAttribute('aria-label', `${c.label}權重`); wrap.append(input, el('span', '%')); label.append(wrap); fields.append(label);
        head.append(el('th', c.label)); head.lastChild.scope = 'col';
      }
      head.append(el('th', '初步參考分')); head.lastChild.scope = 'col';
      const form = host.querySelector('form'), total = host.querySelector('.comparison-total');
      const check = () => { const weights = Object.fromEntries(criteria.map(c => [c.key, form.elements[c.key].value === '' ? NaN : Number(form.elements[c.key].value)])); total.textContent = `合計 ${criteria.reduce((sum, c) => sum + (Number.isFinite(weights[c.key]) ? weights[c.key] : 0), 0)}%${validWeights(weights) ? '' : '，請調整為 100%'}`; total.dataset.invalid = String(!validWeights(weights)); return weights; };
      form.addEventListener('input', check);
      form.addEventListener('submit', event => { event.preventDefault(); const weights = check(); if (!validWeights(weights)) { context.notify('四項權重合計須為 100%，目前比較保留原設定。'); return; } state.weights = weights; save(); renderRows(); });
      host.querySelector('[data-comparison-reset]').addEventListener('click', () => { for (const c of criteria) { state.weights[c.key] = c.weight; form.elements[c.key].value = c.weight; } check(); save(); renderRows(); });
      host.querySelector('#comparisonSort').addEventListener('change', event => { sort = event.target.value; renderRows(); });
      host.querySelector('#comparisonSource').addEventListener('change', event => { sourceId = event.target.value; sources(); });
      host.querySelector('.comparison-save').textContent = readError ? '比較設定無法讀取，目前顯示建議值。儲存前請先核對。' : '權重為示範建議值，可由 HR 依職缺調整。';
      check();
    }
    function refresh() {
      if (!mounted) mount();
      const picker = host.querySelector('#comparisonSource'); picker.replaceChildren(...context.resumes().map(r => new Option(r.name, r.id)));
      if (!context.resumes().some(r => r.id === sourceId)) sourceId = context.resumes()[0]?.id;
      picker.value = sourceId || ''; renderRows(); sources();
    }
    return { show(visible) { host.hidden = !visible; if (visible) refresh(); } };
  }
  const api = { criteria, profiles, validWeights, restore, rating, result, ordered, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CardifComparison = api;
})(typeof window !== 'undefined' ? window : globalThis);
