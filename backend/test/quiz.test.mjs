import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { handleApi } from '../api.mjs';
import { score } from '../attempts.mjs';
import { loadBooks, loadEnvelopes, openDatabase } from '../local.mjs';
import { importBankKey, openBook } from '../bank-crypto.mjs';
import { catalog, resolvePage, testPath } from '../../frontend/src/catalog.mjs';

const books = await loadBooks();
const merchantKey = crypto.randomUUID();
const origin = 'https://quiz.example';

function client(db) {
  return async (path, { method = 'GET', body, token, cookie, from } = {}) => {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = 'Bearer ' + token;
    if (cookie) headers.cookie = cookie;
    if (from) headers.origin = from;
    const response = await handleApi(new Request(origin + '/api' + path, { method, headers, body: JSON.stringify(body) }), {
      db, books, merchantKey, clientIp: '127.0.0.1'
    });
    return {
      status: response.status, data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers
    };
  };
}

function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  return client(db);
}

const post = (body, cookie) => ({ method: 'POST', body, cookie });
const issue = (call, slug, orderRef) => call('/merchant/orders', { ...post({ slug, orderRef }), token: merchantKey });
const activate = (call, code, slug) => call('/redeem', post({ code, slug }));

test('public catalog matches the four private books and all 16 profiles are reachable', () => {
  const ids = new Set();
  for (const entry of catalog) {
    const book = books[entry.slug];
    assert.equal(book.questions.length, entry.count);
    assert.equal(Object.keys(book.profiles).length, 4);
    for (const q of book.questions) {
      assert.ok(!ids.has(q.id));
      ids.add(q.id);
      assert.deepEqual(q.options.map(o => o.id), ['a', 'b', 'c', 'd']);
      assert.deepEqual(new Set(q.options.map(o => o.profile)), new Set(Object.keys(book.profiles)));
    }
    for (const [profile, detail] of Object.entries(book.profiles)) {
      const answers = Object.fromEntries(book.questions.map(q => [q.id, q.options.find(o => o.profile === profile).id]));
      const result = score(book, answers);
      assert.equal(result.name, detail.name);
      assert.equal(result.distribution.find(r => r.selected).count, entry.count);
    }
  }
  assert.equal(ids.size, 120);
});

test('each theme has distinct top-level HTML links for redemption, questions and results', () => {
  const paths = new Set();
  for (const book of catalog) {
    for (const stage of ['detail', 'quiz', 'result']) {
      const path = testPath(book.slug, stage);
      assert.match(path, /^\/[a-z-]+\.html$/);
      assert.equal(resolvePage(path).book.slug, book.slug);
      assert.equal(resolvePage(path).page, stage);
      paths.add(path);
    }
  }
  assert.equal(paths.size, 12);
  assert.equal(resolvePage('/unknown.html').page, 'missing');
});

test('encrypted banks reject a different key, a changed ciphertext and a different theme', async () => {
  const envelope = loadEnvelopes().history;
  const key = await importBankKey(process.env.QUIZ_BANK_KEY);
  const wrong = await importBankKey(crypto.randomUUID().replaceAll('-', '').repeat(2));
  await assert.rejects(openBook(envelope, 'history', wrong));
  const changed = { ...envelope, ciphertext: (envelope.ciphertext[0] === 'A' ? 'B' : 'A') + envelope.ciphertext.slice(1) };
  await assert.rejects(openBook(changed, 'history', key));
  await assert.rejects(openBook(envelope, 'social', key));
  await assert.rejects(importBankKey(''));
});

test('tied scores use question order even if answers are supplied in reverse order', () => {
  const book = books.history;
  const [first, second] = Object.keys(book.profiles);
  const ordered = book.questions.map((q, i) => [q.id, q.options.find(o => o.profile === (i % 2 ? first : second)).id]);
  assert.equal(score(book, Object.fromEntries(ordered.reverse())).name, book.profiles[second].name);
});

test('merchant authentication, idempotent issuance, and theme-scoped redemption', async t => {
  const call = fixture(t);
  assert.equal((await call('/merchant/orders', post({ slug: 'history', orderRef: 'order-1' }))).status, 401);
  const [a, b] = await Promise.all([issue(call, 'history', 'order-1'), issue(call, 'history', 'order-1')]);
  assert.equal(a.status, 200);
  assert.deepEqual(a.data, b.data);
  assert.equal(a.data.path, '/lishirenwu.html');
  assert.notEqual((await issue(call, 'social', 'order-1')).data.code, a.data.code);
  assert.equal((await activate(call, '9900', 'history')).status, 400);
  assert.equal((await activate(call, a.data.code, 'social')).status, 400);
  const redeemed = await activate(call, a.data.code.toLowerCase().replaceAll('-', ' '), 'history');
  assert.match(redeemed.headers.get('set-cookie'), /HttpOnly.*Secure/);
  assert.equal((await call('/tests/history/state', { cookie: redeemed.cookie })).data.unlocked, true);
  assert.equal((await call('/tests/social/state', { cookie: redeemed.cookie })).data.unlocked, false);
  assert.equal((await call('/tests/social/attempts', post({}, redeemed.cookie))).status, 403);
  assert.deepEqual((await call('/library')).data.entries, {});
});

