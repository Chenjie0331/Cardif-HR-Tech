const { test } = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../js/data.js');
require('../js/core.js');
const A = require('../js/intake.js');
window.CardifInterview = require('../js/interview.js');
const M = require('../js/recruitment.js');
const review = require('../js/resume-review.js');
const id = 'A-12345678-1234-1234-1234-123456789abc';
function fixture() {
  const state = A.initial();
  state.draft = { id, step: 3, data: A.normalize({ name: '展示應徵者', email: 'demo@example.com', phone: '0900-123-456',
    education: [{ school: '展示大學', major: '保險學系', degree: '學士', from: '2016-09', to: '2020-06' }],
    experience: [{ company: '展示人壽', title: '通路專員', from: '2020-07', current: true, description: '安排四場通路培訓，負責教材與授課。' }], skills: 'Excel\n通路培訓', certs: '人身保險業務員', summary: '以教學與通路服務為主。' }) };
  return state;
}
test('retiring the requested test submission preserves other applicants and clears its receipt', () => {
  const entry = A.submit(fixture(), window.JOB, new Date()).entry;
  const retired = { ...entry, id: 'A-d45fcd3c-e0b9-4d3f-86d2-5a443454057b', data: { ...entry.data, name: '馬國八' } };
  const input = { ...A.initial(), applications: [retired, entry], receipt: retired.id };
  const original = JSON.stringify(input), restored = A.restore(input);
  assert.deepEqual(restored.applications.map(x => x.id), [entry.id]);
  assert.equal(restored.receipt, null);
  assert.equal(JSON.stringify(input), original);
});
test('submission retains an immutable application, clears the draft and is idempotent', () => {
  const before = fixture(), copy = structuredClone(before);
  const first = A.submit(before, window.JOB, new Date('2026-11-03T16:00:00Z'));
  assert.deepEqual(before, copy);
  assert.equal(first.state.applications.length, 1);
  assert.equal(first.state.receipt, id);
  assert.equal(first.state.draft.data.name, '');
  const repeat = A.submit({ ...before, applications: first.state.applications }, window.JOB, new Date());
  assert.equal(repeat.state.applications.length, 1);
  assert.equal(repeat.state.receipt, id);
  assert.equal(repeat.state.draft.id, '');
  const resume = A.toResume(first.entry, window.JOB);
  assert.equal(resume.origin, 'online');
  assert.equal(resume.experience[0].period, '2020/07–至今');
  assert.deepEqual(resume.skills, ['Excel', '通路培訓']);
});
test('contact, incomplete experience and reversed dates block submission; no work history is allowed', () => {
  const data = fixture().draft.data;
  assert.equal(A.validate({ ...data, email: 'wrong' }).field, 'email');
  assert.equal(A.validate({ ...data, phone: 'abc123' }).field, 'phone');
  assert.equal(A.validate({ ...data, experience: [{ ...data.experience[0], description: '' }] }).field, 'experience-0-description');
  assert.equal(A.validate({ ...data, experience: [{ ...data.experience[0], current: false, to: '2019-01' }] }).field, 'experience-0-to');
  assert.equal(A.validate({ ...data, experience: [], summary: '', skills: '', certs: '' }), null);
  assert.equal(A.validate({ ...data, skills: 'a'.repeat(61) }).field, 'skills');
});
test('restoration preserves partial drafts and rejects malformed, duplicate or foreign applications', () => {
  const saved = A.submit(fixture(), window.JOB, new Date()).state;
  saved.draft = { id: '', step: 2, data: { name: '尚未填完', email: 'half', education: [] } };
  saved.applications.push(saved.applications[0], { ...saved.applications[0], id: 'R001' }, { ...saved.applications[0], jobId: 'another-job' }, { ...saved.applications[0], submittedAt: null });
  const clean = A.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(clean.applications.length, 1);
  assert.equal(clean.draft.data.email, 'half');
  assert.equal(clean.draft.step, 2);
  assert.equal(clean.receipt, id);
  assert.equal(A.restore({ version: 9 }).applications.length, 0);
});
test('new applicants use their own sources, no preset interview questions or invented assessments', () => {
  const entry = A.submit(fixture(), window.JOB, new Date()).entry;
  const resume = A.toResume(entry, window.JOB);
  window.RESUME_DATA.resumes.push(resume);
  const draft = window.CardifInterview.prepare(id);
  assert.equal(draft.questions.length, 0);
  const sources = window.CardifInterview.passages(resume);
  assert.ok(sources.find(p => p.id === 'job0').text.includes('四場通路培訓'));
  assert.equal(review.forResume(resume).points[0].quote, resume.experience[0].description);
  assert.equal(M.questionFor(resume, 'training'), null);
  assert.equal(M.assessment(resume).length, 6);
  assert.ok(M.assessment(resume).find(item => item.id === 'training').text.includes('四場通路培訓'));
  assert.ok(!M.assessment(resume).find(item => item.id === 'language').text.includes('Excel'));
  const question = { id: 'new-question', text: '四場培訓如何確認學員理解？', followUp: '', resumeSource: 'job0' };
  const restored = window.CardifInterview.restore({ [id]: { questions: [question], singleList: true } }, [id]);
  assert.equal(restored[id].questions[0].resumeSource, 'job0');
  const report = M.report({ resume: { ...resume, name: '<img src=x onerror=alert(1)>' }, job: window.JOB, record: M.restoreCase(null), draft: { questions: [question] }, review: review.forResume(resume), note: '<script>alert(1)</script>', tags: [] });
  assert.ok(report.includes('&lt;img'));
  assert.ok(report.includes('四場通路培訓'));
  assert.ok(!report.includes('<script>'));
  assert.doesNotThrow(() => M.report({ resume, job: window.JOB, record: M.restoreCase(null), draft: { questions: [{ id: 'plain', text: '工作動機？', followUp: '' }] }, review: review.forResume(resume), note: '', tags: [] }));
});
