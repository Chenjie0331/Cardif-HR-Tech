const { test } = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../js/data.js');
require('../js/core.js');
const { suggestions, passages, findPassages, restore, prepare, choose, move } = require('../js/interview.js');
const ids = window.RESUME_DATA.resumes.map(r => r.id);

test('personalized questions link to actual resume passages without an extra question layer', () => {
  assert.deepEqual(Object.keys(suggestions), ids);
  assert.ok(new Set(Object.values(suggestions).map(q => q.length)).size > 1);
  for (const resume of window.RESUME_DATA.resumes) {
    const lines = window.CardifCore.sentences(resume);
    for (const q of suggestions[resume.id]) {
      assert.ok(lines.find(line => line.id === q.source)?.text.includes(q.quote), `${resume.id}/${q.id}: evidence mismatch`);
      assert.equal(q.followUp, undefined);
      assert.ok(q.text.length <= 1200);
      assert.doesNotMatch(q.text, /[；;]/);
    }
  }
});

test('draft restore preserves separate outlines and an unfinished editor without adopting suggestions', () => {
  assert.deepEqual({ ...restore(null, ids) }, {});
  const saved = { R001: { questions: [{ id: 'q1', text: 'A', followUp: '(追問)', sourceId: 'channel' }], savedAt: '2026-11-01T01:00:00Z' },
    R002: { questions: [], editor: { id: 'q2', text: '未完成的問題', followUp: '', sourceId: 'training' } } };
  const result = restore(saved, ids);
  assert.equal(result.R001.questions[0].text, 'A');
  assert.equal(result.R001.questions[0].sourceId, 'channel');
  assert.equal(result.R002.questions.length, 0);
  assert.equal(result.R002.editor.text, '未完成的問題');
  assert.equal(result.R003, undefined);
});

test('restore discards malformed, duplicate, foreign and oversized persisted content', () => {
  const q = { id: 'q1', text: '有效問題', followUp: '', sourceId: 'not-a-source', injected: true };
  const data = { R001: { questions: [q, q, { ...q, id: '<script>' }, { ...q, id: 'long', text: 'x'.repeat(1201) }], editor: { id: 'draft', text: '', followUp: '' }, savedAt: 'bad' },
    unknown: { questions: [q] }, R002: { questions: 'not a list' } };
  const result = restore(data, ids);
  assert.deepEqual(result.R001.questions, [{ id: 'q1', text: '有效問題', followUp: '' }]);
  assert.equal(result.R001.editor.text, '');
  assert.equal(result.R001.savedAt, null);
  assert.equal(result.unknown, undefined);
  assert.equal(result.R002, undefined);
  assert.deepEqual({ ...restore([], ids) }, {});
  const oversized = Array.from({ length: 60 }, (_, index) => ({ id: `q${index}`, text: '問題', followUp: '' }));
  assert.equal(restore({ R001: { questions: oversized } }, ids).R001.questions.length, 50);
});

test('question reordering preserves text, source and boundary order without mutating input', () => {
  const original = [{ id: 'a', text: 'first', sourceId: 'channel' }, { id: 'b', text: 'second' }, { id: 'c', text: 'third' }];
  assert.deepEqual(move(original, 'a', 1).map(q => q.id), ['b', 'a', 'c']);
  assert.deepEqual(move(original, 'b', -1).map(q => q.id), ['b', 'a', 'c']);
  assert.deepEqual(move(original, 'a', -1), original);
  assert.deepEqual(move(original, 'c', 1), original);
  assert.deepEqual(move(original, 'missing', 1), original);
  assert.equal(original[0].id, 'a');
  assert.equal(move(original, 'a', 1)[1].sourceId, 'channel');
});


test('restores evidence from the correct candidate while rejecting foreign or invalid passages', () => {
  const ownLine = window.CardifCore.sentences(window.RESUME_DATA.resumes[0])[0];
  const q = { id: 'q1', text: '請說明你的經驗', followUp: '', resumeSource: ownLine.id };
  const restored = restore({ R001: { questions: [q], editor: { id: 'draft', text: '', followUp: '', resumeSource: ownLine.id } } }, ids);
  assert.equal(restored.R001.questions[0].resumeSource, ownLine.id);
  assert.equal(restored.R001.editor.resumeSource, ownLine.id);
  const unlinked = restore({ R001: { questions: [{ ...q, sourceId: 'channel', resumeSource: null }] } }, ids);
  assert.equal(unlinked.R001.questions[0].resumeSource, null);
  assert.equal(unlinked.R001.questions[0].sourceId, 'channel');
  const invalid = restore({ R001: { questions: [{ ...q, resumeSource: 'missing' }] } }, ids);
  assert.equal(invalid.R001.questions[0].resumeSource, undefined);
  const foreignLine = window.CardifCore.sentences(window.RESUME_DATA.resumes[0]).find(line => !window.CardifCore.sentences(window.RESUME_DATA.resumes[1]).some(other => other.id === line.id));
  if (foreignLine) {
    const foreign = restore({ R002: { questions: [{ ...q, resumeSource: foreignLine.id }] } }, ids);
    assert.equal(foreign.R002.questions[0].resumeSource, undefined);
  }
});

