(function (root) {
  'use strict';
  const decisions = { next: '安排下一輪面試', request: '補充資料後再評估', hold: '暫緩決定', advance: '進入錄用討論', decline: '本輪不續行', withdrawn: '應徵者退出' };
  const limits = { summary: 3000, strengths: 3000, concerns: 3000, next: 2000, reviewer: 100, due: 10 };
  const sessionLimits = { title: 80, interviewer: 100, notes: 6000, at: 16 };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id);
  const timestamp = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
  function validDate(value, time = false) {
    if (!value) return true;
    if (!(time ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(value)) return false;
    const date = new Date(value + (time ? 'Z' : 'T00:00:00Z'));
    return !Number.isNaN(+date) && date.toISOString().slice(0, time ? 16 : 10) === value;
  }
  function initial() {
    return { version: 1, sessions: [], selectedId: null, assessment: { summary: '', strengths: '', concerns: '', tags: [], decision: '', next: '', reviewer: '', due: '' }, completedAt: null, history: [] };
  }
  function parseTags(text) {
    const tags = [...new Set(String(text).split(/[、，,\n]/).map(x => x.trim()).filter(Boolean))];
    if (tags.length > 10 || tags.some(tag => tag.length > 12)) throw new Error('最多 10 個面談標籤，每個標籤請控制在 12 個字內。');
    return tags;
  }
  function restore(value, strict = false) {
    const result = initial();
    const reject = () => { if (strict) throw new Error('面試評估資料格式不正確，請檢查備份。'); };
    const text = (value, max) => { if (value === undefined) return ''; if (typeof value !== 'string' || value.length > max) { reject(); return ''; } return value; };
    function assessment(input) {
      const output = initial().assessment;
      if (!object(input)) { reject(); return output; }
      for (const [key, max] of Object.entries(limits)) output[key] = text(input[key], max);
      if (!validDate(output.due)) { reject(); output.due = ''; }
      if (Object.hasOwn(decisions, input.decision)) output.decision = input.decision;
      else if (input.decision) reject();
      if (Array.isArray(input.tags) && input.tags.every(x => typeof x === 'string' && x.trim() && x.length <= 12) && input.tags.length <= 10) output.tags = [...new Set(input.tags)];
      else if (input.tags !== undefined) reject();
      return output;
    }
    if (value == null) return result;
    if (!object(value) || value.version !== 1) { reject(); return result; }
    if (!Array.isArray(value.sessions) || value.sessions.length > 12) reject();
    for (const item of (Array.isArray(value.sessions) ? value.sessions : []).slice(0, 12)) {
      if (!object(item) || !validId(item.id) || result.sessions.some(s => s.id === item.id)) { reject(); continue; }
      const session = { id: item.id, title: '', at: '', interviewer: '', notes: '', questions: [], updatedAt: null };
      for (const [key, max] of Object.entries(sessionLimits)) session[key] = text(item[key], max);
      if (!validDate(session.at, true)) { reject(); session.at = ''; }
      if (!Array.isArray(item.questions) || item.questions.length > 50) reject();
      for (const q of (Array.isArray(item.questions) ? item.questions : []).slice(0, 50)) {
        if (!object(q) || !validId(q.id) || typeof q.text !== 'string' || q.text.length > 1200 || session.questions.some(x => x.id === q.id)) { reject(); continue; }
        session.questions.push({ id: q.id, text: q.text });
      }
      if (timestamp(item.updatedAt)) session.updatedAt = item.updatedAt;
      result.sessions.push(session);
    }
    result.selectedId = result.sessions.some(s => s.id === value.selectedId) ? value.selectedId : result.sessions[0]?.id || null;
    result.assessment = assessment(value.assessment);
    if (value.completedAt != null && !timestamp(value.completedAt)) reject();
    if (timestamp(value.completedAt)) result.completedAt = value.completedAt;
    if (!Array.isArray(value.history) || value.history.length > 12) reject();
    for (const item of (Array.isArray(value.history) ? value.history : []).slice(-12)) {
      if (!object(item) || !timestamp(item.at) || !object(item.assessment)) { reject(); continue; }
      result.history.push({ at: item.at, assessment: assessment(item.assessment) });
    }
    if (result.completedAt && (!result.assessment.summary.trim() || !result.assessment.decision
        || (result.assessment.decision !== 'withdrawn' && !result.sessions.some(s => s.notes.trim()))
        || (['next', 'request'].includes(result.assessment.decision) && !result.assessment.next.trim()))) {
      reject(); result.completedAt = null;
    }
    return result;
  }
  function editable(value) {
    const record = restore(value);
    if (record.completedAt) throw new Error('請先重新編輯評估，再調整內容。');
    return record;
  }
  function addSession(value, id, questions, now) {
    const record = editable(value);
    if (!validId(id) || record.sessions.some(s => s.id === id)) throw new Error('面試紀錄識別碼重複或無效。');
    if (record.sessions.length >= 12) throw new Error('每份應徵紀錄最多保留 12 場面試。');
    record.sessions.push({ id, title: `第 ${record.sessions.length + 1} 次面試`, at: '', interviewer: '', notes: '', questions: questions.map(q => ({ id: q.id, text: q.text })), updatedAt: now });
    record.selectedId = id;
    return restore(record, true);
  }
  function updateSession(value, id, patch, now) {
    const record = editable(value), session = record.sessions.find(s => s.id === id);
    if (!session) throw new Error('找不到這場面試紀錄。');
    for (const key of Object.keys(sessionLimits)) if (Object.hasOwn(patch, key)) session[key] = patch[key];
    session.updatedAt = now;
    return restore(record, true);
  }
  function removeSession(value, id) {
    const record = editable(value);
    record.sessions = record.sessions.filter(s => s.id !== id);
    return restore(record);
  }
  function updateAssessment(value, patch) {
    const record = editable(value);
    for (const key of [...Object.keys(limits), 'decision', 'tags']) if (Object.hasOwn(patch, key)) record.assessment[key] = patch[key];
    return restore(record, true);
  }
  function observations(value) {
    return restore(value).sessions.flatMap((session, round) => session.notes.split(/\n+/).map(text => text.trim()).filter(Boolean)
      .map((text, index) => ({ sessionId: session.id, index, title: `面試 ${round + 1}：${session.title}`, text })));
  }
  function citeObservation(value, sessionId, index, target) {
    if (!['strengths', 'concerns'].includes(target)) throw new Error('請選擇工作強項或待釐清事項。');
    const record = editable(value), source = observations(record).find(item => item.sessionId === sessionId && item.index === index);
    if (!source) throw new Error('找不到這段面試觀察。');
    const quote = `【${source.title}】${source.text}`, current = record.assessment[target];
    if (current.split('\n').includes(quote)) return record;
    const next = [current, quote].filter(Boolean).join('\n');
    if (next.length > limits[target]) throw new Error('引用後會超過 3000 字，請先整理評估內容。');
    return updateAssessment(record, { [target]: next });
  }
  function finish(value, now) {
    const record = editable(value), assessment = record.assessment;
    if (assessment.decision !== 'withdrawn' && !record.sessions.some(s => s.notes.trim())) throw new Error('請先留下至少一場面試紀錄的重要回答與觀察。');
    if (!assessment.summary.trim()) throw new Error('請填寫整體觀察，讓評估保留判斷理由。');
    if (!assessment.decision) throw new Error('請選擇後續處理方式。');
    if (['next', 'request'].includes(assessment.decision) && !assessment.next.trim()) throw new Error('請填寫後續安排或需要補充的資料。');
    record.completedAt = now;
    record.history = [...record.history, { at: now, assessment: structuredClone(assessment) }].slice(-12);
    return restore(record, true);
  }
  function reopen(value) { const record = restore(value); record.completedAt = null; return record; }
  function stage(decision) { return ({ next: 'preparing', request: 'followup', hold: 'interviewed', advance: 'interviewed', decline: 'complete', withdrawn: 'complete' })[decision] || 'interviewed'; }
  function hasContent(value) {
    const record = restore(value);
    return record.sessions.some(s => s.notes || s.at || s.interviewer) || Object.entries(record.assessment).some(([key, text]) => key === 'tags' ? text.length : text);
  }
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paragraph = text => `<p>${escape(text).replace(/\n/g, '<br>')}</p>`;
  const reportStyles = `*{box-sizing:border-box}body{margin:0;background:#eef2ef;color:#203c30;font:16px/1.75 "Microsoft JhengHei",sans-serif}.report-document{max-width:1000px;margin:32px auto;padding:44px 48px;background:#fff}.report-document>header{text-align:center;padding-bottom:24px;border-bottom:2px solid #287157;margin-bottom:28px}.report-document h1,.report-document header h2{font-size:29px;margin:0 0 12px}.report-document header h3{font-size:23px;margin:8px 0}.report-document header p{margin:6px 0;color:#3e5a4c}.report-document section{margin:28px 0}.report-document section h2{font-size:21px;margin:0 0 12px}.report-document section h3{font-size:18px;margin:20px 0 10px}.report-table-wrap{overflow-x:auto}.report-document table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px}.report-document th,.report-document td{border:1px solid #c2cfc7;padding:12px 14px;vertical-align:top;text-align:left;overflow-wrap:anywhere;white-space:normal}.report-document th{background:#e9f1ec;color:#1d4835;font-weight:650}.report-document th[scope=row]{width:24%}.report-document tbody tr:nth-child(even) td{background:#f7faf8}.report-checks th:first-child{width:24%}.report-checks th:nth-child(2){width:36%}.report-checks th:nth-child(3){width:14%}.report-questions th:first-child{width:8%}.report-questions th:nth-child(2){width:58%}.report-tags th:first-child{width:25%}.report-document p{margin:0 0 10px;overflow-wrap:anywhere}.report-document a{color:#176544}.report-document .quote{margin:0;color:#3b5547}.report-actions{text-align:center;padding:0 24px 40px}.report-actions button{font:inherit;font-weight:600;padding:12px 28px;border:0;border-radius:6px;color:white;background:#087953;cursor:pointer}.report-document ol{padding-left:24px;margin:0}.report-document li{margin-bottom:10px}@media(max-width:650px){.report-document{margin:0;padding:28px 18px}.report-document th,.report-document td{padding:9px;font-size:14px}.report-document h1,.report-document header h2{font-size:26px}.report-document th[scope=row]{width:29%}}@media print{body{background:white}.report-document{margin:0;padding:0;max-width:none}.report-actions{display:none}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}.report-table-wrap{overflow:visible}.report-document th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@page{size:A4;margin:16mm}`;
  function table(rows) {
    return `<div class="report-table-wrap"><table><tbody>${rows.map(([label, text]) => `<tr><th scope="row">${escape(label)}</th><td>${escape(text || '未填寫').replace(/\n/g, '<br>')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function fragment(value, context = {}) {
    const record = restore(value), a = record.assessment;
    const rows = [['整體觀察', a.summary], ['工作強項', a.strengths], ['待釐清事項', a.concerns], ['後續處理', a.decision ? decisions[a.decision] : '未選擇'], ['後續安排', a.next], ['評估人', a.reviewer], ['預定處理日期', a.due]];
    if (a.tags.length) rows.push(['面談觀察標籤', a.tags.join('、')]);
    if (context.tags?.length) rows.push(['履歷分析標籤', context.tags.map(t => t.name).join('、')]);
    if (context.includePrivate && context.privateNote) rows.push(['私人筆記', context.privateNote]);
    return `<article class="assessment-document report-document"><header><h2>面試評估</h2>${context.resume ? `<h3>${escape(context.resume.name)}</h3>` : ''}${context.job ? paragraph(context.job.title) : ''}${paragraph(record.completedAt ? '評估完成' : '評估進行中')}</header><section><h3>評估摘要</h3>${table(rows)}</section>${record.sessions.map((session, i) => `<section><h3>${escape(session.title || `第 ${i + 1} 次面試`)}</h3>${table([['日期', session.at.replace('T', ' ')], ['面試官', session.interviewer], ['重要回答與觀察', session.notes]])}${context.includeQuestions && session.questions.length ? `<h3>本次面試題目</h3><ol>${session.questions.map(q => `<li>${escape(q.text)}</li>`).join('')}</ol>` : ''}</section>`).join('')}</article>`;
  }
  function reportDocument(title, content) {
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${reportStyles}</style></head><body>${content}<footer class="report-actions"><button onclick="window.print()">列印／另存 PDF</button></footer></body></html>`;
  }
  function report(value, context) {
    return reportDocument(`${context.resume.name}｜面試評估`, fragment(value, context));
  }
  const api = { decisions, initial, restore, parseTags, addSession, updateSession, removeSession, updateAssessment, observations, citeObservation, finish, reopen, stage, hasContent, fragment, reportDocument, report };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CardifPostInterview = api;
})(typeof window === 'undefined' ? globalThis : window);
