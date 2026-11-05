(function () {
  'use strict';
  const A = window.CardifAuth, $ = selector => document.querySelector(selector);
  let store, current = null, wasLocked = false, entrance;
  const screen = $('#authScreen');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function animate(target) {
    entrance?.revert();
    if (!window.gsap || reduced.matches || document.documentElement.dataset.motion === 'off') return;
    entrance = gsap.fromTo(target, { y: 14, opacity: .6 }, { y: 0, opacity: 1, duration: .42, ease: 'power2.out', clearProps: 'transform,opacity' });
  }
  reduced.addEventListener('change', () => { if (reduced.matches) entrance?.revert(); });
  function tab(name) {
    $('#loginForm').hidden = name !== 'login'; $('#registerForm').hidden = name !== 'register';
    $('#authTitle').textContent = name === 'login' ? '登入Cardif-HR Tech' : '建立工作台帳號';
    document.querySelectorAll('[data-auth-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.authTab === name)));
    $('#authError').textContent = ''; $('#registerError').textContent = '';
    animate(name === 'login' ? $('#loginForm') : $('#registerForm'));
  }
  function allowRoute() {
    const locked = !current && !A.isPublicRoute(location.hash);
    document.body.classList.toggle('auth-locked', locked); screen.hidden = !locked;
    for (const selector of ['.site-header', 'main', '.skip-link', '#notificationPanel', '#maintenancePanel']) $(selector).inert = locked;
    if (locked) {
      document.title = '登入｜Cardif-HR Tech';
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      document.querySelectorAll(':popover-open').forEach(popover => popover.hidePopover());
      if (!wasLocked) { window.scrollTo({ top: 0, behavior: 'instant' }); tab('login'); animate($('.auth-card')); $('#authTitle').focus({ preventScroll: true }); }
    } else if (wasLocked) {
      entrance?.revert();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const button = $('#accountButton');
    button.textContent = current ? current.name.slice(0, 2) : '登入';
    button.setAttribute('aria-label', current ? `${current.name}，${A.roles[current.role]}，開啟帳號選單` : '登入 HR 工作台');
    $('#accountName').textContent = current?.name || '';
    $('#accountEmail').textContent = current?.email || '';
    $('#accountRole').textContent = current ? A.roles[current.role] : '';
    wasLocked = locked;
    return !locked;
  }
  function notify() { allowRoute(); window.dispatchEvent(new Event('cardif:auth-change')); }
  function message(error) {
    return error instanceof DOMException || error instanceof SyntaxError ? '瀏覽器無法讀取或儲存帳號，請確認儲存設定後重試。' : error.message;
  }
  async function submit(event) {
    event.preventDefault();
    const form = event.target, button = form.querySelector('[type=submit]');
    const error = form.querySelector('[role=alert]'); error.textContent = ''; button.disabled = true;
    try {
      await ready;
      if (!store) throw new Error('登入功能無法初始化，請重新整理後再試。');
      const data = Object.fromEntries(new FormData(form));
      if (form.id === 'registerForm') {
        await store.register(data);
        $('#loginForm [name=email]').value = data.email.trim().toLowerCase();
        $('#loginForm [name=password]').value = '';
        form.reset(); tab('login');
        $('#authNotice').textContent = '帳號已建立，請使用剛才設定的密碼登入。';
        $('#loginForm [name=password]').focus();
      } else {
        current = await store.login(data.email, data.password);
        form.reset(); $('#authNotice').textContent = '';
        if (location.hash === '#login') history.replaceState(null, '', '#home');
        notify(); $('#pageTitle').focus({ preventScroll: true });
      }
    } catch (reason) { error.textContent = message(reason); }
    finally { button.disabled = false; }
  }
  document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => { tab(button.dataset.authTab); $('#authNotice').textContent = ''; }));
  document.querySelectorAll('[data-fill]').forEach(button => button.addEventListener('click', () => {
    tab('login'); $('#loginForm [name=email]').value = button.dataset.fill;
    $('#loginForm [name=password]').value = 'Cardif123!'; $('#loginForm [type=submit]').focus();
  }));
  $('#loginForm').addEventListener('submit', submit); $('#registerForm').addEventListener('submit', submit);
  $('#accountButton').addEventListener('click', () => {
    if (current) $('#accountDialog').showModal(); else location.hash = '#login';
  });
  $('#closeAccount').addEventListener('click', () => $('#accountDialog').close());
  $('#logoutButton').addEventListener('click', () => {
    try { store.logout(); current = null; $('#accountDialog').close(); $('#loginForm').reset(); tab('login'); history.replaceState(null, '', '#home'); notify(); }
    catch (error) { $('#accountError').textContent = message(error); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== null && ![A.USERS_KEY, A.SESSION_KEY].includes(event.key)) return;
    try { current = store?.user() || null; }
    catch (error) { current = null; $('#authError').textContent = message(error); }
    notify();
  });
  // shortcut: these accounts and the route gate are local demonstrations, not server access control.
  window.CardifAuthUI = { allowRoute };
  allowRoute();
  const ready = (async () => {
    try { store = A.create(localStorage, crypto); await store.seed(); current = store.user(); }
    catch (error) { $('#authError').textContent = message(error); }
    notify();
  })();
})();
