(function (root) {
  'use strict';
  const key = 'cardif-online-applications-v1';
  const degrees = ['高中職', '專科', '學士', '碩士', '博士', '其他'];
  const text = (value, max) => typeof value === 'string' ? value.slice(0, max).trim() : '';
  const education = () => ({ school: '', major: '', degree: '', from: '', to: '', current: false });
  const experience = () => ({ company: '', title: '', from: '', to: '', current: false, description: '' });
  const blank = () => ({ name: '', email: '', phone: '', location: '', availability: '', contactTime: '', education: [education()], experience: [], skills: '', certs: '', summary: '' });
  function normalize(value) {
    const result = blank(), source = value && typeof value === 'object' ? value : {};
    for (const [name, max] of Object.entries({ name: 60, email: 254, phone: 40, location: 100, availability: 100, contactTime: 100, skills: 1200, certs: 1200, summary: 2000 })) result[name] = text(source[name], max);
    for (const type of ['education', 'experience']) {
      result[type] = (Array.isArray(source[type]) ? source[type] : result[type]).slice(0, 10).map(item => {
        const entry = type === 'education' ? education() : experience();
        for (const name of Object.keys(entry)) entry[name] = name === 'current' ? item?.[name] === true : text(item?.[name], name === 'description' ? 2000 : name === 'from' || name === 'to' ? 7 : 120);
        if (entry.current) entry.to = '';
        return entry;
      });
    }
    return result;
  }
  function validate(data, step = 3) {
    if (!data.name) return { field: 'name', message: '請填寫姓名。' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { field: 'email', message: '請填寫完整的 Email。' };
    if (!/^[\d+()\s-]+$/.test(data.phone) || data.phone.replace(/\D/g, '').length < 7 || data.phone.replace(/\D/g, '').length > 20) return { field: 'phone', message: '請填寫可聯絡的電話，包含區碼。' };
    if (step === 1) return null;
    if (!data.education.length) return { field: 'education', message: '請新增一筆學歷。' };
    const month = /^\d{4}-(0[1-9]|1[0-2])$/;
    for (const type of ['education', 'experience']) for (const [index, item] of data[type].entries()) {
      const required = type === 'education' ? ['school', 'degree'] : ['company', 'title', 'from', 'description'];
      for (const name of required) if (!item[name]) return { field: `${type}-${index}-${name}`, message: `請完成第 ${index + 1} 筆${type === 'education' ? '學歷' : '經歷'}的${({ school: '學校', degree: '學位', company: '公司或單位', title: '職稱或角色', from: '開始月份', description: '工作內容' })[name]}。` };
      if (type === 'education' && !degrees.includes(item.degree)) return { field: `${type}-${index}-degree`, message: '請選擇學位。' };
      if (item.from && !month.test(item.from)) return { field: `${type}-${index}-from`, message: '請確認開始月份。' };
      if (item.to && !month.test(item.to)) return { field: `${type}-${index}-to`, message: '請確認結束月份。' };
      if (type === 'experience' && !item.current && !item.to) return { field: `${type}-${index}-to`, message: '請填寫結束月份，仍在職請勾選「至今」。' };
      if (item.to && !item.from) return { field: `${type}-${index}-from`, message: '請填寫開始月份。' };
      if (item.from && item.to && item.from > item.to) return { field: `${type}-${index}-to`, message: '結束月份不能早於開始月份。' };
    }
    for (const name of ['skills', 'certs']) {
      const items = lines(data[name]);
      if (data[name].split(/\n/).filter(s => s.trim()).length > 30 || items.some(item => item.length > (name === 'skills' ? 60 : 120))) return { field: name, message: `${name === 'skills' ? '技能' : '證照'}最多填寫 30 項，每項不超過 ${name === 'skills' ? 60 : 120} 個字。` };
    }
    return null;
  }
  function initial() { return { version: 1, draft: { id: '', step: 1, data: blank() }, applications: [], receipt: null }; }
  const validId = id => typeof id === 'string' && /^A-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
  function restore(value) {
    const state = initial();
    if (!value || value.version !== 1) return state;
    const seen = new Set();
    for (const entry of Array.isArray(value.applications) ? value.applications.slice(0, 100) : []) {
      // Retire the requested test submission without changing other applicants or clearing browser storage.
      if (entry?.id === 'A-d45fcd3c-e0b9-4d3f-86d2-5a443454057b') continue;
      if (!entry || !validId(entry.id) || seen.has(entry.id) || entry.jobId !== '891k1' || typeof entry.submittedAt !== 'string' || Number.isNaN(Date.parse(entry.submittedAt))) continue;
      const data = normalize(entry.data);
      if (validate(data)) continue;
      state.applications.push({ id: entry.id, jobId: '891k1', submittedAt: entry.submittedAt, data }); seen.add(entry.id);
    }
    if (value.draft && !seen.has(value.draft.id)) state.draft = { id: validId(value.draft.id) ? value.draft.id : '', step: [1, 2, 3].includes(value.draft.step) ? value.draft.step : 1, data: normalize(value.draft.data) };
    if (seen.has(value.receipt)) state.receipt = value.receipt;
    return state;
  }
  const lines = value => value.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, 30);
  const period = item => [item.from.replace('-', '/'), item.current ? '至今' : item.to.replace('-', '/')].filter(Boolean).join('–');
  function toResume(entry, job) {
    const data = entry.data;
    return { id: entry.id, name: data.name, origin: 'online', submittedAt: entry.submittedAt,
      contact: Object.fromEntries(['location', 'phone', 'email', 'availability', 'contactTime'].map(name => [name, data[name]])),
      education: data.education.map(item => ({ school: item.school, major: item.major, degree: item.degree, period: period(item) })),
      experience: data.experience.map(item => ({ company: item.company, title: item.title, period: period(item), description: item.description })),
      skills: lines(data.skills), certs: lines(data.certs), summary: data.summary, targetJob: `${job.title}｜${job.url}` };
  }
  function submit(state, job, now) {
    const existing = state.applications.find(entry => entry.id === state.draft.id);
    if (existing) return { state: { ...state, draft: initial().draft, receipt: existing.id }, entry: existing };
    const data = normalize(state.draft.data), error = validate(data);
    if (error) throw new Error(error.message);
    if (!validId(state.draft.id)) throw new Error('填寫識別碼無法讀取，請重新開啟應徵入口。');
    if (state.applications.length >= 100) throw new Error('展示資料已達儲存上限。');
    if (job.url !== 'https://www.104.com.tw/job/891k1') throw new Error('找不到對應職缺。');
    const entry = { id: state.draft.id, jobId: '891k1', submittedAt: now.toISOString(), data };
    return { state: { version: 1, draft: initial().draft, applications: [...state.applications, entry], receipt: entry.id }, entry };
  }
  const api = { key, degrees, education, experience, blank, normalize, validate, initial, restore, toResume, submit };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardifIntake = api;
})(typeof window === 'object' ? window : globalThis);
