(function (root) {
  'use strict';
  const Post = root.CardifPostInterview || (typeof require === 'function' ? require('./post-interview.js') : null);
  const statusLabels = { open: '未核對', confirmed: '已確認', ask: '面試詢問', request: '補充資料', na: '不適用' };
  const stages = { reviewing: '履歷整理中', preparing: '面試準備中', interviewed: '面試已完成', followup: '等待補充資料', complete: '本輪已結束' };
  const requirements = [
    ['experience', '3 年以上壽險業務輔導或個人銷售經驗'],
    ['training', '獨立規劃說明會與教育訓練'],
    ['channel', '銀行通路、分行或業務員經營'],
    ['education', '商管相關科系、大學以上'],
    ['language', '國台語與英文基本讀寫'],
    ['office', 'Office 工具運用']
  ];
  // shortcut: 五份競賽履歷使用逐人核對的分析，擴充履歷來源時改接可驗證的分析流程。
  const evidence = {
    R001: [
      ['2020/03 起從事壽險銀行通路輔導，另有銀行理財銷售經驗。', 'e0-0'],
      ['每季自辦約 6 場說明會，每場 20–40 人，並列出教育訓練規劃與主講技能。', 'e0-1'],
      ['負責 3 家合作銀行、18 間分行的通路經營。', 'e0-0'],
      ['政治大學風險管理與保險學系學士。'],
      ['列有國台語流利及英文基本讀寫，TOEIC 680。', 'k5'],
      ['列有 Excel 樞紐分析、PowerPoint 簡報製作。', 'k2']
    ],
    R002: [
      ['2019/07 起從事壽險個人銷售，經營約 180 位保戶。', 'e0-0'],
      ['曾擔任新人課程助教 2 期，未獨立主講大型說明會，需詢問實際帶領範圍。', 'e0-2'],
      ['表達轉往通路經營的意願，履歷未列出分行或理專經營實績。', 's1'],
      ['臺北大學企業管理學系學士。'],
      ['列有國台語流利，英文讀寫能力可在面試中詢問。', 'k3'],
      ['列有 Excel、Word，簡報製作經驗可再詢問。', 'k2']
    ],
    R003: [
      ['2019/08 起從事基金通路工作，履歷明確寫無保險商品銷售經驗。', 'e0-2'],
      ['為理專舉辦產品教育訓練，年度辦理約 30 場說明會。', 'e0-0'],
      ['每月走訪銀行分行、推廣基金，具有銀行通路經營經驗。', 'e0-0'],
      ['中央大學財務金融學系碩士、中興大學財務金融學系學士。'],
      ['英文流利、TOEIC 890，國台語溝通能力可在面試中詢問。', 'k3'],
      ['列有 Excel、PowerPoint 進階及月報製作經驗。', 'e0-1']
    ],
    R004: [
      ['2024/07 起為業務助理，工作以文件、核保追蹤及保戶服務為主，未列出壽險銷售或業務輔導經歷。', 'e0-0'],
      ['協助說明會場務，主講與課程規劃經驗未列出。', 'e0-1'],
      ['通路實習內容是活動資料彙整與簡報製作，需詢問是否參與通路經營。', 'e1-0'],
      ['銘傳大學風險管理與保險學系學士。'],
      ['列有國台語流利，英文能力可在面試中詢問。', 'k2'],
      ['列有 PowerPoint、Excel，並有簡報製作經驗。', 'e1-0']
    ],
    R005: [
      ['經歷為 B2B 軟體與企業客戶銷售，履歷明確寫無金融保險背景。', 's0'],
      ['經常主持客戶產品說明會與教育訓練，可詢問跨產品領域的教學方式。', 'e0-0'],
      ['企業客戶經營經驗來自軟體與電信，未列出銀行分行或保險通路經驗。', 'e1-0'],
      ['臺灣科技大學資訊管理系學士，可確認學習內容與商管要求的關聯。'],
      ['列有英文中等，國台語溝通能力可在面試中詢問。', 'k3'],
      ['列有 PowerPoint、Excel。', 'k2']
    ]
  };
  const interviewQuestions = {
    R001: [
      '你在壽險通路輔導與銀行理財銷售兩段經歷中，各自負責哪些業務？請說明直接銷售與協助理專銷售的工作範圍，以及各自持續的期間。',
      '請選一場你獨立主辦的商品說明會，說明內容如何決定、哪些部分由你主講，以及會後用什麼結果檢查訓練成效。',
      '負責 18 間分行時，你如何安排拜訪與支援順序？請說明一次分行不願配合的情況，以及你如何推動後續合作。',
      '風險管理與保險學系的哪些訓練，曾實際用在你的通路輔導工作？請用一項具體工作說明。',
      '請選一個曾用英文閱讀的保險相關資料，說明如何確認專有名詞與產品限制，再轉述給通路夥伴。',
      '請以退件率改善為例，說明 Excel 資料如何整理、如何檢查錯誤，以及你怎麼讓主管看懂改善結果。'
    ],
    R002: [
      '請說明你從事壽險個人銷售的期間與實際負責範圍，再以一位保戶為例說明從需求確認到後續服務的完整過程。',
      '新人課程助教的兩期經驗中，你是否曾自行規劃內容並上台講授？請分別說明獨立負責、協助主講者和純行政支援的部分。',
      '你希望轉往通路經營，過去是否曾與銀行分行、理專或其他業務夥伴共同推動業務？請說明你的角色與具體成果。',
      '企業管理學系的學習中，有哪些內容能幫助你管理合作通路，而不只處理個人銷售？請舉例。',
      '工作中若收到英文產品資料，你會如何確認內容、整理重點並處理不理解的專業用語？請用實際經驗說明。',
      '請說明你曾用 Excel 整理哪些業務資料，以及是否自行製作過課程或商品介紹簡報。'
    ],
    R003: [
      '履歷寫到你沒有保險商品銷售經驗，請說明基金通路經驗中哪些能直接轉用，哪些保險知識與資格必須另外補足。',
      '一年約 30 場說明會中，請選一場效果不如預期的活動，說明你如何區分內容、講授方式與市場環境造成的影響。',
      '請用一間原本配合度不高的分行，說明你如何找到關鍵窗口、建立合作方式並追蹤成效。',
      '財務金融研究與保險通路工作之間，你認為最需要轉換的思考方式是什麼？請用具體產品或客戶情境說明。',
      '若要用國語與台語向不同通路夥伴說明同一項產品限制，你會如何確認對方理解？請說明你過去的使用經驗。',
      '請選一份你製作的月報，說明資料來源、Excel 分析方式，以及主管依據這份報告做了什麼決定。'
    ],
    R004: [
      '目前履歷以業務助理和實習經驗為主。請說明你是否另有壽險銷售或業務輔導經歷，並交代實際工作內容與期間。',
      '你提到協助說明會場務，除此之外，是否曾規劃課程或實際主講？請選一次經驗，說明你親自負責的範圍。',
      '在豐禾人壽實習時，除了活動資料與簡報整理，是否曾直接接觸通路夥伴？請說明一次互動，以及你在其中負責什麼。',
      '保險相關科系的學習中，哪一項知識曾幫助你處理要保文件或核保追蹤？請說明實際應用。',
      '若必須閱讀英文產品資料並整理成中文重點，你目前能獨立完成哪些部分？請用學習或工作經驗說明。',
      '請選一份在實習期間製作的簡報，說明資料如何取得、你如何確認正確，以及使用者如何運用這份簡報。'
    ],
    R005: [
      '你目前的經歷來自軟體與企業客戶銷售，請說明是否另有金融保險相關經驗，以及轉入壽險通路工作需要補足哪些知識與資格。',
      '請用一場你主持的 ERP 說明會，說明內容規劃、講授與成效確認的方式。若轉為保險商品訓練，你會如何確認內容精確？',
      '企業客戶銷售與銀行通路經營的決策關係不同。請說明你過去如何協調多個窗口，以及轉到分行合作時需要改變哪些做法。',
      '資訊管理系的學習中，哪些內容與企業經營或商業分析有關？請說明它們如何用在你的銷售工作。',
      '請說明你在工作中使用國語、台語與英文的實際情境，以及哪些產品說明可以自行完成、哪些需要協助。',
      '請用一次企業客戶提案，說明 PowerPoint 與 Excel 各自承擔什麼工作，以及你如何檢查資料一致性。'
    ]
  };
  function questionFor(resume, requirement) {
    const index = requirements.findIndex(([id]) => id === requirement);
    return index < 0 || !interviewQuestions[resume.id] ? null : { text: interviewQuestions[resume.id][index], source: evidence[resume.id][index][1], requirement };
  }
  const equivalentQuestions = { R001: { training: 'training', channel: 'channel' }, R002: { training: 'training', channel: 'transition' }, R003: { training: 'training', channel: 'channel', experience: 'transition' }, R004: { training: 'event', channel: 'ownership' }, R005: { training: 'training', channel: 'partners', experience: 'transition' } };
  function existingQuestion(resume, requirement, questions) {
    const source = equivalentQuestions[resume.id]?.[requirement];
    const original = root.CardifInterview.suggestions[resume.id]?.find(q => q.id === source);
    return questions.find(q => q.id === `requirement-${requirement}` || (original && q.sourceId === source && q.text === original.text));
  }
  function matchesWork(resume, filter, records, viewed) {
    const record = records[resume.id];
    if (filter === 'unread') return !viewed.includes(resume.id);
    if (filter === 'ask') return Object.values(record?.checks || {}).some(check => check.status === 'ask');
    if (filter === 'request') return record?.stage === 'followup' || Object.values(record?.checks || {}).some(check => check.status === 'request');
    if (filter.startsWith('stage:')) return (record?.stage || 'reviewing') === filter.slice(6);
    return true;
  }
  const law = { url: 'https://law.fsc.gov.tw/LawContent.aspx?id=FL006761', checkedAt: '2026-11-03', revision: '2025-01-02' };
  const legalChecks = [
    ['qualification', '業務員資格與測驗', '核對業務員資格測驗合格或適用的既有登錄資格，以及規則要求的學歷。', '第 5 條'],
    ['registration', '招攬前的業務員登錄', '工作涉及保險招攬時，核對登錄與登錄證，並確認所屬公司。', '第 3、6 條'],
    ['authorization', '招攬種類與授權範圍', '依實際招攬的保險種類，核對公司授權範圍及適用測驗資格。', '第 4、11 條'],
    ['restrictions', '登錄申請限制事項', '依公司正式任用流程核對法定不得登錄事項，記錄核對進度與處理結果。', '第 7 條']
  ];
  const checkIds = [...requirements.map(([id]) => id), ...Array.from({ length: 5 }, (_, i) => `cert${i}`), ...legalChecks.map(([id]) => id)];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const bounded = (value, max) => typeof value === 'string' && value.length <= max ? value : '';
  const restoreScope = value => ['unknown', 'yes', 'no'].includes(value) ? value : 'unknown';
  const applicability = (record, jobScope) => record.scopeOverride ? record.applicability : restoreScope(jobScope);
  function restoreCase(value) {
    const record = { stage: 'reviewing', applicability: 'unknown', scopeOverride: false, checks: Object.create(null), at: '', interviewer: '', answers: Object.create(null), conclusion: '', next: '', updatedAt: null, postInterview: Post.initial() };
    if (!object(value)) return record;
    record.postInterview = Post.restore(value.postInterview);
    if (Object.hasOwn(stages, value.stage)) record.stage = value.stage;
    if (['unknown', 'yes', 'no'].includes(value.applicability)) record.applicability = value.applicability;
    record.scopeOverride = typeof value.scopeOverride === 'boolean' ? value.scopeOverride : record.applicability !== 'unknown';
    for (const id of checkIds) {
      const check = object(value.checks) && Object.hasOwn(value.checks, id) ? value.checks[id] : null;
      if (object(check) && Object.hasOwn(statusLabels, check.status)) record.checks[id] = { status: check.status, note: bounded(check.note, 1200) };
    }
    if (typeof value.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.at) && !Number.isNaN(Date.parse(value.at + 'Z')) && new Date(value.at + 'Z').toISOString().slice(0, 16) === value.at) record.at = value.at;
    record.interviewer = bounded(value.interviewer, 100);
    record.conclusion = bounded(value.conclusion, 4000);
    record.next = bounded(value.next, 2000);
    if (object(value.answers)) for (const [id, text] of Object.entries(value.answers).slice(0, 50)) {
      if (/^[a-zA-Z0-9-]{1,80}$/.test(id) && typeof text === 'string' && text.length <= 4000) record.answers[id] = text;
    }
    if (typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))) record.updatedAt = value.updatedAt;
    return record;
  }
  function restore(value, ids) {
    const records = Object.create(null);
    if (!object(value)) return records;
    for (const id of ids) if (Object.hasOwn(value, id)) records[id] = restoreCase(value[id]);
    return records;
  }
  function assessment(resume) {
    if (!evidence[resume.id]) return requirements.map(([id, title]) => {
      if (id === 'education') return { id, title, text: resume.education.map(item => [item.school, item.major, item.degree].filter(Boolean).join('・')).join('，'), source: null };
      if (id === 'experience') return { id, title, text: resume.experience.map(item => `${item.company}・${item.title} ${item.period}`).join('，') || '履歷未列出工作經歷。', source: resume.experience.length ? 'job0' : null };
      const pattern = { training: /培訓|訓練|課程|授課|說明會|主講/, channel: /通路|分行|銀行|業務員/, language: /英文|英語|台語|國語|TOEIC|多益/i, office: /Excel|Word|PowerPoint|Office|簡報/i }[id];
      const hits = root.CardifCore.sentences(resume).filter(line => (['language', 'office'].includes(id) ? line.section === '技能' : line.section !== '自傳') && pattern.test(line.text)).slice(0, 3);
      return { id, title, text: hits.map(line => line.text).join(' ') || '履歷未列出這項內容。', source: hits[0]?.id || null };
    });
    return requirements.map(([id, title], i) => ({ id, title, text: evidence[resume.id][i][0], source: evidence[resume.id][i][1] }));
  }
  function parseBackup(value, ids) {
    if (!object(value) || value.format !== 'cardif-recruitment' || value.version !== 1 || !ids.includes(value.candidate) || !object(value.case) || !object(value.interview) || !Array.isArray(value.interview.questions) || !Array.isArray(value.tags) || value.tags.length > 30) throw new Error('這不是可匯入的Cardif-HR Tech備份。');
    if (value.case.postInterview !== undefined) Post.restore(value.case.postInterview, true);
    const tags = value.tags.map(tag => {
      if (!object(tag) || typeof tag.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(tag.id) || !bounded(tag.name, 60) || !['suggested', 'confirmed'].includes(tag.status) || !Array.isArray(tag.sources) || tag.sources.length > 100 || tag.sources.some(s => typeof s !== 'string' || s.length > 30)) throw new Error('備份中的標籤格式不正確。');
      const base = { id: tag.id, name: tag.name, status: tag.status, sources: tag.sources };
      if (tag.schemaVersion === undefined) return base;
      if (tag.schemaVersion !== 2 || !bounded(tag.description, 1200) || !tag.description.trim()
          || !['strength', 'experience', 'stage', 'focus'].includes(tag.kind) || tag.origin !== 'resume'
          || tag.resumeId !== value.candidate || !bounded(tag.jobUrl, 500) || !/^https?:\/\//.test(tag.jobUrl)
          || !bounded(tag.engine, 80)) throw new Error('備份中的人才輪廓格式不正確。');
      return { ...base, description: tag.description, kind: tag.kind, schemaVersion: 2,
        resumeId: tag.resumeId, jobUrl: tag.jobUrl, origin: tag.origin, engine: tag.engine };
    });
    if (new Set(tags.map(t => t.id)).size !== tags.length) throw new Error('備份含有重複標籤。');
    if (typeof value.note !== 'string' || value.note.length > 2000) throw new Error('備份中的筆記格式不正確。');
    return { candidate: value.candidate, case: restoreCase(value.case), interview: value.interview, tags, note: value.note };
  }
  function escape(text) { return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function report(data) {
    const { resume, job, record, draft, review, note, tags } = data;
    const p = text => `<p>${escape(text).replace(/\n/g, '<br>')}</p>`;
    const check = id => escape(statusLabels[record.checks[id]?.status] || '未核對');
    const noteFor = id => escape(record.checks[id]?.note || '—').replace(/\n/g, '<br>');
    const table = (headings, rows) => `<div class="report-table-wrap"><table class="${headings.length === 4 ? 'report-checks' : headings[0] === '題次' ? 'report-questions' : 'report-tags'}"><thead><tr>${headings.map(title => `<th scope="col">${escape(title)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const section = (title, body) => `<section><h2>${title}</h2>${body}</section>`;
    const qualification = table(['職缺要求', '履歷依據', '核對結果', '補充事項'], assessment(resume).map(item => [escape(item.title), escape(item.text), check(item.id), noteFor(item.id)]));
    const certificates = table(['加分證照', '履歷列示', '核對結果', '補充事項'], job.certs.map((cert, i) => [escape(cert), resume.certs.includes(cert) ? '列有此證照' : '未列出', check(`cert${i}`), noteFor(`cert${i}`)]));
    const scope = p(`工作是否涉及保險招攬：${{ unknown: '未確認', yes: '涉及', no: '不涉及' }[record.applicability] || '未確認'}`)
      + (record.applicability === 'yes' ? table(['查核項目', '查核依據', '核對結果', '補充事項'], legalChecks.map(([id, title, text, article]) => [escape(title), `${escape(text)}<br>保險業務員管理規則 ${escape(article)}`, check(id), noteFor(id)])) : '');
    const questions = draft.questions.length ? table(['題次', '本次面試題目', '履歷提及處'], draft.questions.map((q, i) => {
      const source = Object.hasOwn(q, 'resumeSource') ? root.CardifInterview.passages(resume).find(x => x.id === q.resumeSource) : root.CardifInterview.suggestions[resume.id]?.find(x => x.id === q.sourceId);
      return [String(i + 1), escape(q.text).replace(/\n/g, '<br>'), source ? `<p class="quote">${escape((source.quote || source.text).replace(/[；;]/g, '，'))}</p>` : '一般面試問題'];
    })) : p('尚未選擇本次面試題目。');
    const content = `<article class="report-document"><header><h1>招募整理紀錄</h1><h3>${escape(resume.name)}</h3>${p(job.title)}${p(stages[record.stage])}</header>`
      + section('履歷整理', p(review.summary || '未填寫摘要') + review.points.map(x => p(x.text)).join(''))
      + section('職缺與資格', qualification)
      + section('證照核對', p(`履歷列出的證照：${resume.certs.join('、') || '未列出'}`) + certificates)
      + section('任用與工作範圍', scope)
      + (data.includePrivate ? section('HR 筆記', p(note || '未填寫')) : '')
      + section('人才標籤', tags.length ? table(['標籤', '說明'], tags.map(tag => [escape(tag.name), escape(tag.description || '—')])) : p('目前沒有標籤'))
      + section('面試問題', questions)
      + section('資料來源', `<p><a href="${escape(job.url)}">104 職缺資料</a></p><p><a href="${law.url}">保險業務員管理規則</a>（查閱 ${law.checkedAt}，修正 ${law.revision}）</p>`)
      + '</article>' + (Post.hasContent(record.postInterview) ? Post.fragment(record.postInterview, { resume, job }) : '');
    return Post.reportDocument(`${resume.name}｜招募整理`, content);
  }
  const api = { statusLabels, stages, requirements, law, legalChecks, checkIds, assessment, questionFor, existingQuestion, matchesWork, restoreScope, applicability, restoreCase, restore, parseBackup, report };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardifRecruitment = api;
})(typeof window === 'object' ? window : globalThis);
