(function (root) {
  'use strict';
  function create(gsap, main) {
    let animation;
    function cancel() { animation?.revert(); animation = null; }
    function enter(render, targets) {
      cancel();
      if (!gsap) { render(); return; }
      animation = gsap.to(main, {
        opacity: 0, y: -12, duration: .2, ease: 'power1.in',
        onComplete() {
          cancel();
          render();
          animation = gsap.fromTo(targets(), { opacity: 0, y: 28 }, {
            opacity: 1, y: 0, duration: .6, stagger: .08, ease: 'power3.out',
            clearProps: 'opacity,transform', onComplete() { animation = null; }
          });
        }
      });
    }
    return { enter, cancel };
  }
  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardifNavigation = api;
})(typeof window === 'object' ? window : globalThis);
