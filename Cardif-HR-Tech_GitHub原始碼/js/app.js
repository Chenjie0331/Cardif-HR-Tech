(function () {
  'use strict';
  const C = window.CardifCore, R = window.RESUME_DATA.resumes, J = window.JOB;
  let applicant, postUI, comparison;
  const $ = selector => document.querySelector(selector);
  const template = id => $(`#${id}`).content.cloneNode(true);
  const row = id => template(id).firstElementChild;
  const field = (root, name) => root.querySelector(`[data-field="${name}"]`);
  const key = 'cardif-hr-prototype-v1';
  const workKey = 'cardif-resume-workspace-v1';
  const readingKey = 'cardif-reading-desk-v1';
  let reading = window.CardifReading.restore(null, R.map(r => r.id));
  let readingFilter = 'all', workFilter = 'all', sidebarPanel = window.matchMedia('(min-width:1100px)').matches ? 'highlights' : null;
  const noteKey = 'cardif-resume-notes-v1';
  const interviewKey = 'cardif-interview-drafts-v1', I = window.CardifInterview;
  let interviewDrafts = Object.create(null), removedQuestion = null;
  const M = window.CardifRecruitment, caseKey = 'cardif-recruitment-cases-v1';
  const jobScopeKey = 'cardif-job-scope-v1';
  let jobScope = 'unknown';
  let caseRecords = Object.create(null), qualificationView = 'requirements';
  const caseRecord = () => caseRecords[state.openId] ??= M.restoreCase(null);
  const exportRecord = () => ({ ...caseRecord(), applicability: M.applicability(caseRecord(), jobScope), scopeOverride: true });
  const detailMode = () => ['interview', 'qualification', 'after'].includes(document.body.dataset.workspaceTool);
  let toolSwitching = false, workbenchTransition;
  const pageMotion = window.CardifNavigation.create(window.gsap, $('main'));
  const interviewMode = () => document.body.dataset.workspaceTool === 'interview';
  const afterMode = () => document.body.dataset.workspaceTool === 'after';
  let reviewNotes = Object.create(null), noteTimer, notesSaved = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { tags: {}, log: [], theme: 'dark', motion: true, selected: R[0].id,
    search: '', filter: '', jobSearch: '', source: null, openId: null, lastWork: null };
  let toastTimer, currentRoute = '';
  const names = r => r.name;
  const masked = value => value.replace(/^（虛構）/, '');
  const selected = () => R.find(r => r.id === state.selected) || R[0];
  const defaultTags = r => window.CardifTalentTags.analyze(r, J);
  const tagsOf = r => state.tags[r.id] ??= defaultTags(r);
  function receiveApplication(entry) {
    if (R.some(resume => resume.id === entry.id)) return;
    R.push(window.CardifIntake.toResume(entry, J));
    reading = window.CardifReading.restore(reading, R.map(resume => resume.id));
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3400);
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (!saved || typeof saved !== 'object') return;
      if (['dark', 'light'].includes(saved.theme)) state.theme = saved.theme;
      if (typeof saved.motion === 'boolean') state.motion = saved.motion;
      if (Array.isArray(saved.log)) state.log = saved.log.filter(entry => R.some(r => r.id === entry?.candidate)
        && typeof entry.action === 'string' && typeof entry.time === 'string'
        && entry.action.length < 300 && !Number.isNaN(Date.parse(entry.time)));
    } catch { toast('本機紀錄無法讀取，請重新開啟履歷。'); }
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify({ tags: state.tags, log: state.log,
        theme: state.theme, motion: state.motion }));
      return true;
    } catch { toast('瀏覽器無法保存，目前變更只保留到頁面關閉。'); return false; }
  }
  function loadWork() {
    try {
      const recent = JSON.parse(localStorage.getItem(workKey) || 'null');
      if (recent && R.some(r => r.id === recent.candidate) && typeof recent.time === 'string' && !Number.isNaN(Date.parse(recent.time))) state.lastWork = { ...recent, tool: ['interview', 'qualification', 'after'].includes(recent.tool) ? recent.tool : 'resume' };
    } catch { toast('上次閱讀紀錄無法讀取，請從履歷預覽重新開啟。'); }
  }
  function rememberWork(resume) {
    state.lastWork = { candidate: resume.id, tool: document.body.dataset.workspaceTool || 'resume', time: new Date().toISOString() };
    try { localStorage.setItem(workKey, JSON.stringify(state.lastWork)); }
    catch { toast('瀏覽器無法保存這次的閱讀位置。'); }
  }
  function loadReading() {
    try { reading = window.CardifReading.restore(JSON.parse(localStorage.getItem(readingKey)), R.map(r => r.id)); }
    catch { toast('閱讀紀錄無法載入，履歷仍可正常開啟。'); }
  }
  function saveReading() {
    try { localStorage.setItem(readingKey, JSON.stringify(reading)); }
    catch { toast('閱讀紀錄目前無法保存，這次變更會保留到關閉頁面。'); }
  }
  function loadNotes() {
    try { reviewNotes = window.CardifReview.restoreNotes(JSON.parse(localStorage.getItem(noteKey)), R.map(r => r.id)); }
    catch { toast('筆記無法讀取，請檢查瀏覽器是否允許儲存資料。'); }
  }
  function saveNotes() {
    clearTimeout(noteTimer);
    noteTimer = null;
    const status = activePanel()?.querySelector('#noteSaveStatus');
    try {
      localStorage.setItem(noteKey, JSON.stringify(reviewNotes));
      notesSaved = true;
      if (status) status.textContent = '已儲存';
    } catch { notesSaved = false; if (status) status.textContent = '儲存失敗，請保留筆記並重試'; }
  }
  function savePosition() {
    const canvas = activePanel()?.querySelector('.resume-canvas');
    if (document.body.dataset.view === 'workspace' && canvas?.dataset.candidate && canvas.getClientRects().length) {
      reading.positions[canvas.dataset.candidate] = Math.max(0, -canvas.getBoundingClientRect().top);
    }
  }
  function enterPage(page) {
    const targetHash = location.hash;
    pageMotion.enter(() => {
      if (location.hash !== targetHash) return;
      toolSwitching = true;
      route(true);
      requestAnimationFrame(() => { toolSwitching = false; });
    }, () => [$('.page-heading'), $(`[data-page="${page}"]`)]);
  }
  function preferences() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.motion = state.motion && !reduced.matches ? 'on' : 'off';
    $('#themeText').textContent = state.theme === 'dark' ? '淺色' : '深色';
    $('#themeToggle').setAttribute('aria-label', `切換至${state.theme === 'dark' ? '淺色' : '深色'}模式`);
    $('#themeToggle img').src = `assets/icons/${state.theme === 'dark' ? 'sun' : 'moon'}.svg`;
    $('#motionToggle').checked = state.motion && !reduced.matches;
    $('#motionToggle').disabled = reduced.matches;
    if (!state.motion || reduced.matches) { pageMotion.cancel(); homeTimeline?.revert(); homeTimeline = null; document.getAnimations().forEach(a => a.cancel()); }
  }
  function renderNotifications() {
    const notifications = [];
    $('#notificationList').replaceChildren(...(notifications.length ? notifications.map(notification => {
      const item = row('notificationItemTemplate');
      item.href = notification.href;
      item.querySelector('strong').textContent = notification.title;
      item.querySelector('p').textContent = notification.text;
      if (notification.time) {
        const time = item.querySelector('time');
        time.hidden = false;
        time.dateTime = notification.time;
        time.textContent = new Date(notification.time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return item;
    }) : [row('notificationEmptyTemplate')]));
    $('#notificationBadge').textContent = notifications.length;
    $('#notificationBadge').hidden = !notifications.length;
    $('#notificationButton').setAttribute('aria-label', `通知，${notifications.length} 則`);
  }
  function positionNotifications() {
    const button = $('#notificationButton').getBoundingClientRect(), width = document.documentElement.clientWidth;
    $('#notificationPanel').style.setProperty('--notification-top', `${$('.site-header').getBoundingClientRect().bottom + 10}px`);
    $('#notificationPanel').style.setProperty('--notification-right', `${Math.min(Math.max(16, width - button.right), Math.max(16, width - 380 - 16))}px`);
  }
  function closeNotifications() {
    if ($('#notificationPanel').matches(':popover-open')) $('#notificationPanel').hidePopover();
  }
  let homeTimeline;
  function animateHome() {
    if (!window.gsap || !state.motion || reduced.matches) return;
    homeTimeline?.revert();
    homeTimeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
    homeTimeline.from('#pageTitle', { yPercent: 105, opacity: 0, duration: .55 })
      .from('.module-card', { y: 20, opacity: 0, duration: .48, stagger: .07 }, .18)
      .from('.paper', { y: 22, opacity: 0, duration: .65, stagger: .025 }, .3);
  }

  function tagContent(resume) {
    const tags = tagsOf(resume), content = template('tagPanelTemplate');
    const list = field(content, 'tagsAnchor'), detail = field(content, 'detail');
    const detailId = `talent-tag-detail-${resume.id}`;
    detail.id = detailId;
    list.replaceChildren(...(tags.length ? tags.map(tag => {
      const button = row('tagTemplate');
      button.textContent = tag.name;
      button.dataset.tag = tag.id;
      button.setAttribute('aria-expanded', String(state.source === tag.id));
      button.setAttribute('aria-controls', detailId);
      return button;
    }) : [row('tagEmptyTemplate')]));
    const active = tags.find(tag => tag.id === state.source);
    detail.hidden = !active;
    if (active) {
      field(content, 'tagName').textContent = active.name;
      field(content, 'description').textContent = active.description;
      const passage = C.sentences(resume).find(line => active.sources.includes(line.id));
      field(content, 'quote').textContent = passage ? `「${passage.text}」` : '';
    }
    return content;
  }
  function renderRecruit() {
    const search = state.jobSearch.trim().toLocaleLowerCase();
    const found = !search || `${J.title} ${J.location}`.toLocaleLowerCase().includes(search);
    $('#jobOpening').hidden = !found;
    $('#jobEmpty').hidden = found;
    $('#jobCount').textContent = found ? '1 個職缺' : '0 個職缺';
    $('#jobSearch').value = state.jobSearch;
    $('#openingResumeCount').textContent = R.length;
    const recent = state.lastWork;
    $('#resumeWork').hidden = !recent;
    if (recent) {
      const resume = R.find(r => r.id === recent.candidate);
      $('#resumeWork').href = `#${recent.tool}/${resume.id}`;
      $('#resumeWorkTitle').textContent = `${J.title}・${names(resume)}・${({ interview: '面試準備', qualification: '職缺與資格', resume: '履歷整理', after: '面試評估' })[recent.tool]}`;
      $('#resumeWorkTime').dateTime = recent.time;
      $('#resumeWorkTime').textContent = new Date(recent.time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }
  const displayText = C.displayText;
  function sourceLine(line) {
    const item = row('sourceLineTemplate');
    item.dataset.source = line.id;
    item.textContent = displayText(line.text);
    return item;
  }
  const paperTemplates = ['resumeClassicTemplate', 'resumeWarmTemplate', 'resumeBlueTemplate', 'resumeSimpleTemplate', 'resumeSlateTemplate'];
  function paperContent(resume) {
    const paper = row(paperTemplates[R.indexOf(resume)] || 'resumeClassicTemplate'), lines = C.sentences(resume);
    field(paper, 'name').textContent = names(resume);
    field(paper, 'contacts').replaceWith(template('resumeContactTemplate'));
    for (const key of ['location', 'phone', 'email', 'availability', 'contactTime']) {
      field(paper, key).textContent = resume.contact[key];
      if (resume.origin === 'online' && !resume.contact[key]) field(paper, key).parentElement.hidden = true;
    }
    field(paper, 'education').replaceChildren(...resume.education.map(education => {
      const item = row('paperEducationTemplate');
      field(item, 'school').textContent = masked(education.school);
      field(item, 'major').textContent = [education.major, education.degree].filter(Boolean).join('・');
      field(item, 'period').textContent = education.period;
      return item;
    }));
    field(paper, 'skills').replaceChildren(...resume.skills.map((skill, index) => {
      const item = row('paperListTemplate');
      item.append(sourceLine({ id: `k${index}`, text: skill }));
      return item;
    }));
    field(paper, 'certs').replaceChildren(...resume.certs.map(cert => {
      const item = row('paperListTemplate'); item.textContent = cert; return item;
    }));
    field(paper, 'experience').replaceChildren(...resume.experience.map((experience, index) => {
      const item = row('paperExperienceTemplate');
      item.dataset.source = `job${index}`; item.classList.add('source-line'); item.tabIndex = -1;
      field(item, 'role').textContent = experience.title;
      field(item, 'company').textContent = masked(experience.company);
      field(item, 'period').textContent = experience.period;
      field(item, 'description').replaceChildren(...lines.filter(line => line.id.startsWith(`e${index}-`)).map(line => {
        const point = row('paperListTemplate'); point.append(sourceLine(line)); return point;
      }));
      return item;
    }));
    field(paper, 'summary').replaceChildren(...lines.filter(line => line.section === '自傳').map(line => {
      const paragraph = row('paperParagraphTemplate'); paragraph.append(sourceLine(line)); return paragraph;
    }));
    for (const [name, value] of Object.entries({ summary: resume.summary, experience: resume.experience.length, skills: resume.skills.length, certs: resume.certs.length })) {
      if (!value) field(paper, name).closest('section').hidden = true;
    }
    return paper;
  }
  const activePanel = () => state.openId ? $('#readerContent') : null;
  let shownResumes = [];
  function refreshTagFilter() {
    const allTags = [...new Set(R.flatMap(resume => tagsOf(resume).map(tag => tag.name)))];
    if (state.filter && !allTags.includes(state.filter)) state.filter = '';
    $('#tagFilter').replaceChildren(new Option('全部', ''), ...allTags.map(name => new Option(name, name)));
    $('#tagFilter').value = state.filter;
  }
  function refreshTags() {
    const panel = activePanel();
    if (!panel) return;
    const resume = selected();
    panel.querySelector('.resume-tags').replaceChildren(tagContent(resume));
  }
  function setSidebarPanel() {
    const panel = activePanel();
    if (!panel) return;
    const notes = panel.querySelector('.reading-notes'), wasHidden = notes.hidden;
    const showHighlights = sidebarPanel === 'highlights' && !detailMode();
    const showTags = sidebarPanel === 'tags' && !detailMode();
    panel.querySelector('.resume-tags').hidden = !showTags;
    panel.querySelector('#resumeHighlights').hidden = !showHighlights;
    notes.hidden = !showHighlights && !showTags;
    panel.querySelector('.reader-body').classList.toggle('with-tags', showHighlights || showTags);
    panel.querySelector('.reader-body').classList.toggle('interview-body', detailMode());
    panel.querySelector('#qualificationPanel').hidden = document.body.dataset.workspaceTool !== 'qualification';
    panel.querySelector('#interviewPanel').hidden = !interviewMode();
    panel.querySelector('#postInterviewPanel').hidden = !afterMode();
    panel.querySelector('[data-action="toggle-highlights"]').setAttribute('aria-expanded', String(showHighlights));
    panel.querySelector('[data-action="toggle-tags"]').setAttribute('aria-expanded', String(showTags));
    if (wasHidden && !notes.hidden && state.motion && !reduced.matches) {
      notes.animate([{ opacity: .65, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
    }
  }
  function mountResume(resume) {
    if (noteTimer) saveNotes();
    const panel = $('#readerContent');
    panel.replaceChildren(template('resumeDetailTemplate'));
    panel.hidden = false;
    $('#readerEmpty').hidden = true;
    field(panel, 'title').textContent = `${names(resume)}的履歷`;
    panel.querySelector('.resume-document').append(paperContent(resume));
    const review = window.CardifReview.forResume(resume);
    panel.querySelector('.review-title').textContent = resume.origin === 'online' ? '履歷摘錄' : '履歷整理';
    field(panel, 'reviewSummary').textContent = review.summary;
    field(panel, 'reviewSummary').hidden = !review.summary;
    field(panel, 'highlights').replaceChildren(...review.points.map(point => {
      const item = row('resumeHighlightTemplate');
      const link = item.querySelector('[data-action="highlight-source"]');
      link.dataset.sourceId = point.source;
      link.setAttribute('aria-label', `定位提及處：${point.quote}`);
      const question = item.querySelector('[data-action=question-from-review]');
      question.dataset.sourceId = point.source;
      question.setAttribute('aria-label', `依照${point.quote}加入面試問題`);
      field(item, 'text').textContent = point.text;
      return item;
    }));
    panel.querySelector('#resumeNote').value = reviewNotes[resume.id]?.text || '';
    panel.querySelector('#noteSaveStatus').textContent = reviewNotes[resume.id] ? (notesSaved ? '已儲存' : '尚未儲存，請重試') : '';
    state.selected = resume.id;
    panel.querySelector('[data-action="previous-resume"]').disabled = shownResumes.indexOf(resume) <= 0;
    panel.querySelector('[data-action="next-resume"]').disabled = shownResumes.indexOf(resume) >= shownResumes.length - 1;
    setSidebarPanel();
    refreshTags();
    if (interviewMode()) renderInterview();
    if (afterMode()) postUI.render(panel.querySelector('#postInterviewPanel'));
    if (document.body.dataset.workspaceTool === 'qualification') renderQualification();
    renderCaseToolbar();
    const compact = $('.compact-reading-switch');
    compact.setAttribute('aria-label', '閱讀切換');
    compact.querySelector('[data-action=mobile-questions]').textContent = document.body.dataset.workspaceTool === 'qualification' ? '職缺與資格' : '面試問題';
    const bookmark = panel.querySelector('[data-action="bookmark-resume"]');
    bookmark.setAttribute('aria-pressed', String(reading.bookmarks.includes(resume.id)));
    bookmark.setAttribute('aria-label', reading.bookmarks.includes(resume.id) ? '移除書籤' : '加入書籤');
    const canvas = panel.querySelector('.resume-canvas');
    canvas.dataset.candidate = resume.id;
    requestAnimationFrame(() => {
      if (toolSwitching || afterMode() || state.openId !== resume.id || document.body.dataset.view !== 'workspace') return;
      const position = reading.positions[resume.id] || 0;
      const readerTop = $('#resumeReader').getBoundingClientRect().top;
      if (position > 0) window.scrollTo({ top: canvas.getBoundingClientRect().top + window.scrollY + position, behavior: 'instant' });
      else if (readerTop < 0) window.scrollTo({ top: readerTop + window.scrollY, behavior: 'instant' });
    });
  }
  function renderRail() {
    $('#candidatePicker').replaceChildren(...shownResumes.map(resume => new Option(resume.name, resume.id)));
    $('#candidatePicker').disabled = !shownResumes.length;
    $('#candidatePicker').value = state.openId || '';
    $('#candidateTrayToggle').textContent = `${$('#candidateTray').hidden ? '搜尋與排序' : '收合搜尋'}（${shownResumes.length} 人）`;
    const railLeft = $('#resumeRail').scrollLeft;
    $('#resumeRail').replaceChildren(...shownResumes.map(resume => {
      const slip = row('resumeSlipTemplate'), opener = slip.querySelector('.slip-open');
      slip.dataset.candidate = resume.id;
      slip.dataset.design = R.indexOf(resume);
      slip.dataset.read = String(reading.viewed.includes(resume.id));
      slip.dataset.active = String(resume.id === state.openId);
      opener.id = `resume-open-${resume.id}`;
      opener.dataset.candidate = resume.id;
      opener.setAttribute('aria-label', `閱讀${names(resume)}的履歷，${reading.viewed.includes(resume.id) ? '已開啟' : '未讀'}`);
      opener.setAttribute('aria-pressed', String(resume.id === state.openId));
      slip.querySelector('.slip-grip').setAttribute('aria-label', `排序${names(resume)}，使用左右方向鍵移動`);
      slip.querySelector('.slip-grip').draggable = false;
      slip.querySelector('.slip-bookmark').hidden = !reading.bookmarks.includes(resume.id);
      field(slip, 'name').textContent = names(resume);
      return slip;
    }));
    $('#resumeRail').scrollLeft = railLeft;
    $('#allCount').textContent = R.length;
    $('#unreadCount').textContent = R.length - reading.viewed.length;
    $('#bookmarkCount').textContent = reading.bookmarks.length;
    document.querySelectorAll('[data-reading-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readingFilter === readingFilter)));
  }
  function revealActiveSlip(id) {
    const rail = $('#resumeRail'), slip = $(`#resume-open-${id}`);
    if (!slip) return;
    const railRect = rail.getBoundingClientRect(), slipRect = slip.getBoundingClientRect();
    rail.scrollBy({ left: Math.min(0, slipRect.left - railRect.left) + Math.max(0, slipRect.right - railRect.right), behavior: 'instant' });
  }
  function renderWorkspace() {
    savePosition();
    refreshTagFilter();
    $('#candidateSearch').value = state.search;
    const search = state.search.trim().toLocaleLowerCase();
    shownResumes = reading.order.map(id => R.find(r => r.id === id)).filter(resume => (!search || `${resume.name} ${resume.education.map(e => e.school + e.major).join(' ')} ${resume.experience.map(e => e.company + e.title + e.description).join(' ')}`.toLocaleLowerCase().includes(search))
      && (!state.filter || tagsOf(resume).some(tag => tag.name === state.filter))
      && (readingFilter !== 'unread' || !reading.viewed.includes(resume.id))
      && (readingFilter !== 'bookmarked' || reading.bookmarks.includes(resume.id))
      && M.matchesWork(resume, workFilter, caseRecords, reading.viewed));
    $('#clearSearch').hidden = !state.search && !state.filter && readingFilter === 'all' && workFilter === 'all';
    $('#candidateEmpty').hidden = shownResumes.length > 0;
    $('.reading-desk').hidden = shownResumes.length === 0;
    $('.case-toolbar').hidden = shownResumes.length === 0;
    if (!shownResumes.some(resume => resume.id === state.openId)) {
      state.openId = shownResumes[0]?.id || null; state.selected = state.openId; state.source = null;
    }
    renderRail();
    revealActiveSlip(state.openId);
    $('#readerContent').hidden = !state.openId;
    $('#readerEmpty').hidden = Boolean(state.openId);
    if (state.openId) mountResume(selected());
    else { $('#readerContent').replaceChildren(); $('#readerStatus').textContent = ''; }
  }
  function openResume(id) {
    const resume = shownResumes.find(item => item.id === id);
    if (!resume) return;
    savePosition();
    if (!reading.viewed.includes(id)) reading.viewed.push(id);
    saveReading();
    if (state.openId === id) { renderRail(); rememberWork(resume); return; }
    state.openId = id; state.selected = id; state.source = null;
    mountResume(resume);
    renderRail();
    revealActiveSlip(id);
    $('#readerStatus').textContent = `已開啟${names(resume)}的完整履歷`;
    const paper = $('.resume-document');
    if (state.motion && !reduced.matches) paper.animate([{ opacity: .6, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)' });
    rememberWork(resume);
    if (location.hash.startsWith('#resume/')) history.replaceState(null, '', '#workspace/resume');
  }
  function stepResume(direction) {
    const index = shownResumes.findIndex(resume => resume.id === state.openId);
    const next = shownResumes[index + direction];
    if (!next) return;
    openResume(next.id);
    const control = activePanel().querySelector(`[data-action="${direction < 0 ? 'previous' : 'next'}-resume"]`);
    (control.disabled ? activePanel().querySelector('.resume-canvas') : control).focus({ preventScroll: true });
  }
  function route(skipTransition = false) {
    if (!skipTransition) pageMotion.cancel();
    if (!window.CardifAuthUI.allowRoute()) return;
    const [part, id] = location.hash.slice(1).split('/');
    try { applicant?.sync(); } catch { toast('應徵資料無法讀取，請保留目前頁面。'); }
    if (['interview', 'qualification', 'after'].includes(part)) {
      if (R.some(resume => resume.id === id)) { state.openId = id; state.selected = id; state.search = ''; state.filter = ''; readingFilter = 'all'; }
      location.replace(`#workspace/${part}`); return;
    }
    if (['compliance', 'proscons', 'match'].includes(part)) { location.replace('#workspace/resume'); return; }
    const page = part === 'apply' ? 'apply' : part === 'workspace' || part === 'resume' ? 'workspace' : part === 'recruit' ? 'recruit' : 'home';
    if (!skipTransition && document.body.dataset.view && document.body.dataset.view !== page && ['recruit', 'workspace', 'apply'].includes(page) && state.motion && !reduced.matches) { enterPage(page); return; }
    const nextTool = page === 'workspace' && ['interview', 'qualification', 'after'].includes(id) ? id : 'resume';
    const toolChanged = document.body.dataset.view === 'workspace' && page === 'workspace' && document.body.dataset.workspaceTool !== nextTool;
    if (toolChanged && !skipTransition && state.motion && !reduced.matches) {
      workbenchTransition?.skipTransition();
      toolSwitching = true;
      document.documentElement.dataset.workbenchDirection = ['resume', 'qualification', 'interview', 'after'].indexOf(nextTool) > ['resume', 'qualification', 'interview', 'after'].indexOf(document.body.dataset.workspaceTool) ? 'forward' : 'back';
      if (document.startViewTransition) {
        workbenchTransition = document.startViewTransition(() => route(true));
        workbenchTransition.finished.catch(() => {}).finally(() => { toolSwitching = false; });
      } else {
        route(true);
        $('#resumeReader').animate([{ transform: `translateX(${nextTool === 'interview' ? 64 : -64}px)`, opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
        toolSwitching = false;
      }
      return;
    }
    if (part === 'resume') {
      if (R.some(resume => resume.id === id)) {
        state.openId = id; state.selected = id; state.search = ''; state.filter = ''; readingFilter = 'all'; workFilter = 'all'; $('#workFilter').value = 'all';
        if (!reading.viewed.includes(id)) { reading.viewed.push(id); saveReading(); }
      }
      else { state.openId = null; toast('找不到這份履歷，請從預覽重新選取。'); }
    }
    if (page === 'workspace' && !state.openId && state.lastWork) state.openId = state.selected = state.lastWork.candidate;
    const titles = { home: 'Cardif-HR Tech', recruit: '招募與任用', workspace: J.title, apply: id === 'job' ? '加入法國巴黎人壽' : id === 'sent' ? '模擬投遞完成' : '填寫履歷' };
    document.querySelectorAll('[data-page]').forEach(section => { section.hidden = section.dataset.page !== page; });
    document.body.dataset.view = page;
    $('#mainNav').hidden = page === 'apply';
    $('#applicantNav').hidden = page !== 'apply';
    document.querySelectorAll('[data-demo]').forEach(link => {
      if (link.dataset.demo === (page === 'apply' ? 'applicant' : 'hr')) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const receipt = applicant?.receipt;
    $('[data-demo="hr"]').href = page === 'apply' && receipt && R.some(resume => resume.id === receipt) ? `#resume/${receipt}` : '#recruit';
    document.body.dataset.workspaceTool = nextTool;
    if (!document.body.dataset.mobileSurface) document.body.dataset.mobileSurface = 'questions';
    document.querySelectorAll('.workspace-tools a').forEach(link => {
      if (link.dataset.workspaceTool === document.body.dataset.workspaceTool) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $('#pageTitle').textContent = titles[page];
    $('#workspaceOverview').hidden = page !== 'workspace';
    $('.page-heading').classList.toggle('platform-heading', page === 'home');
    document.title = page === 'home' ? 'Cardif-HR Tech｜法國巴黎人壽' : `${titles[page]}｜Cardif-HR Tech`;
    document.querySelectorAll('[data-nav]').forEach(link => {
      if (link.dataset.nav === (page === 'home' ? 'home' : 'recruit')) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    if (page === 'recruit') renderRecruit();
    if (page === 'apply') applicant.render(id || 'job');
    if (page === 'workspace') { renderWorkspace(); if (state.openId) rememberWork(selected()); }
    comparison.show(page === 'workspace' && nextTool === 'qualification');
    preferences(); updateHomeTime(); renderNotifications();
    if (location.hash !== currentRoute) {
      if (page === 'home') animateHome(); else homeTimeline?.revert();
      if (currentRoute && !toolChanged) { $('#pageTitle').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
    }
    currentRoute = location.hash;
  }
  function persistCase() {
    caseRecord().updatedAt = new Date().toISOString();
    try { localStorage.setItem(caseKey, JSON.stringify(caseRecords)); $('#caseSaveStatus').dataset.error = 'false'; $('#caseSaveStatus').textContent = '已儲存'; return true; }
    catch { $('#caseSaveStatus').dataset.error = 'true'; $('#caseSaveStatus').textContent = '儲存失敗，請保留頁面並重試'; return false; }
  }
  function renderCaseToolbar() {
    $('#candidateStage').replaceChildren(...Object.entries(M.stages).map(([value, label]) => new Option(label, value)));
    $('#candidateStage').value = caseRecord().stage;
    $('#candidateStageLabel').textContent = selected().name;
    $('#caseSaveStatus').textContent = $('#caseSaveStatus').dataset.error === 'true' ? '儲存失敗，請保留頁面並重試' : caseRecord().updatedAt ? '已儲存' : '';
  }
  function qualificationRow(id, title, evidence, source) {
    const item = row('qualificationRowTemplate'), record = caseRecord().checks[id] || { status: 'open', note: '' };
    item.dataset.check = id;
    field(item, 'title').textContent = title;
    field(item, 'evidence').textContent = evidence;
    field(item, 'statusLabel').textContent = `${title}核對結果`;
    field(item, 'noteLabel').textContent = `${title}補充事項`;
    const select = item.querySelector('[data-check-status]');
    select.replaceChildren(...Object.entries(M.statusLabels).map(([value, label]) => new Option(label, value)));
    select.value = record.status;
    item.querySelector('[data-check-note]').value = record.note;
    item.querySelector('.check-note-label').hidden = record.status === 'open' && !record.note;
    const link = item.querySelector('[data-action=highlight-source]'), question = item.querySelector('[data-action=question-from-review]');
    link.hidden = !source;
    const prepared = M.questionFor(selected(), id);
    question.hidden = !prepared;
    if (prepared) {
      question.dataset.requirement = id;
      question.disabled = Boolean(M.existingQuestion(selected(), id, interviewDraft().questions));
      question.textContent = question.disabled ? '已加入問題' : '加入面試問題';
    }
    if (source) {
      link.dataset.sourceId = question.dataset.sourceId = source;
      link.setAttribute('aria-label', `定位提及處：${title}`);
      question.setAttribute('aria-label', `依照${title}加入面試問題`);
    }
    return item;
  }
  function renderQualification() {
    const panel = $('#qualificationPanel');
    panel.replaceChildren(template('qualificationTemplate'));
    const compareLink = document.createElement('button');
    compareLink.type = 'button'; compareLink.className = 'button secondary qualification-comparison-link'; compareLink.textContent = '查看職缺權重與全體比較';
    compareLink.addEventListener('click', () => $('#jobComparison').scrollIntoView({ block: 'start', behavior: state.motion && !reduced.matches ? 'smooth' : 'instant' }));
    panel.querySelector('h2').after(compareLink);
    panel.querySelectorAll('[data-qualification-section]').forEach(section => { section.hidden = section.dataset.qualificationSection !== qualificationView; });
    panel.querySelectorAll('[data-qualification-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.qualificationView === qualificationView)));
    field(panel, 'requirements').replaceChildren(...M.assessment(selected()).map(item => qualificationRow(item.id, item.title, item.text, item.source)));
    field(panel, 'certificates').replaceChildren(...J.certs.map((name, index) => qualificationRow(`cert${index}`, name, selected().certs.includes(name) ? '履歷列有此證照，核對證明文件後記錄結果。' : '履歷未列出此證照。')));
    $('#jobRecruitmentScope').value = jobScope;
    $('#scopeOverride').checked = caseRecord().scopeOverride;
    $('#personScope').hidden = !caseRecord().scopeOverride;
    $('#recruitmentScope').value = caseRecord().applicability;
    const legal = field(panel, 'legalChecks');
    legal.hidden = M.applicability(caseRecord(), jobScope) !== 'yes';
    legal.replaceChildren(...M.legalChecks.map(([id, title, text, article]) => qualificationRow(id, title, `${text}（保險業務員管理規則${article}）`)));
  }
  function questionSource(question) {
    return Object.hasOwn(question, 'resumeSource') ? I.passages(selected()).find(line => line.id === question.resumeSource) : I.suggestions[state.openId]?.find(item => item.id === question.sourceId);
  }
  function downloadFile(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  document.addEventListener('input', event => {
    if (!state.openId) return;
    if (event.target.matches('[data-check-note]')) {
      const id = event.target.closest('[data-check]').dataset.check;
      caseRecord().checks[id] ??= { status: 'open', note: '' };
      caseRecord().checks[id].note = event.target.value; persistCase();
    }
  });
  document.addEventListener('change', event => {
    if (!state.openId) return;
    if (event.target.id === 'candidateStage') { caseRecord().stage = event.target.value; persistCase(); if (workFilter !== 'all') renderWorkspace(); }
    if (event.target.id === 'jobRecruitmentScope') {
      try {
        const next = M.restoreScope(event.target.value);
        localStorage.setItem(jobScopeKey, JSON.stringify({ job: J.url, applicability: next }));
        jobScope = next; toast('已更新此職缺的共同工作範圍');
      } catch { toast('共同工作範圍儲存失敗，已保留原設定。'); }
      renderQualification();
    }
    if (event.target.id === 'scopeOverride') { caseRecord().scopeOverride = event.target.checked; persistCase(); renderQualification(); }
    if (event.target.id === 'recruitmentScope') { caseRecord().applicability = event.target.value; persistCase(); renderQualification(); }
    if (event.target.matches('[data-check-status]')) {
      const id = event.target.closest('[data-check]').dataset.check;
      caseRecord().checks[id] ??= { status: 'open', note: '' };
      caseRecord().checks[id].status = event.target.value;
      event.target.closest('[data-check]').querySelector('.check-note-label').hidden = event.target.value === 'open' && !caseRecord().checks[id].note;
      persistCase();
    }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-qualification-view]');
    if (!button) return;
    qualificationView = button.dataset.qualificationView; renderQualification();
    $('#qualificationPanel [aria-pressed=true]').focus({ preventScroll: true });
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-case-action]');
    if (!button || !state.openId) return;
    const action = button.dataset.caseAction;
    if (noteTimer) saveNotes();
    if (action === 'print') {
      const html = M.report({ resume: selected(), job: J, record: exportRecord(), draft: interviewDraft(), review: window.CardifReview.forResume(selected()), note: reviewNotes[state.openId]?.text || '', includePrivate: $('#caseIncludePrivate').checked, tags: tagsOf(selected()) });
      downloadFile(html, `${selected().name}-招募整理.html`, 'text/html;charset=utf-8');
      toast('已匯出整理文件，開啟後可列印或另存 PDF');
    }
    $('#caseIncludePrivate').checked = false;
    button.closest('details')?.removeAttribute('open');
  });
  function interviewDraft() {
    const id = state.openId;
    if (!interviewDrafts[id]?.singleList || interviewDrafts[id].revision !== 2) interviewDrafts[id] = I.prepare(id, interviewDrafts[id]);
    return interviewDrafts[id];
  }
  function persistInterview() {
    const draft = interviewDraft(), status = $('#interviewSaveStatus');
    draft.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(interviewKey, JSON.stringify(interviewDrafts));
      if (status) status.textContent = draft.editor ? '編輯內容已暫存' : '已儲存';
      return true;
    } catch {
      if (status) status.textContent = '儲存失敗，請保留頁面並重試';
      toast('面試問題無法保存，請保留目前頁面並重試。'); return false;
    }
  }
  function renderInterview() {
    const panel = $('#interviewPanel'), draft = interviewDraft();
    panel.hidden = false;
    panel.replaceChildren(template('interviewPanelTemplate'));
    field(panel, 'questionCount').textContent = `${draft.questions.length} 題`;
    const suggestions = I.suggestions[state.openId] || [], picker = field(panel, 'suggestionPicker');
    picker.hidden = !suggestions.length;
    picker.open = !draft.questions.length && !draft.editor;
    field(panel, 'suggestions').replaceChildren(...suggestions.map((suggestion, index) => {
      const item = row('interviewSuggestionTemplate');
      field(item, 'text').textContent = suggestion.text;
      const source = item.querySelector('[data-action=highlight-source]');
      source.dataset.sourceId = suggestion.source;
      source.setAttribute('aria-label', `建議第 ${index + 1} 題提及處`);
      const add = item.querySelector('[data-choose-question]');
      add.dataset.chooseQuestion = suggestion.id;
      const chosen = draft.questions.some(q => q.text === suggestion.text);
      add.textContent = chosen ? '已加入' : '加入面試'; add.disabled = chosen || Boolean(draft.editor) || draft.questions.length >= 50;
      return item;
    }));
    const newButton = panel.querySelector('[data-interview-action=new]');
    newButton.textContent = draft.editor ? '繼續編輯' : '新增問題';
    newButton.disabled = !draft.editor && draft.questions.length >= 50;
    const undo = panel.querySelector('[data-interview-action=undo]');
    undo.hidden = removedQuestion?.candidate !== state.openId;
    undo.disabled = draft.questions.length >= 50;
    field(panel, 'empty').hidden = Boolean(draft.questions.length || draft.editor);
    field(panel, 'questions').replaceChildren(...draft.questions.map((q, index) => {
      const item = row('interviewQuestionTemplate');
      item.dataset.question = q.id;
      field(item, 'question').textContent = q.text;
      if (draft.editor?.id === q.id) {
        item.replaceChildren(template('interviewEditorTemplate'));
        return item;
      }
      const source = questionSource(q), sourceButton = item.querySelector('[data-action=highlight-source]');
      sourceButton.hidden = !source;
      if (source) {
        sourceButton.dataset.sourceId = source.source || source.id;
        sourceButton.setAttribute('aria-label', `第 ${index + 1} 題提及處`);
        sourceButton.textContent = `（${source.label || source.quote || '履歷提及處'}）`;
      }
      item.querySelector('[data-interview-action=up]').disabled = index === 0;
      item.querySelector('[data-interview-action=down]').disabled = index === draft.questions.length - 1;
      item.querySelector('[data-interview-action=edit]').disabled = Boolean(draft.editor);
      item.querySelectorAll('[data-interview-action]').forEach(button => button.setAttribute('aria-label', `第 ${index + 1} 題${button.textContent}`));
      return item;
    }));
    if (draft.editor) {
      if (!draft.questions.some(q => q.id === draft.editor.id)) field(panel, 'editor').append(template('interviewEditorTemplate'));
      $('#questionText').value = draft.editor.text;
      $('#sourceSearch').value = draft.editor.text;
      renderSourceResults(draft.editor.text);
      renderEditorSource();
    }
    persistInterview();
  }
  function renderSourceResults(query) {
    const results = $('#sourceResults');
    const matches = query.trim() ? I.findPassages(selected(), query) : I.passages(selected()).filter(line => line.id.startsWith('job'));
    results.replaceChildren(...matches.map(line => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.linkSource = line.id;
      const title = document.createElement('strong'), text = document.createElement('span');
      title.textContent = line.id.startsWith('job') ? line.label : line.section;
      text.textContent = displayText(line.text); button.append(title, text); return button;
    }));
    if (!matches.length) { const message = document.createElement('p'); message.textContent = '沒有符合的段落，請換個關鍵字，或將這題保留為一般面試問題。'; results.append(message); }
  }
  function renderEditorSource() {
    const area = field($('#interviewPanel'), 'sourceQuote'), source = questionSource(interviewDraft().editor);
    area.replaceChildren(); area.hidden = !source;
    if (!source) return;
    const link = document.createElement('button'); link.type = 'button'; link.className = 'source-link'; link.dataset.action = 'highlight-source'; link.dataset.sourceId = source.source || source.id;
    link.textContent = `（${source.label || source.quote || '履歷提及處'}）`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button'; remove.dataset.unlinkSource = ''; remove.textContent = '移除連結'; area.append(link, remove);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-link-source]'), unlink = event.target.closest('[data-unlink-source]');
    if ((!link && !unlink) || !interviewMode() || !interviewDraft().editor) return;
    const source = link && I.passages(selected()).find(line => line.id === link.dataset.linkSource);
    if (link && !source) return;
    interviewDraft().editor.resumeSource = source ? source.id : null;
    persistInterview(); renderEditorSource();
    $('#interviewPanel .source-picker').open = false;
    $('#questionText').focus({ preventScroll: true });
  });
  $('#main').addEventListener('input', event => { if (event.target.id === 'sourceSearch') renderSourceResults(event.target.value); });
  document.addEventListener('click', event => {
    const menu = $('.candidate-options');
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelectorAll('.candidate-options[open],.source-picker[open]').forEach(menu => { menu.open = false; });
  });
  document.addEventListener('toggle', event => {
    if (!event.target.matches('.source-picker') || !event.target.open) return;
    $('#sourceSearch').value = $('#questionText').value;
    renderSourceResults($('#sourceSearch').value);
  }, true);
  function mobileSurface(surface) {
    document.body.dataset.mobileSurface = surface;
    document.querySelectorAll('.compact-reading-switch button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.action === `mobile-${surface === 'resume' ? 'resume' : 'questions'}`)));
  }
  function interviewFeedback(id) {
    const target = [...$('#interviewPanel').querySelectorAll('.interview-questions>li')].find(item => item.dataset.question === id);
    if (target && state.motion && !reduced.matches) target.animate([{ backgroundColor: '#d5e8d5', transform: 'translateY(5px)' }, { backgroundColor: 'transparent', transform: 'none' }], { duration: 240, easing: 'ease-out' });
    $('#readerStatus').textContent = `${selected().name}的面試問題，共 ${interviewDraft().questions.length} 題`;
  }
  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-choose-question]');
    if (choice && interviewMode() && state.openId) {
      if (interviewDraft().editor) { toast('請先儲存或取消正在編輯的問題。'); return; }
      try { interviewDrafts[state.openId] = I.choose(state.openId, interviewDraft(), choice.dataset.chooseQuestion); }
      catch (error) { toast(error.message); return; }
      persistInterview(); renderInterview(); toast('已加入本次面試題目'); return;
    }
    const button = event.target.closest('[data-interview-action]');
    if (!button || !interviewMode() || !state.openId) return;
    const draft = interviewDraft(), id = button.closest('[data-question]')?.dataset.question;
    const question = draft.questions.find(q => q.id === id);
    switch (button.dataset.interviewAction) {
      case 'new':
        if (draft.editor) { $('#questionText').focus(); return; }
        if (draft.questions.length >= 50) return;
        draft.editor = { id: crypto.randomUUID(), text: '', followUp: '' }; break;
      case 'edit': if (!question || draft.editor) return; draft.editor = { ...question }; break;
      case 'cancel': draft.editor = null; break;
      case 'up': case 'down': draft.questions = I.move(draft.questions, id, button.dataset.interviewAction === 'up' ? -1 : 1); break;
      case 'remove':
        if (!question) return;
        removedQuestion = { candidate: state.openId, question, index: draft.questions.indexOf(question) };
        draft.questions = draft.questions.filter(q => q.id !== id); break;
      case 'undo':
        if (removedQuestion?.candidate !== state.openId || draft.questions.length >= 50) return;
        draft.questions.splice(Math.min(removedQuestion.index, draft.questions.length), 0, removedQuestion.question);
        removedQuestion = null; break;
      default: return;
    }
    persistInterview(); renderInterview();
    if (['new', 'edit'].includes(button.dataset.interviewAction)) $('#questionText').focus();
    else {
      const focusId = id;
      interviewFeedback(focusId);
      const item = [...$('#interviewPanel').querySelectorAll('.interview-questions>li')].find(el => el.dataset.question === focusId);
      if (button.dataset.interviewAction === 'up' || button.dataset.interviewAction === 'down') {
        const move = item?.querySelector(`[data-interview-action=${button.dataset.interviewAction}]`);
        (move?.disabled ? item?.querySelector('[data-interview-action=edit]') : move)?.focus({ preventScroll: true });
      }
      else $('#interviewPanel [data-interview-action=new]').focus({ preventScroll: true });
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id !== 'questionText' || !state.openId) return;
    const draft = interviewDraft();
    if (!draft.editor) return;
    draft.editor.text = $('#questionText').value;
    persistInterview();
  });
  document.addEventListener('submit', event => {
    if (!event.target.matches('.question-editor')) return;
    event.preventDefault();
    const draft = interviewDraft(), question = draft.editor;
    if (!question) return;
    question.text = $('#questionText').value.trim();
    question.followUp = '';
    if (!question.text) { event.target.querySelector('.question-editor-error').hidden = false; $('#questionText').focus(); return; }
    const index = draft.questions.findIndex(q => q.id === question.id);
    if (index < 0 && draft.questions.length >= 50) {
      const error = event.target.querySelector('.question-editor-error');
      error.textContent = '面試問題最多可保留 50 題，請先移除不需要的問題。'; error.hidden = false;
      return;
    }
    if (index >= 0) draft.questions[index] = question;
    else draft.questions.push(question);
    draft.editor = null;
    persistInterview(); renderInterview(); interviewFeedback(question.id);
    const item = [...$('#interviewPanel').querySelectorAll('.interview-questions>li')].find(el => el.dataset.question === question.id);
    item?.querySelector('[data-interview-action=edit]')?.focus({ preventScroll: true });
  });
  function clearSearch() { state.search = ''; state.filter = ''; readingFilter = 'all'; workFilter = 'all'; $('#workFilter').value = 'all'; renderWorkspace(); $('#candidateSearch').focus(); }
  document.addEventListener('click', event => {
    const filterButton = event.target.closest('[data-reading-filter]');
    if (filterButton) { readingFilter = filterButton.dataset.readingFilter; renderWorkspace(); return; }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    switch (action.dataset.action) {
      case 'mobile-resume': mobileSurface('resume'); return;
      case 'mobile-questions': mobileSurface('questions'); return;
      case 'open-resume': openResume(action.dataset.candidate); return;
      case 'save-note': saveNotes(); return;
      case 'start-post-interview': postUI.start(); location.hash = '#workspace/after'; return;
      case 'toggle-highlights': sidebarPanel = sidebarPanel === 'highlights' ? null : 'highlights'; setSidebarPanel(); return;
      case 'question-from-review': {
        const draft = interviewDraft();
        if (draft.editor) {
          mobileSurface('questions'); location.hash = '#workspace/interview';
          toast('已開啟正在編輯的問題，請先儲存或取消。'); return;
        }
        if (draft.questions.length >= 50) { toast('面試問題最多可保留 50 題'); return; }
        if (action.dataset.requirement) {
          const prepared = M.questionFor(selected(), action.dataset.requirement), id = `requirement-${action.dataset.requirement}`;
          if (!prepared || M.existingQuestion(selected(), action.dataset.requirement, draft.questions)) return;
          draft.questions.unshift({ id, text: prepared.text, followUp: '', resumeSource: prepared.source || null });
          if (removedQuestion?.candidate === state.openId && removedQuestion.question.id === id) removedQuestion = null;
          caseRecord().checks[prepared.requirement] ??= { status: 'open', note: '' };
          if (caseRecord().checks[prepared.requirement].status === 'open') caseRecord().checks[prepared.requirement].status = 'ask';
          persistCase(); persistInterview(); mobileSurface('questions'); location.hash = '#workspace/interview';
          toast('已加入面試問題'); return;
        }
        const source = I.passages(selected()).find(line => line.id === action.dataset.sourceId);
        if (!source) return;
        draft.editor = { id: crypto.randomUUID(), text: '', followUp: '', resumeSource: source.id };
        document.body.dataset.mobileSurface = 'questions';
        persistInterview();
        location.hash = '#workspace/interview';
        return;
      }
      case 'highlight-source': {
        if (detailMode()) mobileSurface('resume');
        const panel = activePanel();
        panel.querySelectorAll('.source-line').forEach(line => line.classList.toggle('highlight', line.dataset.source === action.dataset.sourceId));
        const line = [...panel.querySelectorAll('.source-line')].find(line => line.dataset.source === action.dataset.sourceId);
        line?.scrollIntoView({ block: 'center', behavior: state.motion && !reduced.matches ? 'smooth' : 'instant' });
        line?.focus({ preventScroll: true });
        return;
      }
      case 'bookmark-resume': {
        const id = state.openId;
        reading.bookmarks = reading.bookmarks.includes(id) ? reading.bookmarks.filter(value => value !== id) : [...reading.bookmarks, id];
        savePosition(); saveReading(); renderWorkspace(); return;
      }
      case 'mark-unread':
        reading.viewed = reading.viewed.filter(id => id !== state.openId);
        savePosition(); saveReading(); renderWorkspace(); toast('已標為未讀'); return;
      case 'previous-resume': stepResume(-1); return;
      case 'next-resume': stepResume(1); return;
      case 'toggle-tags': sidebarPanel = sidebarPanel === 'tags' ? null : 'tags'; setSidebarPanel(); return;
      case 'maintenance': closeNotifications(); $('#maintenancePanel').showPopover(); return;
      case 'settings': $('#settingsButton').click(); return;
      case 'close-dialog': action.closest('dialog').close(); return;
      case 'clear-search': clearSearch(); return;
      case 'clear-job-search': state.jobSearch = ''; renderRecruit(); $('#jobSearch').focus(); return;
    }
    if (!state.openId || !action.closest('.resume-tags')) return;
    const tag = tagsOf(selected()).find(item => item.id === action.dataset.tag);
    if (!tag || action.dataset.action !== 'describe-tag') return;
    state.source = state.source === tag.id ? null : tag.id;
    refreshTags();
    activePanel().querySelector(`[data-action="describe-tag"][data-tag="${tag.id}"]`).focus({ preventScroll: true });
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'resumeNote' && state.openId) {
      reviewNotes[state.openId] = { text: event.target.value.slice(0, 2000), updatedAt: new Date().toISOString() };
      notesSaved = false;
      $('#noteSaveStatus').textContent = '儲存中…';
      clearTimeout(noteTimer);
      noteTimer = setTimeout(saveNotes, 400);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.target.closest('.resume-tags') && state.source) {
      const id = state.source; state.source = null; refreshTags();
      activePanel().querySelector(`[data-tag="${id}"]`)?.focus({ preventScroll: true });
    }
  });
  $('#candidateSearch').addEventListener('input', event => { state.search = event.target.value; renderWorkspace(); });
  $('#workFilter').addEventListener('change', event => { workFilter = event.target.value; renderWorkspace(); });
  $('#tagFilter').addEventListener('change', event => { state.filter = event.target.value; renderWorkspace(); });
  $('#clearSearch').addEventListener('click', clearSearch);
  $('#jobSearch').addEventListener('input', event => { state.jobSearch = event.target.value; renderRecruit(); });
  $('#themeToggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; preferences(); save(); });
  $('#settingsButton').addEventListener('click', () => { closeNotifications(); preferences(); $('#settingsDialog').showModal(); });
  $('#notificationPanel').addEventListener('beforetoggle', event => {
    if (event.newState === 'open') { renderNotifications(); positionNotifications(); }
    $('#notificationButton').setAttribute('aria-expanded', String(event.newState === 'open'));
  });
  $('#notificationPanel').addEventListener('click', event => { if (event.target.closest('a')) closeNotifications(); });
  $('#motionToggle').addEventListener('change', event => { state.motion = event.target.checked; preferences(); save(); });
  $('#menuToggle').addEventListener('click', () => {
    closeNotifications();
    const open = $('.site-header').classList.toggle('menu-open');
    $('#menuToggle').setAttribute('aria-expanded', String(open));
    $('#menuToggle').setAttribute('aria-label', open ? '關閉導覽' : '開啟導覽');
  });
  window.addEventListener('resize', () => {
    if ($('#notificationPanel').matches(':popover-open')) positionNotifications();
    if (document.body.dataset.view === 'workspace') revealActiveSlip(state.openId);
  });
  window.addEventListener('scroll', () => { closeNotifications(); savePosition(); }, { passive: true });
  window.addEventListener('hashchange', () => {
    closeNotifications();
    if (location.hash === '#main') { $('#main').focus(); return; }
    state.source = null;
    $('.site-header').classList.remove('menu-open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');
    $('#menuToggle').setAttribute('aria-label', '開啟導覽');
    route();
  });
  function updateHomeTime() {
    const now = new Date();
    $('#platformClock').dateTime = now.toISOString();
    $('#platformClock').textContent = now.toLocaleString('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('-', '/');
  }
  reduced.addEventListener('change', preferences);
  setInterval(updateHomeTime, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateHomeTime(); else if (noteTimer) saveNotes(); });
  window.addEventListener('pagehide', () => { if (noteTimer) saveNotes(); });
  function moveSlip(from, to) {
    const rail = $('#resumeRail');
    const oldPositions = new Map([...rail.children].map(slip => [slip.dataset.candidate, slip.getBoundingClientRect()]));
    const railScroll = { top: rail.scrollTop, left: rail.scrollLeft };
    reading.order = window.CardifReading.reorder(reading.order, shownResumes.map(r => r.id), from, to);
    shownResumes.sort((a, b) => reading.order.indexOf(a.id) - reading.order.indexOf(b.id));
    saveReading(); renderRail();
    rail.scrollTo(railScroll.left, railScroll.top);
    if (state.motion && !reduced.matches) [...rail.children].forEach(slip => {
      const old = oldPositions.get(slip.dataset.candidate), now = slip.getBoundingClientRect();
      if (old) slip.animate([{ transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
    const panel = activePanel();
    if (panel) {
      const index = shownResumes.findIndex(r => r.id === state.openId);
      panel.querySelector('[data-action="previous-resume"]').disabled = index <= 0;
      panel.querySelector('[data-action="next-resume"]').disabled = index >= shownResumes.length - 1;
    }
    $('#readerStatus').textContent = `${R.find(r => r.id === from).name}已移至第${shownResumes.findIndex(r => r.id === from) + 1}份`;
  }
  const rail = $('#resumeRail');
  $('#candidatePicker').addEventListener('change', event => openResume(event.target.value));
  $('#candidateTrayToggle').addEventListener('click', () => {
    const tray = $('#candidateTray'); tray.hidden = !tray.hidden;
    $('#candidateTrayToggle').setAttribute('aria-expanded', String(!tray.hidden));
    renderRail();
    if (!tray.hidden) { revealActiveSlip(state.openId); $('#candidateSearch').focus({ preventScroll: true }); }
  });
  window.CardifReading.bindDrag(rail, {
    motion: () => state.motion && !reduced.matches,
    onCommit: (from, index) => {
      moveSlip(from, shownResumes[index].id);
      rail.querySelector(`[data-candidate="${from}"] .slip-grip`).focus({ preventScroll: true });
    }
  });
  rail.addEventListener('keydown', event => {
    const grip = event.target.closest('.slip-grip');
    if (!grip || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const from = grip.closest('.resume-slip').dataset.candidate;
    const index = shownResumes.findIndex(r => r.id === from);
    const target = shownResumes[index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1)];
    if (target) { moveSlip(from, target.id); rail.querySelector(`[data-candidate="${from}"] .slip-grip`).focus(); }
  });
  window.addEventListener('pagehide', () => { savePosition(); saveReading(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { savePosition(); saveReading(); } });
  postUI = window.CardifPostInterviewUI.create({
    record: caseRecord, resume: selected, job: J, questions: () => interviewDraft().questions,
    tags: () => tagsOf(selected()), privateNote: () => reviewNotes[state.openId]?.text || '',
    persist: () => { const saved = persistCase(); renderCaseToolbar(); return saved; },
    download: downloadFile, notify: toast
  });
  applicant = window.CardifApplicant.create({ job: J, paperContent, receive: receiveApplication });
  comparison = window.CardifComparison.create({ host: $('#jobComparison'), job: J, resumes: () => R, notify: toast,
    open: id => {
      state.search = ''; state.filter = ''; readingFilter = 'all'; workFilter = 'all'; $('#workFilter').value = 'all';
      renderWorkspace(); openResume(id); $('#resumeReader').scrollIntoView({ block: 'start', behavior: state.motion && !reduced.matches ? 'smooth' : 'instant' });
    }
  });
  if (applicant.loadError) toast('應徵資料無法讀取，請確認瀏覽器儲存設定。');
  try { interviewDrafts = I.restore(JSON.parse(localStorage.getItem(interviewKey)), R.map(r => r.id)); }
  catch { toast('面試問題無法讀取，請檢查瀏覽器儲存設定。'); }
  try { caseRecords = M.restore(JSON.parse(localStorage.getItem(caseKey)), R.map(r => r.id)); }
  catch { toast('招募紀錄無法讀取，請保留瀏覽器資料並檢查儲存設定。'); }
  try { const saved = JSON.parse(localStorage.getItem(jobScopeKey)); if (saved?.job === J.url) jobScope = M.restoreScope(saved.applicability); }
  catch { toast('職缺共同工作範圍無法讀取，請重新確認。'); }
  window.addEventListener('cardif-intake-change', () => { if (document.body.dataset.view === 'recruit') renderRecruit(); if (document.body.dataset.view === 'workspace') renderWorkspace(); renderNotifications(); });
  window.addEventListener('cardif:auth-change', () => { if (noteTimer) saveNotes(); route(true); });
  load(); loadWork(); loadReading(); loadNotes(); preferences(); route();
})();
