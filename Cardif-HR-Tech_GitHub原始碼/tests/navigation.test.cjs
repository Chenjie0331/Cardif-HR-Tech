const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/navigation.js');

test('page transition renders after exit, enters the new surface and reverts on interruption', () => {
  const calls = [], main = {}, heading = {}, surface = {};
  const animation = kind => ({ revert() { calls.push(`${kind}:revert`); } });
  let exit, entrance;
  const gsap = {
    to(target, vars) { assert.equal(target, main); exit = vars; calls.push('exit'); return animation('exit'); },
    fromTo(targets, from, vars) { assert.deepEqual(targets, [heading, surface]); assert.equal(from.opacity, 0); entrance = vars; calls.push('enter'); return animation('enter'); }
  };
  const motion = create(gsap, main);
  motion.enter(() => calls.push('render'), () => [heading, surface]);
  assert.deepEqual(calls, ['exit']);
  exit.onComplete();
  assert.deepEqual(calls, ['exit', 'exit:revert', 'render', 'enter']);
  assert.equal(entrance.clearProps, 'opacity,transform');
  motion.cancel();
  assert.equal(calls.at(-1), 'enter:revert');
  motion.enter(() => calls.push('unused'), () => []);
  motion.cancel();
  assert.ok(!calls.includes('unused'));
  let rendered = false;
  create(null, main).enter(() => { rendered = true; }, () => []);
  assert.ok(rendered);
});
