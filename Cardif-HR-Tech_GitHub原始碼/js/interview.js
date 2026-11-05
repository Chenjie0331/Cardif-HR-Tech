(function (root) {
  'use strict';
  // shortcut: 問題依目前五份履歷人工編寫，接入模型時仍須保留逐題的履歷依據。
  const suggestions = {
    R001: [
      { id: 'channel', text: '你負責 18 間合作分行時，怎麼決定每週優先拜訪誰？請用一次實際調整拜訪順序的經驗，說明你看了哪些訊號，以及調整後發生什麼變化。', source: 'e0-0', quote: '18 間分行' },
      { id: 'training', text: '請選一場你主辦的商品說明會，從參加對象、內容取捨、現場提問到會後追蹤，說明哪些環節由你親自負責，以及你用什麼證據判斷活動有效。', source: 'e0-1', quote: '每季自辦商品說明會約 6 場' },
      { id: 'process', text: '退件率從 9% 降到 4% 的改善中，你親自改了哪些流程？請說明統計期間、案件範圍，以及如何區分流程改善和案件組成變動帶來的影響。', source: 'e0-2', quote: '退件率由 9% 降至 4%' },
      { id: 'deadline', text: '假設月底前必須完成合作分行的新商品訓練，但分行臨時取消場次，同事已排好後續工作。你會如何調整人員、時程與交付範圍，並在什麼時間點回報？', source: 'e0-0', quote: '理專教育訓練' }
    ],
    R002: [
      { id: 'training', text: '請用一次新人課程為例，說明你實際負責的準備、帶領及現場工作。哪些由你獨立完成，哪些由主講者或其他同事負責？', source: 'e0-2', quote: '擔任助教 2 期' },
      { id: 'clients', text: '你經營約 180 位保戶時，如何安排聯絡頻率與服務優先順序？請舉出一位需求改變的保戶，說明你怎麼發現、確認需求並追蹤後續。', source: 'e0-0', quote: '累積保戶約 180 位' },
      { id: 'performance', text: '請挑選一段與 2024 年 MDRT 成果有關的工作經驗，說明你的目標、實際採取的行動，以及團隊或既有客源對結果的貢獻。', source: 'e0-1', quote: '2024 年獲公司 MDRT 資格' },
      { id: 'transition', text: '你希望從個人銷售轉往通路經營。假設合作分行連續兩週沒有推廣進展，你會先查哪些事情、與哪些人討論，並在什麼時間點向主管回報？', source: 's1', quote: '希望從個人銷售轉往通路經營' }
    ],
    R003: [
      { id: 'channel', text: '你在基金通路工作中，如何讓分行願意持續安排產品訓練？請用一間原本參與度不高的分行，說明你如何找到原因並調整合作方式。', source: 'e0-0', quote: '每月走訪分行' },
      { id: 'training', text: '你一年辦理約 30 場說明會時，怎麼讓不同分行的內容有所區別？請舉一場效果不如預期的活動，說明你看到的問題，以及下一次如何調整。', source: 'e0-0', quote: '年度辦理說明會約 30 場' },
      { id: 'transition', text: '你從基金通路轉向保險通路時，哪些既有做法可以沿用，哪些必須重新學習？請說明你會如何準備第一次保險商品訓練，以及如何檢查自己講授的內容。', source: 'e0-2', quote: '無保險商品銷售經驗' }
    ],
    R004: [
      { id: 'process', text: '請用一件你追蹤過的核保案件，說明從資料整理、發現缺件到結案的過程。你親自做了哪些判斷，又在哪些地方請業務員或其他單位協助？', source: 'e0-0', quote: '追蹤核保進度' },
      { id: 'event', text: '你協助說明會場務時，曾遇過什麼臨時狀況？請說明當時的優先順序、你能自行決定的範圍，以及你如何和主講者或活動負責人配合。', source: 'e0-1', quote: '偶爾協助說明會場務' },
      { id: 'ownership', text: '請選一份你在通路實習期間協助製作的簡報，說明資料從哪裡取得、你如何確認正確，以及你的整理對使用這份簡報的人有什麼幫助。', source: 'e1-0', quote: '簡報製作' }
    ],
    R005: [
      { id: 'performance', text: '你提到年度業績 3,000 萬元，請說明其中新客戶、既有客戶與團隊協作各占什麼角色。挑一筆你主導的成交，說明你做出的關鍵判斷。', source: 'e0-0', quote: '年度業績 3,000 萬元' },
      { id: 'training', text: '請用一次 ERP 產品說明會，說明你如何把複雜內容講給不同背景的聽眾理解。你怎麼發現對方沒有聽懂，又怎麼調整內容？', source: 'e0-0', quote: '常主持客戶產品說明會與教育訓練' },
      { id: 'partners', text: '你過去經營企業客戶時，如何協調採購、使用部門與決策者的不同要求？請說明一次意見衝突，以及你最後如何推動決定。', source: 'e1-0', quote: '經營中小企業客戶通訊方案' },
      { id: 'transition', text: '你計畫轉入金融保險領域，會如何安排商品學習、考照與通路工作的準備順序？請說明第一個月可以交付哪些具體成果。', source: 's1', quote: '願意從頭考照' }
    ]
  };
  suggestions.R004.find(q => q.id === 'event').text = '你在履歷中提到協助說明會場務。除此之外，是否曾規劃課程或實際主講？請選一次經驗，說明你親自負責的範圍。';
  suggestions.R004.find(q => q.id === 'ownership').text = '在豐禾人壽實習時，除了活動資料與簡報整理，是否曾直接接觸通路夥伴？請說明一次互動，以及你在其中負責什麼。';
  suggestions.R004.sort((a, b) => ['event', 'ownership', 'process'].indexOf(a.id) - ['event', 'ownership', 'process'].indexOf(b.id));
  function passages(resume) {
    return [...resume.experience.map((job, index) => ({ id: `job${index}`, section: '經歷', label: `${job.company.replace(/^（虛構）/, '')}・${job.title}`, text: `${job.company.replace(/^（虛構）/, '')} ${job.title} ${job.period}。${job.description}` })),
      ...root.CardifCore.sentences(resume).map(line => { const match = /^e(\d+)-/.exec(line.id), job = match && resume.experience[Number(match[1])]; return { ...line, label: job ? `${job.company.replace(/^（虛構）/, '')}・${job.title}` : line.section === '技能' ? `技能・${line.text}` : '自我介紹' }; })];
  }
  // shortcut: 目前以詞彙比對提供候選段落，連結必須由使用者確認，日後接模型仍保留確認步驟。
  function findPassages(resume, query) {
    const input = query.trim().toLocaleLowerCase();
    if (!input) return [];
    const tokens = [...new Intl.Segmenter('zh-TW', { granularity: 'word' }).segment(input)].filter(x => x.isWordLike && x.segment.length > 1).map(x => x.segment);
    const ignored = new Set(['請問', '請說明', '說明', '如何', '什麼', '你會', '心得', '感悟', '經驗', '工作', '可以', '是否', '曾經', '當時', '哪些', '你的', '以及']);
    const terms = [...new Set(tokens.filter(x => !ignored.has(x)))];
    return passages(resume).map(line => {
      const text = `${line.label} ${line.text}`.toLocaleLowerCase();
      const score = text.includes(input) ? 100 : terms.reduce((sum, term) => sum + (text.includes(term) ? term.length : 0), 0);
      return { ...line, score };
    }).filter(line => line.score > 1).sort((a, b) => b.score - a.score).slice(0, 6);
  }
  function validQuestion(q, allowBlank = false) {
    return q && typeof q.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(q.id)
      && typeof q.text === 'string' && q.text.length <= 1200 && (allowBlank || q.text.trim())
      && typeof q.followUp === 'string' && q.followUp.length <= 1600;
  }
  function cleanQuestion(q, candidate) {
    const result = { id: q.id, text: q.text, followUp: q.followUp };
    if (suggestions[candidate]?.some(item => item.id === q.sourceId)) result.sourceId = q.sourceId;
    const resume = root.RESUME_DATA.resumes.find(item => item.id === candidate);
    if (q.resumeSource === null) result.resumeSource = null;
    else if (resume && passages(resume).some(line => line.id === q.resumeSource)) result.resumeSource = q.resumeSource;
    return result;
  }
  function restore(saved, ids) {
    const drafts = Object.create(null);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return drafts;
    for (const id of ids) {
      const entry = saved[id];
      if (!entry || !Array.isArray(entry.questions)) continue;
      const seen = new Set();
      drafts[id] = { questions: entry.questions.slice(0, 50).filter(q => {
        if (!validQuestion(q) || seen.has(q.id)) return false;
        seen.add(q.id); return true;
      }).map(q => cleanQuestion(q, id)), editor: null, savedAt: null };
      if (validQuestion(entry.editor, true)) drafts[id].editor = cleanQuestion(entry.editor, id);
      if (entry.singleList === true) drafts[id].singleList = true;
      if (entry.revision === 2) drafts[id].revision = 2;
      if (typeof entry.savedAt === 'string' && !Number.isNaN(Date.parse(entry.savedAt))) drafts[id].savedAt = entry.savedAt;
    }
    return drafts;
  }
  function prepare(candidate, draft) {
    const entry = draft || { questions: [], editor: null, savedAt: null };
    return { ...entry, questions: entry.questions, singleList: true, revision: 2 };
  }
  function choose(candidate, draft, sourceId) {
    const entry = prepare(candidate, draft), suggestion = suggestions[candidate]?.find(q => q.id === sourceId);
    if (!suggestion) throw new Error('找不到這項建議問題。');
    if (entry.questions.some(q => q.text === suggestion.text)) return entry;
    if (entry.questions.length >= 50) throw new Error('面試問題最多可保留 50 題。');
    return { ...entry, questions: [...entry.questions, { id: crypto.randomUUID(), text: suggestion.text, followUp: '', sourceId }] };
  }
  function move(questions, id, offset) {
    const index = questions.findIndex(q => q.id === id), next = index + offset;
    const result = [...questions];
    if (index >= 0 && next >= 0 && next < result.length) [result[index], result[next]] = [result[next], result[index]];
    return result;
  }
  const api = { suggestions, passages, findPassages, restore, prepare, choose, move };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardifInterview = api;
})(typeof window === 'object' ? window : globalThis);
