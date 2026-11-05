(function (root) {
  'use strict';
  // shortcut: 五份履歷的整理內容經人工核對，新增履歷或接入模型時需重新建立並驗證原文依據。
  const reviews = {
    R001: {
      summary: '從銀行理財銷售轉入壽險通路輔導，履歷同時列出分行經營、教育訓練與行政流程改善經驗。',
      points: [
        { text: '負責雙北 3 家銀行、18 間分行的通路經營與理專教育訓練。', source: 'e0-0', quote: '3 家合作銀行共 18 間分行' },
        { text: '每季自辦約 6 場商品說明會，每場約 20–40 人。', source: 'e0-1', quote: '每季自辦商品說明會約 6 場，每場 20–40 人' },
        { text: '建立新契約 SOP 時，本人負責哪些環節？退件率從 9% 降到 4% 的統計期間與改善做法是什麼？', source: 'e0-2', quote: '協助分行建立新契約行政 SOP' }
      ]
    },
    R002: {
      summary: '經驗以壽險個人銷售與保戶經營為主，正在尋求轉往通路經營的機會。',
      points: [
        { text: '以壽險個人銷售為主，累積經營約 180 位保戶。', source: 'e0-0', quote: '累積保戶約 180 位' },
        { text: '曾任新人課程助教 2 期，未獨立主講大型說明會。中小型說明會的規劃與主講各負責過哪些內容？', source: 'e0-2', quote: '擔任助教 2 期，但未獨立主講大型說明會' },
        { text: '希望從個人銷售轉往通路經營，準備如何和分行或業務夥伴合作？', source: 's1', quote: '希望從個人銷售轉往通路經營' }
      ]
    },
    R003: {
      summary: '具投信銀行通路與理專訓練經驗，履歷中的產品經驗主要來自基金，正規劃轉入保險領域。',
      points: [
        { text: '定期走訪銀行分行、為理專進行產品訓練，年度辦理約 30 場說明會。', source: 'e0-0', quote: '年度辦理說明會約 30 場' },
        { text: '工作內容包含月報與市場簡報製作。', source: 'e0-1', quote: '製作月報與市場簡報' },
        { text: '過往銷售產品以基金為主，沒有保險商品銷售經驗。會如何將基金通路的經驗運用到保險商品？', source: 'e0-2', quote: '無保險商品銷售經驗' },
        { text: '已規劃考取人身保險業務員與投資型保險證照，預計何時報考？目前的準備進度如何？', source: 's1', quote: '已規劃考取人身保險業務員與投資型保險證照' }
      ]
    },
    R004: {
      summary: '有保險行政與通路實習經驗，工作內容以文件、核保追蹤及活動支援為主。',
      points: [
        { text: '工作包含要保文件整理、核保進度追蹤與保戶服務。', source: 'e0-0', quote: '整理要保文件、追蹤核保進度與保戶服務' },
        { text: '曾協助說明會場務，實際負責哪些工作？是否參與教材準備或現場講解？', source: 'e0-1', quote: '偶爾協助說明會場務' },
        { text: '經歷以業務助理與通路實習為主。除了行政支援，是否曾直接參與壽險銷售或業務輔導？', source: 's0', quote: '有業務助理與通路實習經驗' }
      ]
    },
    R005: {
      summary: '具 B2B 軟體與企業客戶銷售經驗，曾主持產品說明會及訓練，正考慮跨入金融保險業。',
      points: [
        { text: '負責企業 ERP 銷售，年度業績 3,000 萬元，經常主持客戶產品說明會與教育訓練。', source: 'e0-0', quote: '常主持客戶產品說明會與教育訓練' },
        { text: '沒有金融保險背景與相關證照。跨入金融保險業前，打算如何熟悉保險商品與通路工作？', source: 's0', quote: '無金融保險背景與相關證照' },
        { text: '已表達考照意願，學習計畫與預定時程是什麼？', source: 's1', quote: '願意從頭考照' }
      ]
    }
  };
  function restoreNotes(value, ids) {
    const notes = Object.create(null);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return notes;
    for (const id of ids) {
      const note = Object.hasOwn(value, id) ? value[id] : null;
      if (note && typeof note.text === 'string' && note.text.length <= 2000
          && typeof note.updatedAt === 'string' && !Number.isNaN(Date.parse(note.updatedAt))) {
        notes[id] = { text: note.text, updatedAt: note.updatedAt };
      }
    }
    return notes;
  }
  function forResume(resume) {
    if (reviews[resume.id]) return reviews[resume.id];
    const points = resume.experience.map((job, index) => ({ text: job.description, quote: job.description, source: `job${index}` }));
    if (!points.length && resume.summary) points.push({ text: resume.summary.split('。')[0], quote: resume.summary.split('。')[0], source: 's0' });
    return { summary: '', points };
  }
  const api = { reviews, forResume, restoreNotes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CardifReview = api;
})(typeof window !== 'undefined' ? window : globalThis);
