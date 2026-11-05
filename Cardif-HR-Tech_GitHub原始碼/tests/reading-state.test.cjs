const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '../js/reading-state.js');

test('stored reading state keeps known people and appends new resumes', () => {
  assert.ok(fs.existsSync(source), 'reading state has not been implemented');
  const D = require(source);
  const state = D.restore({ order: ['c', 'c', 'removed'], viewed: ['b', 'removed'], positions: { b: 340 } }, ['a', 'b', 'c']);
  assert.deepEqual(state.order, ['c', 'a', 'b']);
  assert.deepEqual(state.viewed, ['b']);
  assert.equal(state.positions.b, 340);
  assert.equal(state.viewed.includes('a'), false, 'previewing the first resume must not mark it read');
});

test('reordering visible resumes does not move hidden filtered resumes', () => {
  assert.ok(fs.existsSync(source), 'reading state has not been implemented');
  const D = require(source);
  assert.deepEqual(D.reorder(['a', 'b', 'c', 'd'], ['a', 'c', 'd'], 'd', 'a'), ['d', 'b', 'a', 'c']);
  assert.deepEqual(D.reorder(['a', 'b'], ['a', 'b'], 'missing', 'a'), ['a', 'b']);
});
