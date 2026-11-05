(function (root) {
  'use strict';
  function restore(saved, ids) {
    const known = values => [...new Set(Array.isArray(values) ? values.filter(id => ids.includes(id)) : [])];
    const order = known(saved?.order);
    return { order: [...order, ...ids.filter(id => !order.includes(id))], viewed: known(saved?.viewed),
      bookmarks: known(saved?.bookmarks), positions: Object.fromEntries(ids.map(id => [id, Math.max(0, Number(saved?.positions?.[id]) || 0)])) };
  }
  function reorder(order, visible, from, to) {
    if (!visible.includes(from) || !visible.includes(to) || from === to) return order.slice();
    const moved = visible.slice(), index = moved.indexOf(to);
    moved.splice(moved.indexOf(from), 1);
    moved.splice(index, 0, from);
    let next = 0;
    return order.map(id => visible.includes(id) ? moved[next++] : id);
  }
  function bindDrag(rail, { onCommit, motion }) {
    const doc = rail.ownerDocument, view = doc.defaultView, animations = new Map();
    let drag = null;
    function finish(cancel = false) {
      if (!drag) return;
      const current = drag; drag = null;
      view.cancelAnimationFrame(current.frame);
      current.ghost.remove();
      current.slip.classList.remove('is-dragging');
      animations.forEach(animation => animation.cancel()); animations.clear();
      // A route or filter may already have replaced the rail; never restore stale nodes.
      const intact = current.nodes.length === rail.children.length && current.nodes.every(node => rail.contains(node));
      const index = [...rail.children].indexOf(current.slip);
      if (cancel && intact) { rail.append(...current.nodes); rail.scrollLeft = current.scroll; }
      rail.classList.remove('is-sorting');
      if (rail.hasPointerCapture(current.pointerId)) rail.releasePointerCapture(current.pointerId);
      if (!cancel && intact && index !== current.nodes.indexOf(current.slip)) onCommit(current.slip.dataset.candidate, index);
    }
    function previewOrder() {
      const { slip, rect, x, startX } = drag, bounds = rail.getBoundingClientRect();
      const others = [...rail.children].filter(node => node !== slip);
      const center = rect.left + rect.width / 2 + x - startX;
      const index = others.filter(node => bounds.left + rail.clientLeft + node.offsetLeft - rail.scrollLeft + node.offsetWidth / 2 < center).length;
      if ([...rail.children].indexOf(slip) === index) return;
      const before = new Map(others.map(node => [node, node.getBoundingClientRect().left]));
      animations.forEach(animation => animation.cancel()); animations.clear();
      rail.insertBefore(slip, others[index] || null);
      if (motion()) others.forEach(node => {
        const dx = before.get(node) - node.getBoundingClientRect().left;
        if (dx) animations.set(node, node.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }],
          { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)' }));
      });
    }
    function frame(time) {
      if (!drag) return;
      if (!rail.contains(drag.slip)) { finish(true); return; }
      const elapsed = Math.min(32, time - (drag.time ?? time)); drag.time = time;
      if (drag.moved) {
        const rect = rail.getBoundingClientRect();
        const left = Math.max(0, rect.left), right = Math.min(view.innerWidth, rect.right), edge = Math.min(48, (right - left) / 4);
        if (drag.y >= rect.top - 24 && drag.y <= rect.bottom + 24) {
          const speed = drag.x < left + edge ? -Math.min(1, (left + edge - drag.x) / edge)
            : drag.x > right - edge ? Math.min(1, (drag.x - right + edge) / edge) : 0;
          rail.scrollLeft = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, rail.scrollLeft + speed * elapsed * .6));
          previewOrder();
        }
      }
      drag.frame = view.requestAnimationFrame(frame);
    }
    rail.addEventListener('pointerdown', event => {
      const grip = event.target.closest('.slip-grip');
      if (drag || !grip || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      const slip = grip.closest('.resume-slip'), rect = slip.getBoundingClientRect(), ghost = slip.cloneNode(true);
      ghost.classList.add('slip-ghost'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
      ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      doc.body.append(ghost);
      drag = { slip, ghost, rect, pointerId: event.pointerId, nodes: [...rail.children], scroll: rail.scrollLeft,
        startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
      rail.classList.add('is-sorting'); slip.classList.add('is-dragging');
      rail.setPointerCapture(event.pointerId);
      drag.frame = view.requestAnimationFrame(frame);
    });
    rail.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.x = event.clientX; drag.y = event.clientY;
      drag.moved ||= Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 4;
      drag.ghost.style.transform = `translate(${drag.x - drag.startX}px, ${drag.y - drag.startY}px) rotate(${motion() ? -2 : 0}deg)`;
    });
    rail.addEventListener('pointerup', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.moved) previewOrder();
      finish();
    });
    for (const type of ['pointercancel', 'lostpointercapture']) rail.addEventListener(type, event => {
      if (drag && event.pointerId === drag.pointerId) finish(true);
    });
    doc.addEventListener('keydown', event => { if (drag && event.key === 'Escape') { event.preventDefault(); finish(true); } });
    for (const type of ['blur', 'resize', 'hashchange', 'pagehide']) view.addEventListener(type, () => finish(true));
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) finish(true); });
  }
  const api = { restore, reorder, bindDrag };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CardifReading = api;
})(typeof window === 'undefined' ? globalThis : window);
