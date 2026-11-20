import { HttpError, json, readJson, requireMethod } from './http.mjs';
import { currentPass, issuePass, orderReference, redeem, requireMerchant } from './passes.mjs';
import { finishAttempt, libraryEntry, ownedAttempt, readAttempt, saveAnswer, startAttempt } from './attempts.mjs';

function bookFor(books, slug) {
  if (typeof slug !== 'string' || !Object.hasOwn(books, slug)) throw new HttpError(404, '找不到这个主题。');
  return books[slug];
}

async function merchantOrder(request, ctx, revoke) {
  requireMethod(request, 'POST');
  await requireMerchant(request, ctx);
  const body = await readJson(request);
  bookFor(ctx.books, body.slug);
  const ref = orderReference(body.orderRef);
  if (revoke) {
    const row = await ctx.db.first('UPDATE passes SET revoked = 1, session_hash = NULL WHERE slug = ? AND order_ref = ? RETURNING id', body.slug, ref);
    if (!row) throw new HttpError(404, '该主题下没有这个订单。');
    return json({ revoked: true });
  }
  return json(await issuePass(ctx.db, body.slug, ref));
}

async function route(request, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) throw new HttpError(403, '请在测验网站内提交。');
  }
  if (path === '/api/health') {
    requireMethod(request, 'GET');
    await ctx.db.first('SELECT 1 FROM passes LIMIT 1');
    return json({ ok: true });
  }
  if (path === '/api/merchant/orders' || path === '/api/merchant/revoke') {
    return merchantOrder(request, ctx, path.endsWith('/revoke'));
  }
  if (path === '/api/redeem') {
    requireMethod(request, 'POST');
    const pass = await redeem(ctx, await readJson(request), url.protocol === 'https:');
    return json({ slug: pass.slug }, 200, { 'Set-Cookie': pass.cookie });
  }
  if (path === '/api/library') {
    requireMethod(request, 'GET');
    const entries = {};
    for (const slug of Object.keys(ctx.books)) {
      const pass = await currentPass(request, ctx.db, slug);
      if (pass) entries[slug] = await libraryEntry(ctx.db, pass.id);
    }
    return json({ entries });
  }

  const match = /^\/api\/tests\/([a-z]+)\/(state|attempts)(?:\/([a-f0-9-]{36})(?:\/(answers|finish|result))?)?$/.exec(path);
  if (!match) throw new HttpError(404, '接口不存在。');
  const [, slug, resource, id, action] = match;
  const book = bookFor(ctx.books, slug);
  const pass = await currentPass(request, ctx.db, slug);
  if (resource === 'state' && !id) {
    requireMethod(request, 'GET');
    return json(pass ? await libraryEntry(ctx.db, pass.id) : { unlocked: false });
  }
  if (resource !== 'attempts') throw new HttpError(404, '接口不存在。');
  if (!pass) throw new HttpError(403, '请先使用本主题的兑换码解锁。');
  if (!id) {
    requireMethod(request, 'POST');
    await readJson(request);
    return json(await startAttempt(ctx.db, pass.id));
  }
  const row = await ownedAttempt(ctx.db, pass.id, id);
  if (action === 'answers') {
    requireMethod(request, 'PUT');
    return json(await saveAnswer(ctx.db, row, book, await readJson(request)));
  }
  if (action === 'finish') {
    requireMethod(request, 'POST');
    return json(await finishAttempt(ctx.db, row, book, (await readJson(request)).revision));
  }
  requireMethod(request, 'GET');
  if (action === 'result') {
    if (!row.finished_at) throw new HttpError(409, '完成全部题目后即可查看结果。');
    return json({ id, finishedAt: row.finished_at, result: JSON.parse(row.result) });
  }
  return json(readAttempt(row, book));
}

export async function handleApi(request, ctx) {
  try {
    return await route(request, ctx);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status, error.headers);
    console.error('Quiz API error:', error.name, error.message);
    return json({ error: '暂时无法读取测验，请稍后重试。' }, 500);
  }
}
