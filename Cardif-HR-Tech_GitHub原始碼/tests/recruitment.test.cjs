const { test } = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../js/data.js');
require('../js/core.js');
window.CardifInterview = require('../js/interview.js');
const M = require('../js/recruitment.js');
const resumes = window.RESUME_DATA.resumes;
test('recruitment document uses tables and places its only print action after all content', () => {
  const html = M.report({ resume: resumes[0], job: window.JOB, record: M.restoreCase(null), draft: { questions: [] }, review: { summary: '摘要', points: [] }, note: '', tags: [] });
  assert.ok(html.includes('<thead>') && html.includes('<th scope="col">核對結果</th>'));
  assert.equal((html.match(/onclick="window.print\(\)"/g) || []).length, 1);
  assert.ok(html.indexOf('onclick="window.print()"') > html.lastIndexOf('</article>'));
});

test('all five assessments use an existing passage when a source is supplied', () => {
  for (const resume of resumes) {
    const lines = window.CardifCore.sentences(resume);
    const items = M.assessment(resume);
    assert.equal(items.length, 6);
    assert.equal(new Set(items.map(x => x.id)).size, 6);
    for (const item of items) if (item.source) assert.ok(lines.some(x => x.id === item.source), `${resume.id}/${item.id}`);
  }
});

test('case restore rejects invalid keys, dates, oversized text and forged status', () => {
  const input = JSON.parse('{"stage":"hire-now","applicability":"yes","at":"bad","checks":{"experience":{"status":"confirmed","note":"checked"},"registration":{"status":"passed","note":"x"},"__proto__":{"status":"confirmed"}},"answers":{"q-1":"answer","<script>":"bad"},"conclusion":"ok"}');
  const record = M.restoreCase(input);
  assert.equal(record.stage, 'reviewing');
  assert.equal(record.applicability, 'yes');
  assert.equal(record.at, '');
  assert.equal(M.restoreCase({ at: '2026-02-31T10:00' }).at, '');
  assert.equal(M.restoreCase({ at: '2026-11-05T14:00' }).at, '2026-11-05T14:00');
  assert.deepEqual(record.checks.experience, { status: 'confirmed', note: 'checked' });
  assert.equal(record.checks.registration, undefined);
  assert.equal(record.answers['q-1'], 'answer');
  assert.equal(record.answers['<script>'], undefined);
  assert.equal(M.restoreCase({ conclusion: 'x'.repeat(4001) }).conclusion, '');
  assert.deepEqual(Object.keys(M.restore({ R001: input, foreign: input }, ['R001'])), ['R001']);
});

test('backup boundary validates format, candidates, tags and note limits', () => {
  const good = { format: 'cardif-recruitment', version: 1, candidate: 'R001', case: {}, interview: { questions: [] }, tags: [], note: '' };
  assert.equal(M.parseBackup(good, ['R001']).candidate, 'R001');
  for (const bad of [{ ...good, candidate: 'other' }, { ...good, version: 2 }, { ...good, tags: [{ id: 'bad', name: '<x>', status: 'invalid', sources: [] }] }, { ...good, note: 'x'.repeat(2001) }]) assert.throws(() => M.parseBackup(bad, ['R001']));
});

test('report escapes questions and notes, preserves sources, and excludes retired interview fields', () => {
  const q = { id: 'q1', text: '<img src=x onerror=alert(1)>', followUp: 'follow', resumeSource: 'e0-0' };
  const record = M.restoreCase({ answers: { q1: '<script>bad</script>' }, conclusion: 'observation' });
  const html = M.report({ resume: resumes[0], job: window.JOB, record, draft: { questions: [q] }, review: { summary: 's', points: [] }, note: '<script>note</script>', includePrivate: true, tags: [] });
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script&gt;note'));
  assert.ok(!html.includes('<script>bad'));
  assert.ok(html.includes('18 間分行'));
  assert.ok(!html.includes('observation'));
  assert.ok(!html.includes('follow'));
  assert.ok(!html.includes('未記錄回答'));
  assert.ok(!html.includes('面試時間'));
});


test('moving from insurance sales to channel work is not labeled as a cross-industry move', () => {
  assert.ok(!window.CardifCore.suggestTags(resumes[1]).some(t => t.id === 'transition'));
  assert.ok(window.CardifCore.suggestTags(resumes[4]).some(t => t.id === 'transition'));
});


test('report resolves legacy suggestion links to their resume quote', () => {
  const html = M.report({ resume: resumes[0], job: window.JOB, record: M.restoreCase(null), draft: { questions: [{ id: 'q1', text: 'question', followUp: '', sourceId: 'channel' }] }, review: { summary: '', points: [] }, note: '', tags: [] });
  assert.ok(html.includes('18 間分行'));
});

