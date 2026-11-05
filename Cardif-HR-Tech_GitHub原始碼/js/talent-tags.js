(function (root) {
  'use strict';
  // Local analysis rules. Model responses can later use this same record shape.
  const rules = [
    ['translation', '擅長商品轉譯', 'strength', /商品精神轉成|把.{0,15}(商品|技術|專業).{0,20}(聽得懂|易懂|理解)/,
      '履歷描述將商品內容轉成理專容易理解的說法，呈現專業內容轉譯的線索。'],
    ['tracking', '重視數據追蹤', 'strength', /用數據追蹤|追蹤.{0,8}(數據|達成率)|數據追蹤.{0,8}成效/,
      '履歷提到用數據追蹤工作成效，工作方式偏向持續觀察結果與調整。'],
    ['process', '參與流程改善', 'strength', /建立.{0,15}SOP|改善.{0,12}流程|流程.{0,8}改善|優化.{0,12}流程/,
      '有參與作業流程或 SOP 改善的描述，可看出對工作方法與執行效率的關注。'],
    ['channel', '熟悉銀行通路', 'experience', /分行.{0,20}(通路經營|理專|教育訓練)|銀行保險通路經營|銀行通路.{0,12}(經營|教育|訓練)/,
      '履歷列有銀行分行經營或理專訓練，與目前職缺的通路合作工作相關。', 'insurance'],
    ['customers', '偏重客戶經營', 'experience', /累積保戶|經營.{0,12}客戶|客戶關係經營|經營中高資產/,
      '工作描述著重持續經營客戶關係與需求，能幫助理解其過往業務工作的重心。'],
    ['hosting', '有主講主持經驗', 'experience', /主持.{0,12}說明會|說明會主持|規劃與主講|獨立.{0,8}主講/,
      '履歷明確描述主持或主講說明會，具有面向聽眾介紹內容的實作經驗。'],
    ['large-hosting-gap', '尚無大型主講經驗', 'focus', /(未|尚未|沒有).{0,5}獨立主講大型說明會/,
      '履歷明確提到尚未獨立主講大型說明會。這項描述不排除已有助教或小型活動經驗。', null, true],
    ['hosting-gap', '尚無獨立主講經驗', 'focus', /(未|尚未|沒有).{0,5}獨立主講(?!大型)/,
      '履歷明確描述尚未獨立主講，可與協助課程、場務等不同參與程度分開理解。', null, true],
    ['support', '經驗以支援為主', 'experience', /業務助理與通路實習|以.{0,8}(行政|活動).{0,8}支援為主|從行政與活動支援/,
      '履歷中的經驗以行政與活動支援為主，可先從實際負責的任務理解其工作範圍。'],
    ['administration', '熟悉文件作業', 'experience', /整理要保文件|追蹤核保進度|文件核對與整理/,
      '工作內容包含文件整理與作業進度追蹤，經驗較貼近保險行政與日常案件支援。', 'insurance'],
    ['channel-transition', '轉向通路經營', 'stage', /轉往通路經營|走向通路經營/,
      '履歷表達往通路經營發展的方向，這是職涯意向，實際經驗可搭配其既有工作內容理解。', 'insurance'],
    ['teaching-support', '有課程協助經驗', 'experience', /擔任助教|課程助教|新人課程.{0,10}助教/,
      '有協助課程或擔任助教的經驗，參與方式以支援教學為主。'],
    ['transition', '跨領域轉職', 'stage', /跨入金融|跨入保險|轉入保險|轉職進入金融/,
      '履歷表達從既有產業轉入金融保險的方向，可保留原領域經驗並留意新領域的學習需求。', 'insurance'],
    ['insurance-gap', '保險銷售待累積', 'focus', /(?:無|沒有|尚無)保險商品銷售經驗/,
      '履歷明確表示沒有保險商品銷售經驗，其他產品銷售或通路經驗仍可另行考量。', 'insurance', true],
    ['insurance-new', '金融保險起步', 'stage', /無金融保險背景|沒有金融保險背景/,
      '履歷明確表示金融保險背景尚待累積，現有經驗主要來自其他產業。', 'insurance', true],
    ['learning', '有考照規劃', 'stage', /規劃考取|願意從頭考照|預計.{0,6}考照/,
      '履歷表達了取得相關證照的規劃或意願，這項標籤代表準備方向。'],
    ['new-graduate', '應屆畢業', 'stage', /應屆|剛畢業|今年畢業/,
      '履歷明確提到近期畢業，職涯正處於從學習走向職場的階段。'],
    ['first-job', '尚無工作經驗', 'stage', /(?:尚無|沒有|無)工作經驗|尚無正職經驗/,
      '履歷明確表示尚無工作或正職經驗，可從學習、專案與實習等內容理解其起點。', null, true],
    ['coordination', '善於協調', 'strength', /善於協調|擅長協調|主動.{0,8}協調/,
      '履歷自述協調的工作方式或行為，這是目前資料呈現的特質線索。'],
    ['detail', '細節導向', 'strength', /注重細節|重視細節|自認細心/,
      '履歷自述重視工作細節，這項特質反映其對自身工作方式的描述。']
  ];
  function analyze(resume, job) {
    if (!job?.url) return [];
    const lines = root.CardifCore.sentences(resume);
    const clauses = lines.flatMap(line => line.text.split(/[；;。，,]|但|然而|不過/).map(text => ({ id: line.id, text })));
    const negative = /(?:沒有|尚未|未曾|未|無|不曾|缺乏|不具備).{0,12}(?:經驗|主講|主持|經營|訓練|簡報|改善|協調|細節)/;
    return rules.flatMap(([id, name, kind, pattern, description, role, allowNegative]) => {
      if (role === 'insurance' && !/保險|壽險/.test(job.title)) return [];
      const hits = clauses.filter(line => pattern.test(line.text) && (allowNegative || !negative.test(line.text))
        && (!['strength', 'experience'].includes(kind) || !/希望|想要|期望|打算|將來|計畫|規劃成為/.test(line.text)));
      return hits.length ? [{ id, name, kind, description, sources: [...new Set(hits.map(line => line.id))],
        schemaVersion: 2, resumeId: resume.id, jobUrl: job.url, origin: 'resume', engine: 'rules-v1', status: 'suggested' }] : [];
    });
  }
  const api = { analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CardifTalentTags = api;
})(typeof window === 'undefined' ? globalThis : window);
