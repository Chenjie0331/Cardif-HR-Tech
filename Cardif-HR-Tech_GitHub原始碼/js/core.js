(function (root) {
  'use strict';
  // shortcut: 使用虛構資料的固定關鍵字與測試月份，接入真實履歷時需重新校準判讀規則。
  const levels = { 學士: 1, 碩士: 2, 博士: 3 };
  const business = /保險|企業管理|企管|財務|金融|會計|經濟|商|國貿|行銷|風險管理/;
  const tagRules = [
    ['insurance', '壽險經驗', /人壽|壽險|保單|MDRT/],
    ['channel', '銀行通路', /銀行|分行|理專|理財專員/],
    ['presentation', '說明會經驗', /說明會|主講|主持/],
    ['training', '教育訓練', /教育訓練|新人課程|助教/],
    ['performance', '業績成果', /達成率|業績|MDRT|前三名/],
    ['data', '數據追蹤', /數據|樞紐|月報|退件率/],
    ['process', '流程改善', /SOP|行政|核保/],
    ['english', '英文能力', /TOEIC|英文/],
    ['transition', '跨業轉職', /轉職|新領域|跨入金融|跨入保險|轉入保險/],
    ['b2b', 'B2B 銷售', /B2B|企業客戶/]
  ];
  const displayText = text => String(text).replace(/[；;]/g, '，').replace(/，\s*$/, '。');
  function sentences(resume) {
    const parts = [];
    resume.experience.forEach((job, index) => {
      job.description.split(/(?<=[；。])/).filter(s => s.trim()).forEach((text, line) => {
        parts.push({ id: `e${index}-${line}`, text: text.trim(), section: '經歷' });
      });
    });
    resume.summary.split(/(?<=[。])/).filter(s => s.trim()).forEach((text, index) => {
      parts.push({ id: `s${index}`, text: text.trim(), section: '自傳' });
    });
    resume.skills.forEach((text, index) => parts.push({ id: `k${index}`, text, section: '技能' }));
    return parts;
  }
  function suggestTags(resume) {
    const source = sentences(resume);
    return tagRules.flatMap(([id, name, pattern]) => {
      const hits = source.filter(s => pattern.test(s.text) && !/無金融保險|無保險|未具備/.test(s.text));
      return hits.length ? [{ id, name, status: 'suggested', sources: hits.map(s => s.id) }] : [];
    });
  }
  function month(value) {
    const match = /^(\d{4})\/(\d{1,2})$/.exec(String(value).trim());
    if (!match || +match[2] < 1 || +match[2] > 12) return null;
    return +match[1] * 12 + +match[2] - 1;
  }
  function years(period, asOf) {
    const [from, to] = String(period).split(/[–—-]/);
    const start = month(from), end = /至今|現在/.test(to) ? month(asOf) : month(to);
    return start === null || end === null ? 0 : Math.max(0, end - start) / 12;
  }
  function insuranceExperience(resume, job) {
    return resume.experience.filter(e => !/實習/.test(e.title + e.company)
      && !/無保險|無金融保險/.test(e.description)
      && /人壽|保險|保單/.test(e.company + e.title + e.description))
      .map(e => ({ ...e, years: years(e.period, job.asOf) }));
  }
  function bestEvidence(resume, pattern) {
    const lines = [...resume.experience.flatMap(e => e.description.split(/[；。，]/)), ...resume.skills];
    let best = { value: 0, text: '履歷尚未列出相關經驗' };
    for (const text of lines) {
      if (!pattern.test(text)) continue;
      const value = /助教|未獨立/.test(text) ? .5 : /協助/.test(text) ? .25 : 1;
      if (value > best.value) best = { value, text: text.trim() };
    }
    return best;
  }
  function evaluate(resume, job) {
    const experience = insuranceExperience(resume, job);
    const totalYears = experience.reduce((sum, e) => sum + e.years, 0);
    const training = bestEvidence(resume, /說明會|教育訓練|主講|主持|授課/);
    const channel = bestEvidence(resume, /分行|理專|通路/);
    const degree = resume.education.some(e => levels[e.degree]);
    const major = resume.education.some(e => business.test(e.major));
    const management = resume.education.some(e => /管理/.test(e.major));
    const language = resume.skills.join('、') + resume.summary;
    const certificates = job.certs.filter(c => resume.certs.includes(c));
    const office = resume.skills.filter(s => /Excel|PowerPoint|Word/i.test(s));
    const raw = {
      A: [Math.min(1, Math.max(0, (totalYears - 1) / 2)), `保險相關工作 ${totalYears.toFixed(1)} 年；依 ${job.asOf} 計算`],
      B: [training.value, training.text],
      C: [channel.value, channel.text],
      D: [experience.length || resume.education.some(e => /保險/.test(e.major)) ? 1 : 0, experience.length ? '履歷列有保險相關工作' : resume.education.some(e => /保險/.test(e.major)) ? '保險科系背景' : '履歷尚未列出保險背景'],
      E: [degree ? (major ? 1 : management ? .5 : 0) : 0, resume.education.map(e => `${e.major}（${e.degree}）`).join('、')],
      F: [(/台語/.test(language) ? .5 : 0) + (/英文|TOEIC|多益/.test(language) ? .5 : 0), `台語：${/台語/.test(language) ? '有列出' : '未列出'}；英文：${/英文|TOEIC|多益/.test(language) ? '有列出' : '未列出'}`],
      G: [certificates.length / job.certs.length, `職缺列出的 ${job.certs.length} 張加分證照，履歷列有 ${certificates.length} 張`],
      H: [office.length ? 1 : 0, office.join('、') || '履歷未列出 Office 工具']
    };
    return job.criteria.map(c => ({ ...c, value: raw[c.key][0], evidence: raw[c.key][1] }));
  }
  function score(resume, job, weights) {
    const criteria = evaluate(resume, job);
    const total = criteria.reduce((sum, c) => sum + (weights[c.key] || 0), 0);
    if (!total) return null;
    return criteria.reduce((sum, c) => sum + c.value * (weights[c.key] || 0), 0) / total * 100;
  }
  function defaultWeights(job) { return Object.fromEntries(job.criteria.map(c => [c.key, c.weight])); }
  function ranked(resumes, job, weights) {
    return resumes.map(resume => ({ resume, score: score(resume, job, weights), criteria: evaluate(resume, job) }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.resume.id.localeCompare(b.resume.id));
  }
  function greeting(date) {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).format(date));
    return hour >= 5 && hour < 12 ? '早安' : hour >= 12 && hour < 18 ? '午安' : '晚安';
  }
  root.CardifCore = { displayText, sentences, suggestTags, years, evaluate, score, defaultWeights, ranked, greeting };
})(typeof window === 'undefined' ? globalThis : window);
