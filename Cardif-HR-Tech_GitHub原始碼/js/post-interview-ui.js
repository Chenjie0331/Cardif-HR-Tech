(function (root) {
  'use strict';
  const P = root.CardifPostInterview;
  function create(context) {
    let host, personId, view = 'records', removed = null, includePrivate = false, includeQuestions = false;
    const row = id => document.getElementById(id).content.cloneNode(true).firstElementChild;
    const field = (node, name) => node.querySelector(`[data-field="${name}"]`);
    const record = () => context.record().postInterview;
    const now = () => new Date().toISOString();
    const dateLabel = value => value ? value.replace('T', ' ').slice(0, 16) : '';
    function error(message) {
      const area = host.querySelector('.post-error');
      area.textContent = message; area.hidden = !message;
    }
    function save(value, stage) {
      context.record().postInterview = value;
      if (stage) context.record().stage = stage;
      return context.persist();
    }
    function reportContext() {
      return { resume: context.resume(), job: context.job, tags: context.tags(), privateNote: context.privateNote(), includePrivate, includeQuestions };
    }
    function add() {
      let value = record();
      const nextRound = Boolean(value.completedAt);
      if (value.completedAt) {
        value = P.reopen(value);
        value.assessment.decision = ''; value.assessment.next = '';
      }
      save(P.addSession(value, crypto.randomUUID(), context.questions(), now()), nextRound ? 'preparing' : undefined);
      view = 'records'; render(host);
      host.querySelector('#roundNotes')?.focus({ preventScroll: true });
    }
    function render(panel) {
      host = panel;
      if (personId !== context.resume().id) { personId = context.resume().id; removed = null; includePrivate = false; includeQuestions = false; }
      const value = record(), locked = Boolean(value.completedAt);
      host.replaceChildren(row('postInterviewTemplate'));
      host.querySelectorAll('[data-post-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.postView === view)));
      host.querySelectorAll('[data-post-surface]').forEach(section => { section.hidden = section.dataset.postSurface !== view; });
      field(host, 'completion').textContent = locked ? `評估完成 · ${new Date(value.completedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}` : '';
      host.querySelector('[data-post-action=reopen]').hidden = !locked;
      host.querySelector('[data-post-action=export]').disabled = !P.hasContent(value);
      host.querySelector('[data-post-action=new]').textContent = locked ? '新增下一輪' : '新增面試紀錄';
      host.querySelector('[data-post-action=undo]').hidden = !removed;
      field(host, 'sessions').replaceChildren(...value.sessions.map((session, index) => {
        const button = row('postSessionButtonTemplate');
        button.dataset.sessionId = session.id;
        button.setAttribute('aria-pressed', String(session.id === value.selectedId));
        field(button, 'name').textContent = session.title || `第 ${index + 1} 次面試`;
        field(button, 'meta').textContent = [dateLabel(session.at), session.interviewer].filter(Boolean).join(' · ');
        field(button, 'meta').hidden = !field(button, 'meta').textContent;
        return button;
      }));
      const session = value.sessions.find(s => s.id === value.selectedId);
      const editor = field(host, 'sessionEditor');
      if (!session) editor.replaceChildren(row('postEmptyTemplate'));
      else {
        editor.replaceChildren(row('postSessionTemplate'));
        editor.querySelectorAll('[data-session-field]').forEach(input => { input.value = session[input.dataset.sessionField]; input.disabled = locked; });
        editor.querySelector('[data-post-action=remove]').hidden = locked;
        const questions = field(editor, 'questionReference');
        questions.hidden = !session.questions.length;
        field(editor, 'questions').replaceChildren(...session.questions.map(q => { const item = document.createElement('li'); item.textContent = q.text; return item; }));
      }
      host.querySelectorAll('[data-assessment-field]').forEach(input => {
        const name = input.dataset.assessmentField;
        input.value = name === 'tags' ? value.assessment.tags.join('、') : value.assessment[name]; input.disabled = locked;
      });
      const decision = host.querySelector('[data-assessment-field=decision]');
      const picker = field(host, 'observationPicker'), observations = P.observations(value);
      picker.hidden = locked || !observations.length;
      field(picker, 'observations').replaceChildren(...observations.map(source => {
        const item = row('postObservationTemplate');
        field(item, 'title').textContent = source.title;
        field(item, 'text').textContent = source.text;
        item.querySelectorAll('[data-post-action=cite]').forEach(button => {
          button.dataset.observationSession = source.sessionId; button.dataset.observationIndex = source.index;
        });
        return item;
      }));
      decision.replaceChildren(new Option('選擇後續處理', ''), ...Object.entries(P.decisions).map(([key, label]) => new Option(label, key)));
      decision.value = value.assessment.decision;
      host.querySelector('[data-post-action=finish]').hidden = locked;
      const previousReviews = locked ? value.history.slice(0, -1) : value.history;
      const history = field(host, 'history'); history.hidden = !previousReviews.length;
      field(history, 'items').replaceChildren(...previousReviews.slice().reverse().map(item => {
        const detail = row('postHistoryTemplate');
        detail.querySelector('summary').textContent = `${new Date(item.at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })} · ${P.decisions[item.assessment.decision] || '評估完成'}`;
        detail.querySelector('p').textContent = item.assessment.summary;
        return detail;
      }));
      host.querySelector('[data-post-option=private]').checked = includePrivate;
      host.querySelector('[data-post-option=questions]').checked = includeQuestions;
      const preview = field(host, 'preview');
      if (P.hasContent(value)) preview.innerHTML = P.fragment(value, reportContext());
      else preview.replaceChildren(row('postPreviewEmptyTemplate'));
      host.onclick = click;
      host.oninput = input;
      host.onchange = event => {
        const option = event.target.dataset.postOption;
        if (!option) return;
        if (option === 'private') includePrivate = event.target.checked;
        if (option === 'questions') includeQuestions = event.target.checked;
        render(host);
        host.querySelector(`[data-post-option="${option}"]`).focus({ preventScroll: true });
      };
    }
    function input(event) {
      const control = event.target;
      try {
        if (control.dataset.sessionField) {
          save(P.updateSession(record(), record().selectedId, { [control.dataset.sessionField]: control.value }, now()), control.dataset.sessionField === 'notes' && control.value.trim() && ['reviewing', 'preparing'].includes(context.record().stage) ? 'interviewed' : undefined);
          if (['title', 'at', 'interviewer'].includes(control.dataset.sessionField)) {
            const session = record().sessions.find(s => s.id === record().selectedId), button = host.querySelector(`[data-session-id="${session.id}"]`);
            field(button, 'name').textContent = session.title || '面試紀錄';
            field(button, 'meta').textContent = [dateLabel(session.at), session.interviewer].filter(Boolean).join(' · ');
            field(button, 'meta').hidden = !field(button, 'meta').textContent;
          }
        } else if (control.dataset.assessmentField) {
          const name = control.dataset.assessmentField;
          save(P.updateAssessment(record(), { [name]: name === 'tags' ? P.parseTags(control.value) : control.value }));
        } else return;
        control.removeAttribute('aria-invalid'); error('');
        host.querySelector('[data-post-action=export]').disabled = !P.hasContent(record());
      } catch (e) { control.setAttribute('aria-invalid', 'true'); error(e.message); }
    }
    function click(event) {
      const button = event.target.closest('button');
      if (!button || !host.contains(button)) return;
      try {
        if (button.dataset.postView) { view = button.dataset.postView; render(host); host.querySelector(`[data-post-view="${view}"]`).focus({ preventScroll: true }); return; }
        if (button.dataset.sessionId) { const value = P.restore(record()); value.selectedId = button.dataset.sessionId; save(value); render(host); host.querySelector(`[data-session-id="${value.selectedId}"]`).focus({ preventScroll: true }); return; }
        switch (button.dataset.postAction) {
          case 'cite': {
            const target = button.dataset.citeTarget, before = record().assessment[target];
            const value = P.citeObservation(record(), button.dataset.observationSession, Number(button.dataset.observationIndex), target);
            const saved = save(value); render(host);
            host.querySelector(`[data-assessment-field="${target}"]`).focus({ preventScroll: true });
            if (!saved) error('引用內容尚未保存，請先匯出評估文件。');
            else context.notify(before === value.assessment[target] ? '這段觀察已引用' : '已引用面試觀察，原始紀錄仍保留');
            return;
          }
          case 'new': add(); return;
          case 'remove': {
            const value = record(), index = value.sessions.findIndex(s => s.id === value.selectedId);
            removed = { session: structuredClone(value.sessions[index]), index };
            save(P.removeSession(value, value.selectedId)); render(host); context.notify('已刪除面試紀錄，可復原'); return;
          }
          case 'undo': {
            if (!removed) return;
            if (record().completedAt) throw new Error('請先重新編輯評估，再復原紀錄。');
            const value = P.restore(record()); value.sessions.splice(removed.index, 0, removed.session); value.selectedId = removed.session.id;
            save(P.restore(value, true)); removed = null; render(host); return;
          }
          case 'finish': {
            const invalid = host.querySelector('[aria-invalid=true]'); if (invalid) { invalid.focus(); return; }
            const value = P.finish(record(), now()), saved = save(value, P.stage(value.assessment.decision)); render(host);
            if (saved) context.notify('面試評估已完成'); else error('儲存失敗，內容仍在本次頁面，請先匯出評估文件。'); return;
          }
          case 'reopen': save(P.reopen(record()), 'interviewed'); render(host); context.notify('已重新開啟評估，先前完成紀錄仍保留'); return;
          case 'export': context.download(P.report(record(), reportContext()), `${context.resume().name}-面試評估.html`, 'text/html;charset=utf-8'); context.notify('已匯出評估文件，開啟後可列印或另存 PDF'); return;
        }
      } catch (e) { error(e.message); host.querySelector('.post-error').focus({ preventScroll: true }); }
    }
    return { render, start() {
      if (!record().sessions.length) save(P.addSession(record(), crypto.randomUUID(), context.questions(), now()));
      view = 'records';
    } };
  }
  root.CardifPostInterviewUI = { create };
})(window);
