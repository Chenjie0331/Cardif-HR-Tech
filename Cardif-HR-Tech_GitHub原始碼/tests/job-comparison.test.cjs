const { test } = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
require('../js/data.js');
require('../js/core.js');
const C = require('../js/job-comparison.js');
const resumes = window.RESUME_DATA.resumes, job = window.JOB.url;
const make = () => C.restore(null, job, resumes.map(r => r.id));

test('job weights total 100, apply to every candidate and preserve original list order', () => {
  const state = make();
  assert.equal(C.validWeights(state.weights), true);
  const before = resumes.map(r => r.id);
  const scores = resumes.map(r => C.result(state, r).lower);
  state.weights = { channel: 0, training: 100, insurance: 0, tools: 0 };
  assert.ok(resumes.some((r, i) => C.result(state, r).lower !== scores[i]));
  const sorted = C.ordered(resumes, state, 'score');
  assert.deepEqual(resumes.map(r => r.id), before);
  assert.deepEqual(C.ordered(resumes, state, 'original').map(r => r.id), before);
  for (let i = 1; i < sorted.length; i++) assert.ok(C.result(state, sorted[i - 1]).lower >= C.result(state, sorted[i]).lower);
  assert.equal(C.validWeights({ channel: 99, training: 0, insurance: 0, tools: 0 }), false);
  assert.equal(C.validWeights({ channel: 35.5, training: 29.5, insurance: 25, tools: 10 }), false);
  assert.throws(() => C.result({ ...state, weights: {} }, resumes[0]));
});

test('missing evidence stays unknown and explicit zero remains distinct; new intake never inherits demo grades', () => {
  const state = make(), partial = C.result(state, resumes[1]);
  assert.equal(C.rating(state, resumes[1], 'channel'), null);
  assert.equal(partial.pending, 35);
  assert.equal(partial.upper - partial.lower, 35);
  assert.equal(C.rating(state, resumes[2], 'insurance'), 0);
  state.ratings.R002 = { channel: 4 };
  assert.equal(C.result(state, resumes[1]).pending, 0);
  assert.equal(C.result(state, resumes[1]).lower, partial.upper);
  const incoming = { ...resumes[0], origin: 'online' };
  assert.deepEqual(C.result(state, incoming), { lower: 0, upper: 100, pending: 100, coverage: 0 });
});

test('storage restores only same-job bounded ratings and weights without changing qualification records', () => {
  const input = { version: 1, job, weights: { channel: 0, training: 100, insurance: 0, tools: 0 }, ratings: { R001: { channel: null, training: 0, tools: 7, insurance: '4', foreign: 4 }, foreign: { channel: 4 } }, checks: { experience: 'confirmed' } };
  const state = C.restore(JSON.parse(JSON.stringify(input)), job, ['R001']);
  assert.deepEqual(state.weights, input.weights);
  assert.equal(state.ratings.R001.channel, null);
  assert.equal(state.ratings.R001.training, 0);
  assert.equal(Object.hasOwn(state.ratings.R001, 'tools'), false);
  assert.equal(Object.hasOwn(state.ratings.R001, 'insurance'), false);
  assert.equal(Object.hasOwn(state.ratings, 'foreign'), false);
  assert.equal(Object.hasOwn(state, 'checks'), false);
  assert.deepEqual(C.restore(input, 'other-job', ['R001']).weights, make().weights);
  const restored = C.restore(JSON.parse(JSON.stringify(state)), job, ['R001']);
  assert.equal(C.rating(restored, resumes[0], 'training'), 0);
  assert.equal(C.rating(restored, resumes[0], 'channel'), null);
});

test('every demo grade has an existing matching resume source and remains within the defined scale', () => {
  const patterns = { channel: /通路|分行|轉往|客戶/, training: /說明會|訓練|助教/, insurance: /壽險|保險|保單/, tools: /Excel|Word|PowerPoint/ };
  for (const resume of resumes) {
    const lines = window.CardifCore.sentences(resume);
    C.criteria.forEach((c, index) => {
      const [value, source] = C.profiles[resume.id][index];
      assert.ok(value === null || Number.isInteger(value) && value >= 0 && value <= 4);
      const line = lines.find(l => l.id === source);
      assert.ok(line, `${resume.id}/${c.key}/${source}`);
      assert.match(line.text, patterns[c.key], `${resume.id}/${c.key}`);
    });
    const range = C.result(make(), resume);
    assert.ok(range.lower >= 0 && range.upper <= 100 && range.lower <= range.upper);
  }
});
