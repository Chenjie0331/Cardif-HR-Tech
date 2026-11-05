(function (root) {
  'use strict';
  const A = root.CardifIntake;
  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }
  function create({ job, paperContent, receive }) {
    const page = document.querySelector('#applicationPage');
    let state = A.initial(), step = 1, unsaved = false;
    const read = () => A.restore(JSON.parse(localStorage.getItem(A.key) || 'null'));
    function sync() {
      const latest = read();
      latest.applications.forEach(receive);
      return latest;
    }
    function status(message, error = false) {
      const element = page.querySelector('#applicationStatus');
      if (element) { element.textContent = message; element.dataset.error = String(error); }
    }
    function persist() {
      try {
        const latest = read(); state.applications = latest.applications; state.receipt = latest.receipt;
        localStorage.setItem(A.key, JSON.stringify(state)); unsaved = false; status('草稿已儲存'); return true;
      }
      catch { unsaved = true; status('草稿儲存失敗，請保留頁面內容並重試。', true); return false; }
    }
    function capture() {
      const form = page.querySelector('form');
      if (!form || step === 3) return;
      const data = state.draft.data;
      if (step === 1) for (const input of form.querySelectorAll('[name]')) data[input.name] = input.value;
      if (step === 2) {
        for (const type of ['education', 'experience']) data[type] = [...form.querySelectorAll(`[data-entry="${type}"]`)].map(section => Object.fromEntries([...section.querySelectorAll('[data-name]')].map(input => [input.dataset.name, input.type === 'checkbox' ? input.checked : input.value])));
        for (const name of ['skills', 'certs', 'summary']) data[name] = form.elements[name].value;
      }
      state.draft.data = A.normalize(data);
    }
    function issue(error) {
      const area = page.querySelector('#applicationError');
      area.textContent = error.message; area.hidden = false;
      const input = page.querySelector(`#application-${error.field}`);
      if (input) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', 'applicationError'); input.focus(); }
      else area.focus();
    }
    function link(text, href, primary = false) {
      const result = node('a', `button ${primary ? 'primary' : 'secondary'}`, text); result.href = href; return result;
    }
    function button(text, callback, className = 'button secondary') {
      const result = node('button', className, text); result.type = 'button'; result.addEventListener('click', callback); return result;
    }
    function entry(type, item, index) {
      const section = node('fieldset', 'application-entry'); section.dataset.entry = type;
      section.append(node('legend', '', `${type === 'education' ? '學歷' : '經歷'} ${index + 1}`));
      const grid = node('div', 'application-fields');
      const fields = type === 'education' ? [['school', '學校（必填）'], ['major', '科系'], ['degree', '學位（必填）']] : [['company', '公司／單位（必填）'], ['title', '職稱／角色（必填）']];
      fields.push(['from', type === 'education' ? '開始月份' : '開始月份（必填）'], ['to', '結束月份']);
      for (const [name, title] of fields) {
        const label = node('label', '', title), input = node(name === 'degree' ? 'select' : 'input');
        input.dataset.name = name; input.id = `application-${type}-${index}-${name}`;
        if (name === 'degree') input.append(new Option('請選擇', ''), ...A.degrees.map(value => new Option(value, value)));
        else { input.type = ['from', 'to'].includes(name) ? 'month' : 'text'; input.maxLength = 120; }
        input.value = item[name]; if (name === 'to') input.disabled = item.current;
        label.append(input); grid.append(label);
      }
      const current = node('label', 'application-check'), check = node('input'); check.type = 'checkbox'; check.dataset.name = 'current'; check.checked = item.current;
      check.addEventListener('change', () => { const to = grid.querySelector('[data-name="to"]'); to.disabled = check.checked; if (check.checked) to.value = ''; });
      current.append(check, document.createTextNode(type === 'education' ? '仍在學' : '至今')); grid.append(current); section.append(grid);
      if (type === 'experience') {
        const label = node('label', '', '工作／實習／專案內容（必填）'), input = node('textarea');
        input.dataset.name = 'description'; input.id = `application-experience-${index}-description`; input.rows = 5; input.maxLength = 2000; input.value = item.description;
        label.append(input); section.append(label);
      }
      if (type !== 'education' || state.draft.data.education.length > 1) section.append(button('移除此筆', () => {
        capture(); const previous = state.draft.data[type].slice(); state.draft.data[type].splice(index, 1);
        if (persist()) render('2'); else state.draft.data[type] = previous;
      }, 'text-button remove-entry'));
      return section;
    }
    function details(form) {
      for (const type of ['education', 'experience']) {
        const section = node('section', 'application-section'); section.append(node('h2', '', type === 'education' ? '學歷' : '工作、實習與專案'));
        state.draft.data[type].forEach((item, index) => section.append(entry(type, item, index)));
        if (type === 'experience' && !state.draft.data.experience.length) section.append(node('p', '', '尚無經歷也可以繼續填寫。'));
        if (state.draft.data[type].length < 10) section.append(button(type === 'education' ? '新增學歷' : '新增經歷', () => {
          capture(); state.draft.data[type].push(A[type]());
          if (!persist()) { state.draft.data[type].pop(); return; }
          render('2');
          page.querySelector(`[data-entry="${type}"]:last-of-type input`)?.focus();
        }));
        form.append(section);
      }
      const section = node('section', 'application-section'); section.append(node('h2', '', '技能與自我介紹'));
      for (const [name, title, placeholder] of [['skills', '專長技能', '每行填寫一項技能'], ['certs', '證照', '每行填寫一張證照'], ['summary', '自我介紹', '介紹你的經驗、工作方式或應徵動機']]) {
        const label = node('label', '', title), input = node('textarea'); input.name = name; input.id = `application-${name}`; input.rows = name === 'summary' ? 6 : 3; input.maxLength = name === 'summary' ? 2000 : 1200; input.placeholder = placeholder; input.value = state.draft.data[name]; label.append(input); section.append(label);
      }
      form.append(section);
    }
    function navigate(next) {
      capture(); const error = next > step ? A.validate(state.draft.data, step) : null;
      if (error) { issue(error); return; }
      state.draft.step = next;
      if (!persist()) { state.draft.step = step; return; }
      location.hash = `#apply/${next}`;
    }
    function render(part) {
      try { const latest = sync(); if (!unsaved) state = latest; } catch { unsaved = true; }
      page.replaceChildren();
      if (part === 'sent') {
        const entry = state.applications.find(item => item.id === state.receipt);
        if (entry) {
          const receipt = node('section', 'application-receipt'); receipt.append(node('h2', '', `${entry.data.name}，你的履歷已完成模擬投遞。`), node('p', '', job.title), node('time', '', new Date(entry.submittedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })));
          receipt.append(node('p', '', '這份資料已保存在目前的瀏覽器，可切換至 HR 工作區接續展示。'));
          const actions = node('div', 'application-actions'); actions.append(link('到 HR 工作區查看', `#resume/${entry.id}`, true), button('再填一份履歷', () => { state.draft = A.initial().draft; if (persist()) location.hash = '#apply/1'; })); receipt.append(actions); page.append(receipt); return;
        }
        location.replace('#apply/job'); return;
      }
      const jobInfo = node('div', 'application-job-info'); jobInfo.append(node('h2', '', job.title), node('p', '', `${job.location}・全職`)); page.append(jobInfo);
      if (part === 'job') {
        jobInfo.append(link(state.draft.id ? '繼續填寫履歷' : '開始填寫履歷', `#apply/${state.draft.step}`, true));
        const section = node('section', 'application-job'); section.append(node('h3', '', '工作內容'), node('p', '', '服務合作通路、進行商品與銷售技巧教育訓練，協助銷售及行政流程，經營通路、分行與業務員。'), node('h3', '', '應徵條件'));
        const list = node('ul'); for (const text of ['3 年以上壽險業務輔導或個人銷售經驗', '能獨立舉辦中小型商品說明會及教育訓練', '合作通路、分行與業務員經營']) list.append(node('li', '', text)); section.append(list);
        const source = node('a', 'source-link', '104 職缺資料'); source.href = job.url; source.target = '_blank'; source.rel = 'noopener noreferrer'; section.append(source);
        section.append(node('p', 'application-demo-note', '本入口供競賽模擬使用，請填寫虛構資料。')); page.append(section); return;
      }
      step = [1, 2, 3].includes(Number(part)) ? Number(part) : state.draft.step;
      const error = step > 1 ? A.validate(state.draft.data, step === 2 ? 1 : 3) : null;
      if (error) { step = ['name', 'email', 'phone'].includes(error.field) ? 1 : 2; history.replaceState(null, '', `#apply/${step}`); }
      if (!state.draft.id) state.draft.id = `A-${crypto.randomUUID()}`;
      state.draft.step = step;
      const steps = node('nav', 'application-steps'); steps.setAttribute('aria-label', '填寫進度');
      ['基本資料', '學經歷', '確認送出'].forEach((text, index) => { const control = button(`${index + 1} ${text}`, () => navigate(index + 1), 'application-step'); if (index + 1 === step) control.setAttribute('aria-current', 'step'); steps.append(control); }); page.append(steps);
      const form = node('form', 'application-form'); form.noValidate = true;
      if (step === 1) {
        form.append(node('h2', '', '基本資料'), node('p', 'application-demo-note', '競賽模擬填寫，資料只保存在目前的瀏覽器。'));
        form.append(document.querySelector('#applicationBasicTemplate').content.cloneNode(true));
        for (const input of form.querySelectorAll('[name]')) input.value = state.draft.data[input.name];
      } else if (step === 2) details(form);
      else { form.append(node('h2', '', '確認履歷')); const preview = node('div', 'application-preview'); preview.append(paperContent(A.toResume({ id: state.draft.id, data: state.draft.data }, job))); form.append(preview); }
      const area = node('p', 'application-error'); area.id = 'applicationError'; area.hidden = true; area.tabIndex = -1; area.setAttribute('role', 'alert'); form.append(area);
      const footer = node('div', 'application-form-footer'), saved = node('span', '', ''); saved.id = 'applicationStatus'; saved.setAttribute('role', 'status'); footer.append(saved);
      const actions = node('div', 'application-actions'); if (step > 1) actions.append(button(step === 3 ? '返回修改' : '上一步', () => navigate(step - 1)));
      const next = node('button', 'button primary', step === 3 ? '送出模擬履歷' : step === 2 ? '預覽履歷' : '下一步'); next.type = 'submit'; actions.append(next); footer.append(actions); form.append(footer); page.append(form);
      form.addEventListener('input', event => { event.target.removeAttribute('aria-invalid'); capture(); persist(); });
      form.addEventListener('change', () => { capture(); persist(); });
      form.addEventListener('submit', event => {
        event.preventDefault(); if (step < 3) { navigate(step + 1); return; }
        next.disabled = true;
        try {
          const latest = read(); state.applications = latest.applications;
          const result = A.submit(state, job, new Date());
          localStorage.setItem(A.key, JSON.stringify(result.state));
          state = result.state; receive(result.entry); location.hash = '#apply/sent';
        } catch (error) { issue({ field: '', message: `送出未完成：${error.message} 請保留頁面後重試。` }); next.disabled = false; }
      });
      if (error) issue(error);
      if (unsaved) status('草稿尚未儲存，請保留頁面內容並重試。', true);
    }
    let loadError = false;
    try { state = sync(); } catch { loadError = true; }
    window.addEventListener('storage', event => { if (event.key === A.key) { try { sync(); root.dispatchEvent(new Event('cardif-intake-change')); } catch {} } });
    return { render, sync, get receipt() { return state.receipt; }, get loadError() { return loadError; } };
  }
  root.CardifApplicant = { create };
})(window);
