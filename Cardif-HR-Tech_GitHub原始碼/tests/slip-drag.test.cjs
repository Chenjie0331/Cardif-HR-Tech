const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/reading-state.js');

// A small layout fixture: exercise the production pointer handlers and frame loop.
function fixture(width = 600) {
  const events = new Map(), frames = new Map(), commits = [];
  let frameId = 0, time = 0, captured = null;
  const classes = () => ({ add() {}, remove() {} });
  const view = {
    innerWidth: width, addEventListener: on,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  function on(type, fn) { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); }
  const rail = {
    children: [], clientLeft: 0, scrollLeft: 0, clientWidth: width, classList: classes(),
    ownerDocument: { defaultView: view, body: { append() {} }, addEventListener: on },
    addEventListener: on, contains(node) { return this.children.includes(node.slip || node); },
    setPointerCapture(id) { captured = id; }, hasPointerCapture(id) { return captured === id; },
    releasePointerCapture() { captured = null; },
    getBoundingClientRect() { return { left: 0, right: width, top: 0, bottom: 100 }; },
    insertBefore(node, before) {
      this.children.splice(this.children.indexOf(node), 1);
      this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node);
    },
    append(...nodes) { this.children = nodes.slice(); }
  };
  Object.defineProperty(rail, 'scrollWidth', { get: () => rail.children.length * 110 });
  rail.children = ['a', 'b', 'c', 'd', 'e'].map(id => {
    const slip = { dataset: { candidate: id }, classList: classes(), style: {}, offsetWidth: 100,
      closest: () => slip, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [],
      getBoundingClientRect() { return { left: this.offsetLeft - rail.scrollLeft, top: 0, width: 100, height: 100 }; },
      cloneNode() { return { ...this, style: {}, remove() {} }; },
      animate() { return { cancel() {} }; }
    };
    Object.defineProperty(slip, 'offsetLeft', { get: () => rail.children.indexOf(slip) * 110 });
    return slip;
  });
  assert.equal(typeof D.bindDrag, 'function', 'live drag controller must be available');
  D.bindDrag(rail, { onCommit: (...args) => commits.push(args), motion: () => true });
  function emit(type, values = {}) {
    const event = { pointerId: 1, button: 0, isPrimary: true, preventDefault() {}, ...values };
    for (const fn of events.get(type) || []) fn(event);
  }
  return { rail, commits, order: () => rail.children.map(s => s.dataset.candidate), emit,
    start(id, x) { const slip = rail.children.find(s => s.dataset.candidate === id);
      emit('pointerdown', { target: { slip, closest: () => ({ closest: () => slip }) }, clientX: x, clientY: 70 }); },
    move(x, pointerId = 1) { emit('pointermove', { clientX: x, clientY: 70, pointerId }); },
    tick() { time += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); },
    frames
  };
}

test('neighbors change order while the pointer is still held; save only on release', () => {
  const f = fixture(); f.start('c', 300); f.move(60); f.tick();
  assert.deepEqual(f.order(), ['c', 'a', 'b', 'd', 'e']);
  assert.equal(f.commits.length, 0);
  f.move(440); f.tick();
  assert.deepEqual(f.order(), ['a', 'b', 'd', 'c', 'e']);
  f.emit('pointerup');
  assert.deepEqual(f.commits, [['c', 3]]);
  assert.equal(f.frames.size, 0);
});

test('cancel restores order and scroll without saving; another finger cannot end a drag', () => {
  const f = fixture(250); f.rail.scrollLeft = 110; f.start('c', 190);
  f.move(20, 2); f.tick(); assert.deepEqual(f.order(), ['a', 'b', 'c', 'd', 'e']);
  f.move(20); f.tick(); f.emit('pointerup', { pointerId: 2 });
  assert.equal(f.commits.length, 0);
  f.emit('pointercancel');
  assert.deepEqual(f.order(), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(f.rail.scrollLeft, 110);
  assert.equal(f.commits.length, 0);
  assert.equal(f.frames.size, 0);
});

test('holding at either edge keeps scrolling and reordering without new pointer events', () => {
  const f = fixture(250); f.start('a', 80); f.move(248);
  for (let i = 0; i < 80; i++) f.tick();
  assert.equal(f.rail.scrollLeft, 300);
  assert.equal(f.order().at(-1), 'a');
  f.move(2);
  for (let i = 0; i < 80; i++) f.tick();
  assert.equal(f.rail.scrollLeft, 0);
  assert.equal(f.order()[0], 'a');
  f.emit('pointerup'); assert.equal(f.commits.length, 0);
});

test('Escape and lost capture cancel preview rather than committing it', () => {
  for (const type of ['keydown', 'lostpointercapture', 'blur']) {
    const f = fixture(); f.start('c', 300); f.move(60); f.tick();
    f.emit(type, { key: 'Escape' });
    assert.deepEqual(f.order(), ['a', 'b', 'c', 'd', 'e']);
    assert.equal(f.commits.length, 0);
  }
});
