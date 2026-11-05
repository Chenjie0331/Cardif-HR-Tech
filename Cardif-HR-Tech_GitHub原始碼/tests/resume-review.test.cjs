const { test } = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../js/data.js');
require('../js/core.js');
const { reviews, restoreNotes } = require('../js/resume-review.js');
const { resumes } = window.RESUME_DATA;

test('every review points to the exact supporting resume passage', () => {
  assert.deepEqual(Object.keys(reviews).sort(), resumes.map(r => r.id).sort());
  for (const resume of resumes) {
    const lines = window.CardifCore.sentences(resume);
    for (const point of reviews[resume.id].points) {
      const source = lines.find(line => line.id === point.source);
      assert.ok(source, `${resume.id}: missing ${point.source}`);
      assert.ok(source.text.includes(point.quote), `${resume.id}: changed evidence for ${point.source}`);
    }
  }
});

test('contact details are complete for all five resume layouts', () => {
  for (const resume of resumes) {
    for (const key of ['location', 'phone', 'email', 'availability', 'contactTime']) {
      assert.equal(typeof resume.contact[key], 'string');
      assert.ok(resume.contact[key].trim());
    }
    assert.match(resume.contact.email, /@example\.com$/);
  }
});

test('resume content is separate from the full official job title and review', () => {
  assert.equal(window.JOB.title, '業務發展部 保險顧問 Insurance Consultant (北區)');
  for (const resume of resumes) {
    assert.equal(Object.hasOwn(resume, 'review'), false);
    assert.equal(Object.hasOwn(resume, 'hrNote'), false);
  }
});

test('stored notes keep only known resumes, valid dates and bounded text', () => {
  const date = '2026-10-31T10:00:00.000Z';
  const stored = { R001: { text: '下次確認通路分工', updatedAt: date, injected: true },
    R002: { text: 'x'.repeat(2001), updatedAt: date }, R003: { text: 'note', updatedAt: 'bad' },
    unknown: { text: 'another person', updatedAt: date } };
  assert.deepEqual({ ...restoreNotes(stored, resumes.map(r => r.id)) }, {
    R001: { text: '下次確認通路分工', updatedAt: date }
  });
  assert.deepEqual({ ...restoreNotes(null, ['R001']) }, {});
  assert.deepEqual({ ...restoreNotes([], ['R001']) }, {});
  assert.deepEqual({ ...restoreNotes({ R001: { text: '', updatedAt: date } }, ['R001']) }, { R001: { text: '', updatedAt: date } });
});
