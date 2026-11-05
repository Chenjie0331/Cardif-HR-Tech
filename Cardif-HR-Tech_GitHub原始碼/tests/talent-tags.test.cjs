const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = {};
require('../js/data.js');
require('../js/core.js');
const resumes = window.RESUME_DATA.resumes, job = window.JOB;
function analyze(resume, context = job) {
  const file = path.join(__dirname, '../js/talent-tags.js');
  assert.ok(fs.existsSync(file), 'resume profile analysis is not implemented');
  return require(file).analyze(resume, context);
}
const person = (summary, extra = {}) => ({ id: 'NEW', summary, experience: [], education: [], skills: [], certs: [], ...extra });

test('profiles describe different people with short names, explanations and valid source relationships', () => {
  const profiles = resumes.map(r => analyze(r));
  assert.equal(new Set(profiles.map(tags => tags.map(t => t.name).join('|'))).size, 5);
  for (const [i, tags] of profiles.entries()) {
    assert.ok(tags.length > 0);
    const sources = new Set(window.CardifCore.sentences(resumes[i]).map(x => x.id));
    assert.equal(new Set(tags.map(t => t.id)).size, tags.length);
    for (const tag of tags) {
      assert.ok(tag.name.length <= 12);
      assert.ok(tag.description.length >= 12);
      assert.equal(tag.jobUrl, job.url);
      assert.equal(tag.schemaVersion, 2);
      assert.equal(tag.origin, 'resume');
      assert.ok(tag.sources.length && tag.sources.every(id => sources.has(id)));
    }
  }
  assert.ok(profiles[0].some(t => t.name === '擅長商品轉譯'));
  assert.ok(!profiles[0].some(t => t.name === '跨領域轉職'));
  assert.ok(profiles[1].some(t => t.name === '尚無大型主講經驗'));
  assert.ok(profiles[3].some(t => t.name === '經驗以支援為主'));
  assert.ok(profiles[4].some(t => t.name === '跨領域轉職'));
});

test('negation and stated limitations do not become strengths; missing details are not deficiencies', () => {
  const tags = analyze(person('沒有保險商品銷售經驗，未獨立主講大型說明會。'));
  assert.ok(tags.some(t => t.name === '尚無大型主講經驗'));
  assert.ok(!tags.some(t => /熟悉銀行通路|有主講主持經驗|偏重客戶經營/.test(t.name)));
  assert.deepEqual(analyze(person('希望加入團隊。')), []);
  const mixed = analyze(person('沒有保險銷售經驗，但常主持產品說明會。'));
  assert.ok(mixed.some(t => t.name === '有主講主持經驗'));
  assert.ok(!mixed.some(t => /沉穩|抗壓|細心|領導/.test(t.name)));
  assert.deepEqual(analyze(person('希望獨立主講說明會。將來想要主動協調跨部門工作。')), []);
});

test('new intake profiles use the submitted contents; recent graduates and no work history are distinct', () => {
  const fresh = person('今年應屆畢業，尚無工作經驗。', { origin: 'online' });
  const labels = analyze(fresh).map(t => t.name);
  assert.ok(labels.includes('應屆畢業'));
  assert.ok(labels.includes('尚無工作經驗'));
  assert.ok(!labels.includes('擅長商品轉譯'));
  const experienced = person('無工作經驗以外的內容未填寫。');
  assert.ok(!analyze(experienced).some(t => t.name === '應屆畢業'));
  assert.deepEqual(analyze(fresh, { title: '別的職缺', url: '' }), []);
});

test('modern profile backups retain explanation metadata; legacy backups remain readable', () => {
  const M = require('../js/recruitment.js');
  const tags = analyze(resumes[0]);
  const base = { format: 'cardif-recruitment', version: 1, candidate: 'R001', case: {}, interview: { questions: [] }, tags, note: '' };
  assert.deepEqual(M.parseBackup(base, ['R001']).tags, tags);
  const legacy = { id: 'insurance', name: '壽險經驗', status: 'confirmed', sources: ['s0'] };
  assert.equal(M.parseBackup({ ...base, tags: [legacy] }, ['R001']).tags[0].name, '壽險經驗');
  assert.throws(() => M.parseBackup({ ...base, tags: [{ ...tags[0], description: 'x'.repeat(1201) }] }, ['R001']));
  const html = M.report({ resume: resumes[0], job, record: M.restoreCase(null), draft: { questions: [] }, review: { summary: '', points: [] }, note: '', tags });
  assert.ok(html.includes('擅長商品轉譯'));
  assert.ok(!html.includes('已確認標籤'));
});
