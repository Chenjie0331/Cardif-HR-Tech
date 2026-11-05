/* Adapted from 法巴人才匯-Demo login; browser-local prototype accounts only. */
(function (root) {
  'use strict';
  const USERS_KEY = 'cardif-demo-users-v2', SESSION_KEY = 'cardif-demo-session-v2';
  const roles = { hr: 'HR 人資', manager: '用人主管', employee: '內部員工', applicant: '外部應徵者' };
  const cleanEmail = value => String(value || '').trim().toLowerCase();
  const publicUser = user => user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
  function create(storage, crypto) {
    function users() {
      const records = JSON.parse(storage.getItem(USERS_KEY) || '[]');
      if (!Array.isArray(records) || records.length > 500 || records.some(user => !user || typeof user.email !== 'string' || typeof user.name !== 'string' || typeof user.salt !== 'string' || typeof user.hash !== 'string')) throw new Error('帳號資料無法讀取，請保留瀏覽器資料並稍後重試。');
      return records;
    }
    async function hash(password, salt) {
      if (!crypto?.subtle) throw new Error('請使用網站的 HTTPS 網址開啟登入功能。');
      const data = new TextEncoder().encode(`${salt}:${password}`);
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    async function account(name, email, role, password) {
      const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      return { id: `U-${email}`, name, email, role, salt, hash: await hash(password, salt), createdAt: new Date().toISOString() };
    }
    function user() {
      const email = storage.getItem(SESSION_KEY);
      return publicUser(users().find(record => cleanEmail(record.email) === email && record.role === 'hr'));
    }
    async function seed() {
      const records = users();
      let changed = false;
      for (const [name, email, role] of [['展示人資', 'demo@cardif.demo', 'hr']]) {
        if (records.some(record => cleanEmail(record.email) === email)) continue;
        records.push({ ...await account(name, email, role, 'Cardif123!'), demo: true }); changed = true;
      }
      if (changed) storage.setItem(USERS_KEY, JSON.stringify(records));
    }
    async function login(email, password) {
      const record = users().find(item => cleanEmail(item.email) === cleanEmail(email) && Object.hasOwn(roles, item.role));
      if (!record || await hash(password, record.salt) !== record.hash) throw new Error('帳號或密碼錯誤，請確認後再試。');
      if (record.role !== 'hr') throw new Error('目前僅開放 HR 人資登入，其他身分尚未開放。');
      storage.setItem(SESSION_KEY, cleanEmail(record.email));
      return publicUser(record);
    }
    async function register({ name, email, role, password, confirm }) {
      name = String(name || '').trim(); email = cleanEmail(email);
      if (name.length < 2 || name.length > 40) throw new Error('姓名請填寫 2 至 40 個字元。');
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('請填寫有效的電子郵件。');
      if (role !== 'hr') throw new Error('目前僅開放 HR 人資註冊，其他身分尚未開放。');
      if (typeof password !== 'string' || password.length < 6 || password.length > 128) throw new Error('密碼請設定 6 至 128 個字元。');
      if (password !== confirm) throw new Error('兩次輸入的密碼不一致。');
      const records = users();
      if (records.some(record => cleanEmail(record.email) === email)) throw new Error('這個電子郵件已註冊，請直接登入。');
      if (records.length >= 500) throw new Error('此瀏覽器的帳號數量已達上限。');
      const record = await account(name, email, role, password);
      const latest = users();
      if (latest.some(item => cleanEmail(item.email) === email)) throw new Error('這個電子郵件已註冊，請直接登入。');
      storage.setItem(USERS_KEY, JSON.stringify([...latest, record]));
      return publicUser(record);
    }
    return { seed, login, register, user, logout: () => storage.removeItem(SESSION_KEY) };
  }
  const api = { create, roles, USERS_KEY, SESSION_KEY, isPublicRoute: hash => ['', '#', '#home', '#main'].includes(hash) || /^#apply(?:\/|$)/.test(hash) };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardifAuth = api;
})(typeof window === 'object' ? window : globalThis);