test('each requirement provides a complete candidate-specific question with a valid optional source', () => {
  for (const resume of resumes) for (const [id] of M.requirements) {
    const question = M.questionFor(resume, id);
    assert.ok(question.text.length > 25);
    assert.ok(!/[；;]/.test(question.text));
    if (question.source) assert.ok(window.CardifInterview.passages(resume).some(line => line.id === question.source));
  }
  assert.match(M.questionFor(resumes[3], 'training').text, /場務/);
  assert.notEqual(M.questionFor(resumes[3], 'training').text, M.questionFor(resumes[0], 'training').text);
  assert.equal(M.questionFor(resumes[0], 'invalid'), null);
});

test('work filters use recorded actions and distinguish unread from completed stages', () => {
  const records = { R001: M.restoreCase({ stage: 'interviewed' }), R002: M.restoreCase({ checks: { training: { status: 'ask', note: '' } } }), R003: M.restoreCase({ stage: 'followup' }) };
  assert.ok(M.matchesWork(resumes[0], 'stage:interviewed', records, []));
  assert.ok(!M.matchesWork(resumes[0], 'ask', records, []));
  assert.ok(M.matchesWork(resumes[1], 'ask', records, []));
  assert.ok(M.matchesWork(resumes[2], 'request', records, []));
  assert.ok(!M.matchesWork(resumes[0], 'unread', records, ['R001']));
  assert.ok(M.matchesWork(resumes[4], 'stage:reviewing', records, []));
});

test('requirement questions recognize equivalent defaults without overwriting edited questions', () => {
  const resume = resumes[3], draft = window.CardifInterview.choose(resume.id, undefined, 'event');
  assert.ok(M.existingQuestion(resume, 'training', draft.questions));
  const edited = draft.questions.map(q => ({ ...q, text: '使用者已改寫的其他題目' }));
  assert.equal(M.existingQuestion(resume, 'training', edited), undefined);
  assert.ok(M.existingQuestion(resume, 'training', [{ id: 'requirement-training', text: 'custom' }]));
});

test('company-level resume links survive backup restoration and printable export', () => {
  const draft = window.CardifInterview.restore({ R004: { singleList: true, revision: 2, questions: [{ id: 'q1', text: '實習心得', followUp: '', resumeSource: 'job1' }] } }, resumes.map(r => r.id)).R004;
  assert.equal(draft.revision, 2);
  assert.equal(draft.questions[0].resumeSource, 'job1');
  const html = M.report({ resume: resumes[3], job: window.JOB, record: M.restoreCase(null), draft, review: { summary: '', points: [] }, note: '', tags: [] });
  assert.ok(html.includes('豐禾人壽'));
  assert.ok(html.includes('2023/07–2024/01'));
});

 test('recruitment report excludes private notes by default and includes only when selected', () => {
  const data = { resume: resumes[0], job: window.JOB, record: M.restoreCase(null), draft: { questions: [] }, review: { summary: '', points: [] }, note: 'PRIVATE-AUDIT-NOTE', tags: [] };
  assert.ok(!M.report(data).includes('PRIVATE-AUDIT-NOTE'));
  assert.ok(!M.report(data).includes('HR 筆記'));
  assert.ok(M.report({ ...data, includePrivate: true }).includes('PRIVATE-AUDIT-NOTE'));
});

test('job scope is shared by default; legacy and explicit person exceptions retain their own values', () => {
  const a = M.restoreCase(null), b = M.restoreCase(null);
  assert.equal(M.applicability(a, 'yes'), 'yes');
  assert.equal(M.applicability(b, 'yes'), 'yes');
  const legacy = M.restoreCase({ applicability: 'no' });
  assert.equal(legacy.scopeOverride, true);
  assert.equal(M.applicability(legacy, 'yes'), 'no');
  assert.equal(M.applicability(M.restoreCase({ ...legacy, scopeOverride: false }), 'yes'), 'yes');
  assert.equal(M.applicability(M.restoreCase({ applicability: 'unknown', scopeOverride: true }), 'yes'), 'unknown');
  assert.equal(M.restoreScope('forged'), 'unknown');
  const backup = { format: 'cardif-recruitment', version: 1, candidate: 'R001', case: { ...a, applicability: M.applicability(a, 'yes'), scopeOverride: true }, interview: { questions: [] }, tags: [], note: '' };
  assert.equal(M.applicability(M.parseBackup(backup, ['R001']).case, 'no'), 'yes');
});
