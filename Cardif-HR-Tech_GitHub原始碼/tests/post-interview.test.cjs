const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const now = '2026-11-04T08:00:00.000Z';
function api() {
  const file = path.join(__dirname, '../js/post-interview.js');
  assert.ok(fs.existsSync(file), 'post-interview workflow is not implemented');
  return require(file);
}
test('assessment uses a readable table and puts print controls below the report', () => {
  const P = api(), html = P.report(P.initial(), { resume: { name: '測試者' }, job: { title: '測試職缺' } });
  assert.ok(html.includes('<th scope="row">整體觀察</th>'));
  assert.ok(html.includes('未填寫') && html.includes('評估進行中'));
  assert.ok(html.indexOf('onclick="window.print()"') > html.lastIndexOf('</article>'));
});
test('HR can cite a chosen observation without changing notes, duplicating it or overwriting assessment', () => {
  const P = api();
  let value = P.addSession(P.initial(), 'round-1', [], now);
  value = P.updateSession(value, 'round-1', { notes: '能說明分行規劃。\n需要補充成果證據。' }, now);
  value = P.updateAssessment(value, { strengths: '原本的評估。' });
  const original = JSON.stringify(value), source = P.observations(value)[0];
  const cited = P.citeObservation(value, source.sessionId, source.index, 'strengths');
  assert.equal(JSON.stringify(value), original);
  assert.match(cited.assessment.strengths, /^原本的評估。\n【面試 1：/);
  assert.ok(cited.assessment.strengths.includes('能說明分行規劃。'));
  assert.equal(cited.sessions[0].notes, value.sessions[0].notes);
  assert.equal(P.citeObservation(cited, source.sessionId, source.index, 'strengths').assessment.strengths, cited.assessment.strengths);
  assert.equal(cited.assessment.concerns, '');
  assert.throws(() => P.citeObservation(cited, 'other-person', 0, 'concerns'));
  assert.throws(() => P.citeObservation(cited, source.sessionId, 0, 'decision'));
  assert.throws(() => P.citeObservation(P.updateAssessment(value, { strengths: 'x'.repeat(3000) }), source.sessionId, 0, 'strengths'));
  const completed = P.finish(P.updateAssessment(cited, { summary: '已記錄判斷依據。', decision: 'hold' }), now);
  assert.throws(() => P.citeObservation(completed, source.sessionId, 0, 'strengths'));
});
function filled(P) {
  let value = P.addSession(P.initial(), 'round-1', [{ id: 'q1', text: '請說明專案中的角色。' }], now);
  value = P.updateSession(value, 'round-1', { at: '2026-11-04T14:00', interviewer: '部門主管', notes: '說明本人負責的教材與訓練安排。' }, now);
  return P.updateAssessment(value, { summary: '已釐清本人工作範圍。', strengths: '能清楚拆解工作內容。', concerns: '仍需補充教材範例。', tags: ['表達有條理'], decision: 'request', next: '請補充一份課程教材。' });
}

test('multiple interview rounds retain their own immutable question snapshots and notes', () => {
  const P = api(), questions = [{ id: 'q1', text: '原本的問題' }];
  const first = P.addSession(P.initial(), 'r1', questions, now);
  questions[0].text = '後來改寫';
  const second = P.addSession(first, 'r2', questions, now);
  const edited = P.updateSession(second, 'r2', { notes: '第二輪回答' }, now);
  assert.equal(edited.sessions[0].questions[0].text, '原本的問題');
  assert.equal(edited.sessions[1].questions[0].text, '後來改寫');
  assert.equal(first.sessions.length, 1);
  assert.equal(second.sessions[1].notes, '');
  assert.equal(P.removeSession(edited, 'r2').sessions[0].id, 'r1');
});

test('completion validates actual observations, review and next action; decisions map to work stages', () => {
  const P = api();
  assert.throws(() => P.finish(P.initial(), now), /面試紀錄/);
  const value = filled(P);
  assert.throws(() => P.finish(P.updateAssessment(value, { summary: '' }), now), /整體觀察/);
  assert.throws(() => P.finish(P.updateAssessment(value, { next: '' }), now), /後續/);
  const result = P.finish(value, now);
  assert.equal(result.completedAt, now);
  assert.equal(result.history.length, 1);
  assert.equal(P.stage(result.assessment.decision), 'followup');
  assert.equal(P.stage('next'), 'preparing');
  assert.equal(P.stage('decline'), 'complete');
  assert.equal(P.stage('advance'), 'interviewed');
  assert.throws(() => P.updateSession(result, 'round-1', { notes: '覆寫' }, now), /重新編輯/);
  const reopened = P.reopen(result);
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.sessions[0].notes, value.sessions[0].notes);
  assert.equal(P.finish(P.updateAssessment(reopened, { decision: 'advance', next: '交由主管討論。' }), now).history.length, 2);
  assert.equal(result.history[0].assessment.decision, 'request');
});

test('restoration rejects duplicate ids, invalid dates and oversized data; tags remain short and distinct', () => {
  const P = api(), value = filled(P);
  const malformed = { ...value, sessions: [value.sessions[0], value.sessions[0], { id: '__proto__', notes: 'x' }], completedAt: 'bad' };
  assert.equal(P.restore(malformed).sessions.length, 1);
  assert.equal(P.restore(malformed).completedAt, null);
  assert.throws(() => P.restore(malformed, true));
  assert.throws(() => P.updateSession(value, 'round-1', { at: '2026-02-31T14:00' }, now));
  assert.deepEqual(P.parseTags('表達有條理、主動協調，表達有條理'), ['表達有條理', '主動協調']);
  assert.throws(() => P.parseTags('字'.repeat(13)));
  assert.throws(() => P.restore({ ...value, sessions: [{ ...value.sessions[0], notes: 'x'.repeat(6001) }] }, true));
});

test('report uses real records, escapes input and excludes private notes and question sheets by default', () => {
  const P = api(), value = P.updateAssessment(filled(P), { summary: '<script>bad</script>' });
  const context = { resume: { name: '測試者' }, job: { title: '保險顧問', url: 'https://example.com/job' }, tags: [{ name: '熟悉銀行通路' }], privateNote: '私人內容123' };
  const html = P.report(value, context);
  assert.ok(html.includes('&lt;script&gt;bad'));
  assert.ok(!html.includes('<script>bad'));
  assert.ok(html.includes('說明本人負責的教材與訓練安排'));
  assert.ok(html.includes('熟悉銀行通路'));
  assert.ok(html.includes('表達有條理'));
  assert.ok(!html.includes('私人內容123'));
  assert.ok(!html.includes('請說明專案中的角色'));
  assert.ok(P.report(value, { ...context, includePrivate: true, includeQuestions: true }).includes('私人內容123'));
  assert.ok(P.report(value, { ...context, includeQuestions: true }).includes('請說明專案中的角色'));
});

test('case persistence and backups preserve post-interview work without reviving retired fields', () => {
  const P = api(), M = require('../js/recruitment.js'), value = filled(P);
  const record = M.restoreCase({ postInterview: value, answers: { q1: '舊欄位' }, conclusion: '舊評語' });
  assert.deepEqual(record.postInterview, value);
  const backup = { format: 'cardif-recruitment', version: 1, candidate: 'R001', case: record, interview: { questions: [] }, tags: [], note: '' };
  assert.deepEqual(M.parseBackup(backup, ['R001']).case.postInterview, value);
  assert.throws(() => M.parseBackup({ ...backup, case: { ...record, postInterview: { ...value, version: 999 } } }, ['R001']));
  assert.equal(M.restoreCase(null).postInterview.sessions.length, 0);
});
