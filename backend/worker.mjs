import { handleApi } from './api.mjs';
import { unlockBooks } from './bank-crypto.mjs';
import { json } from './http.mjs';
import { staticResponse } from '../frontend/static.mjs';
import files from 'site:public-files';
import envelopes from 'site:encrypted-books';

let cachedSecret;
let opened;
function runtimeBooks(secret) {
  if (!opened || cachedSecret !== secret) {
    cachedSecret = secret;
    opened = unlockBooks(envelopes, secret);
  }
  return opened;
}

export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return staticResponse(request, files);
    const connection = env.DB.withSession ? env.DB.withSession('first-primary') : env.DB;
    function statement(sql, params) {
      const query = connection.prepare(sql);
      return params.length ? query.bind(...params) : query;
    }
    const db = {
      first: (sql, ...params) => statement(sql, params).first(),
      run: (sql, ...params) => statement(sql, params).run()
    };
    let books;
    try { books = await runtimeBooks(env.QUIZ_BANK_KEY); }
    catch { return json({ error: '题库暂时不可用，请联系管理员核对服务端配置。' }, 503); }
    return handleApi(request, { db, books, merchantKey: env.MERCHANT_KEY, clientIp: request.headers.get('CF-Connecting-IP') || 'unknown' });
  }
};