test('progress survives reload, incomplete answers are rejected, and completed results survive retakes', async t => {
  const call = fixture(t);
  const { data: pass } = await issue(call, 'history', 'order-2');
  const { cookie } = await activate(call, pass.code);
  const root = '/tests/history/attempts';
  const [first, retry] = await Promise.all([call(root, post({}, cookie)), call(root, post({}, cookie))]);
  assert.equal(first.data.id, retry.data.id);
  const path = root + '/' + first.data.id;
  const draft = (await call(path, { cookie })).data;
  assert.equal(draft.questions.length, 30);
  assert.deepEqual(Object.keys(draft.questions[0].options[0]).sort(), ['id', 'text']);
  assert.equal((await call(path + '/finish', post({ revision: 0 }, cookie))).status, 409);
  assert.equal((await call(path + '/result', { cookie })).status, 409);
  const save = (questionId, optionId, revision) => call(path + '/answers', { method: 'PUT', body: { questionId, optionId, revision }, cookie });
  assert.equal((await save('h02', 'a', 0)).status, 400);
  assert.equal((await save('h01', 'z', 0)).status, 400);
  assert.equal((await save('h01', 'b', 0)).data.revision, 1);
  assert.equal((await save('h01', 'b', 0)).data.revision, 1);
  assert.equal((await save('h01', 'c', 0)).status, 409);
  assert.deepEqual((await call(path, { cookie })).data.answers, { h01: 'b' });
  assert.equal((await call('/library', { cookie })).data.entries.history.open.answered, 1);
  let revision = 1;
  const expectedProfile = Object.keys(books.history.profiles)[0];
  for (const question of books.history.questions) {
    const selected = question.options.find(o => o.profile === expectedProfile);
    const saved = await save(question.id, selected.id, revision);
    assert.equal(saved.status, 200);
    revision = saved.data.revision;
  }
  assert.equal((await call(path + '/finish', post({ revision: revision - 1 }, cookie))).status, 409);
  assert.equal((await call(path + '/finish', post({ revision }, cookie))).status, 200);
  assert.equal((await call(path + '/finish', post({ revision }, cookie))).status, 200);
  const complete = (await call(path + '/result', { cookie })).data;
  assert.equal(complete.result.name, books.history.profiles[expectedProfile].name);
  assert.equal(complete.result.count, 30);
  assert.equal((await save('h01', 'b', revision)).status, 409);
  assert.notEqual((await call(root, post({}, cookie))).data.id, first.data.id);
  assert.deepEqual((await call(path + '/result', { cookie })).data, complete);
});

test('only the owning pass can read a draft or result; reactivation transfers the session; revocation closes access', async t => {
  const call = fixture(t);
  const [one, two] = await Promise.all([issue(call, 'travel', 'T1'), issue(call, 'travel', 'T2')]);
  const first = await activate(call, one.data.code);
  const second = await activate(call, two.data.code);
  const { data: draft } = await call('/tests/travel/attempts', post({}, first.cookie));
  const path = '/tests/travel/attempts/' + draft.id;
  assert.equal((await call(path)).status, 403);
  assert.equal((await call(path, { cookie: second.cookie })).status, 404);
  assert.equal((await call(path + '/result', { cookie: second.cookie })).status, 404);
  const replacement = await activate(call, one.data.code);
  assert.equal((await call(path, { cookie: first.cookie })).status, 403);
  assert.equal((await call(path, { cookie: replacement.cookie })).status, 200);
  const revoked = await call('/merchant/revoke', { ...post({ slug: 'travel', orderRef: 'T1' }), token: merchantKey });
  assert.equal(revoked.status, 200);
  assert.equal((await call(path, { cookie: replacement.cookie })).status, 403);
  assert.equal((await activate(call, one.data.code)).status, 400);
  assert.equal((await issue(call, 'travel', 'T1')).status, 409);
});

test('cross-origin writes are refused and invalid attempts receive a bounded cooldown', async t => {
  const call = fixture(t);
  assert.equal((await call('/redeem', { ...post({ code: 'wrong' }), from: 'https://other.example' })).status, 403);
  for (let i = 0; i < 20; i++) assert.equal((await activate(call, 'wrong')).status, 400);
  const limited = await activate(call, 'wrong');
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('SQLite restart preserves signing material, saved answers and the session', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'wanxiang-quiz-test-'));
  const filename = join(directory, 'test.sqlite');
  let db = openDatabase(filename);
  t.after(() => {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) rmSync(filename + suffix, { force: true });
    rmdirSync(directory);
  });
  let call = client(db);
  const { data: pass } = await issue(call, 'creative', 'C1');
  const { cookie } = await activate(call, pass.code);
  const { data: draft } = await call('/tests/creative/attempts', post({}, cookie));
  const path = '/tests/creative/attempts/' + draft.id;
  const q = books.creative.questions[0];
  await call(path + '/answers', { method: 'PUT', body: { questionId: q.id, optionId: 'c', revision: 0 }, cookie });
  db.close();
  db = openDatabase(filename);
  call = client(db);
  assert.equal((await issue(call, 'creative', 'C1')).data.code, pass.code);
  assert.equal((await call(path, { cookie })).data.answers[q.id], 'c');
});