test('single question list restores a hidden editor and never regenerates deliberately deleted questions', () => {
  const legacy = restore({ R004: { questions: [], editor: { id: 'draft', text: '尚未完成', followUp: '' } } }, ids).R004;
  const ready = prepare('R004', legacy);
  assert.equal(ready.questions.length, 0);
  assert.equal(ready.editor.text, '尚未完成');
  assert.ok(ready.singleList);
  for (const q of ready.questions) assert.ok(suggestions.R004.some(s => s.id === q.sourceId));
  const emptied = { ...ready, questions: [], editor: null };
  const reloaded = restore({ R004: emptied }, ids).R004;
  assert.equal(prepare('R004', reloaded).questions.length, 0);
  const chosen = { ...legacy, questions: [{ id: 'own', text: '自己編輯的問題', followUp: '' }] };
  assert.equal(prepare('R004', chosen).questions.length, 1);
  assert.equal(prepare('R004', chosen).questions[0].text, '自己編輯的問題');
});

test('free question source search includes company and role, never assigns a passage automatically', () => {
  const resume = window.RESUME_DATA.resumes.find(r => r.id === 'R004');
  const results = findPassages(resume, '在豐禾人壽實習時的心得感悟');
  assert.equal(results[0].id, 'job1');
  assert.match(results[0].text, /豐禾人壽/);
  assert.ok(!results.some(line => /凌越科技/.test(line.text)));
  assert.deepEqual(findPassages(resume, '你最喜歡什麼顏色'), []);
  assert.deepEqual(findPassages(resume, ''), []);
  const source = passages(resume).find(line => line.id === 'job1');
  const entry = restore({ R004: { questions: [{ id: 'custom', text: '實習心得', followUp: '', resumeSource: source.id }] } }, ids).R004;
  assert.equal(entry.questions[0].resumeSource, 'job1');
  const invalid = restore({ R004: { questions: [{ id: 'custom', text: '實習心得', followUp: '', resumeSource: 'job99' }] } }, ids).R004;
  assert.equal(invalid.questions[0].resumeSource, undefined);
});

test('default question update preserves edited text and intentionally empty lists', () => {
  const custom = { singleList: true, questions: [{ id: 'default-event', sourceId: 'event', text: '使用者自己修改的問題', followUp: '' }], editor: null };
  assert.equal(prepare('R004', custom).questions[0].text, custom.questions[0].text);
  const ready = choose('R004', choose('R004', prepare('R004'), 'event'), 'ownership');
  assert.match(ready.questions[0].text, /主講/);
  assert.match(ready.questions[1].text, /通路夥伴/);
  assert.equal(prepare('R004', { ...ready, questions: [] }).questions.length, 0);
});

test('new interviews start empty; choosing a suggestion adds it once and preserves edits and legacy order', () => {
  assert.equal(prepare('R001').questions.length, 0);
  const selected = choose('R001', undefined, 'channel');
  assert.equal(selected.questions.length, 1);
  assert.equal(selected.questions[0].sourceId, 'channel');
  assert.equal(choose('R001', selected, 'channel').questions.length, 1);
  const fromQualification = { questions: [{ id: 'requirement-channel', text: suggestions.R001[0].text, resumeSource: 'e0-0', followUp: '' }], editor: null };
  assert.equal(choose('R001', fromQualification, 'channel').questions.length, 1);
  const edited = { ...selected, questions: selected.questions.map(q => ({ ...q, text: 'HR 改寫的問題' })) };
  assert.equal(choose('R001', edited, 'channel').questions[0].text, 'HR 改寫的問題');
  const legacy = { questions: [{ id: 'old', sourceId: 'event', text: '舊版已保存內容', followUp: '' }], editor: null };
  assert.deepEqual(prepare('R004', legacy).questions, legacy.questions);
  assert.throws(() => choose('R002', selected, 'channel'));
  assert.throws(() => choose('R001', { questions: Array.from({ length: 50 }, (_, i) => ({ id: `q${i}`, text: '自訂問題', followUp: '' })) }, 'channel'));
});
