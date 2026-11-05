const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const A = require('../js/auth.js');
function fixture() {
  const records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
  return { records, storage, auth: A.create(storage, webcrypto) };
}
const registration = { name: '測試人資', email: 'hr@example.test', role: 'hr', password: 'Example123!', confirm: 'Example123!' };
test('demo accounts seed once, authenticate case-insensitively, restore and log out without deleting work', async () => {
  const { auth, records, storage } = fixture();
  await auth.seed(); const saved = records.get(A.USERS_KEY); await auth.seed();
  assert.equal(records.get(A.USERS_KEY), saved);
  const user = await auth.login(' DEMO@CARDIF.DEMO ', 'Cardif123!');
  assert.equal(user.role, 'hr'); assert.equal(user.hash, undefined); assert.equal(user.salt, undefined);
  assert.equal(A.create(storage, webcrypto).user().email, user.email);
  records.set('cardif-resume-notes-v1', 'existing notes'); auth.logout();
  assert.equal(auth.user(), null); assert.equal(records.get('cardif-resume-notes-v1'), 'existing notes');
  await assert.rejects(auth.login('demo@cardif.demo', 'wrong'), /帳號或密碼/);
  assert.equal(auth.user(), null);
});
test('registration needs no invitation and validates role, email and passwords; successful accounts can log in after reopening', async () => {
  const { auth, records, storage } = fixture();
  for (const patch of [{ role: 'employee' }, { role: 'manager' }, { role: 'applicant' }, { role: '__proto__' }, { email: 'invalid' }, { confirm: 'different' }, { password: '123' }, { name: 'A' }]) await assert.rejects(auth.register({ ...registration, ...patch }));
  assert.equal(records.size, 0);
  const user = await auth.register(registration);
  assert.equal(user.name, registration.name); assert.equal(auth.user(), null);
  assert.ok(!records.get(A.USERS_KEY).includes(registration.password));
  await assert.rejects(auth.register({ ...registration, email: 'HR@EXAMPLE.TEST' }), /已註冊/);
  assert.equal((await A.create(storage, webcrypto).login(registration.email, registration.password)).id, user.id);
});
test('malformed accounts and storage failures fail closed without overwriting records or reporting success', async () => {
  const { auth, records, storage } = fixture();
  records.set(A.USERS_KEY, '{broken'); await assert.rejects(auth.seed());
  assert.equal(records.get(A.USERS_KEY), '{broken');
  records.clear(); await auth.seed();
  storage.setItem = () => { throw new Error('storage blocked'); };
  await assert.rejects(auth.login('demo@cardif.demo', 'Cardif123!'), /storage blocked/);
  await assert.rejects(auth.register(registration), /storage blocked/);
  assert.equal(auth.user(), null);
});
test('home and application are public; only HR can restore a session or log in while all four roles remain defined', async () => {
  assert.deepEqual(Object.keys(A.roles), ['hr', 'manager', 'employee', 'applicant']);
  for (const hash of ['', '#home', '#main', '#apply/job', '#apply/1', '#apply/sent']) assert.equal(A.isPublicRoute(hash), true);
  for (const hash of ['#login', '#recruit', '#workspace/after', '#resume/1', '#apply-other', '#applyevil/job']) assert.equal(A.isPublicRoute(hash), false);
  const { auth, records } = fixture(); await auth.seed();
  const users = JSON.parse(records.get(A.USERS_KEY));
  for (const role of ['manager', 'employee', 'applicant']) {
    users[0].role = role;
    records.set(A.USERS_KEY, JSON.stringify(users)); records.set(A.SESSION_KEY, users[0].email);
    assert.equal(auth.user(), null);
    await assert.rejects(auth.login(users[0].email, 'Cardif123!'), /尚未開放/);
  }
});
