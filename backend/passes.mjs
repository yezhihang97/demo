import { HttpError } from './http.mjs';
import { testPath } from '../shared/links.mjs';

const encoder = new TextEncoder();
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));

async function deliveryKey(db) {
  let key = await db.first("SELECT value FROM service_keys WHERE name = 'delivery-v1'");
  if (!key) {
    await db.run("INSERT INTO service_keys (name, value) VALUES ('delivery-v1', ?) ON CONFLICT(name) DO NOTHING", randomToken());
    key = await db.first("SELECT value FROM service_keys WHERE name = 'delivery-v1'");
  }
  return crypto.subtle.importKey('raw', encoder.encode(key.value), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function codeFor(key, id) {
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(id)));
  return Array.from(bytes.slice(0, 16), byte => alphabet[byte & 31]).join('');
}

export function orderReference(value) {
  if (typeof value !== 'string' || !/^[\p{L}\p{N}_.:-]{1,80}$/u.test(value.trim())) {
    throw new HttpError(400, '订单编号可使用 1 至 80 个中英文字母、数字、短横线、点、冒号或下划线。');
  }
  return value.trim();
}

export async function issuePass(db, slug, orderRef) {
  const key = await deliveryKey(db);
  let row = await db.first('SELECT id, revoked FROM passes WHERE slug = ? AND order_ref = ?', slug, orderRef);
  if (!row) {
    const id = crypto.randomUUID();
    const hash = await digest(await codeFor(key, id));
    await db.run('INSERT INTO passes (id, slug, order_ref, code_hash) VALUES (?, ?, ?, ?) ON CONFLICT(slug, order_ref) DO NOTHING', id, slug, orderRef, hash);
    row = await db.first('SELECT id, revoked FROM passes WHERE slug = ? AND order_ref = ?', slug, orderRef);
  }
  if (row.revoked) throw new HttpError(409, '该订单的兑换码已经停用。');
  const code = await codeFor(key, row.id);
  return { slug, orderRef, code: code.match(/.{4}/g).join('-'), path: testPath(slug) };
}

export async function limitAttempts(db, action, ip, maximum) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = action + ':' + await digest(ip);
  await db.run('DELETE FROM rate_limits WHERE expires <= ?', now);
  const row = await db.first(
    'INSERT INTO rate_limits (bucket, hits, expires) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1 RETURNING hits, expires',
    bucket, now + 600
  );
  if (row.hits > maximum) throw new HttpError(429, '尝试次数较多，请稍后再试。', { 'Retry-After': String(Math.max(1, row.expires - now)) });
}

export async function requireMerchant(request, ctx) {
  if (!ctx.merchantKey || ctx.merchantKey.length < 32) throw new HttpError(503, '管理入口尚未配置，请在服务器设置管理密钥。');
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || await digest(auth.slice(7)) !== await digest(ctx.merchantKey)) {
    await limitAttempts(ctx.db, 'merchant', ctx.clientIp, 8);
    throw new HttpError(401, '管理密钥无效。');
  }
}

export async function redeem(ctx, body, secure) {
  await limitAttempts(ctx.db, 'redeem', ctx.clientIp, 20);
  const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[\s-]/g, '') : '';
  const mismatch = '兑换码无效、已停用或属于其他主题，请核对订单中的兑换码。';
  if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) throw new HttpError(400, mismatch);
  const slug = body.slug ?? null;
  if (slug !== null && (typeof slug !== 'string' || !Object.hasOwn(ctx.books, slug))) throw new HttpError(400, '请选择有效的测验主题。');
  const token = randomToken();
  const pass = await ctx.db.first(
    'UPDATE passes SET session_hash = ? WHERE code_hash = ? AND revoked = 0 AND (? IS NULL OR slug = ?) RETURNING slug',
    await digest(token), await digest(code), slug, slug
  );
  if (!pass) throw new HttpError(400, mismatch);
  const cookie = 'wx_' + pass.slug + '=' + token + '; Path=/api/; HttpOnly; SameSite=Lax; Max-Age=15552000' + (secure ? '; Secure' : '');
  return { slug: pass.slug, cookie };
}

export async function currentPass(request, db, slug) {
  const name = 'wx_' + slug + '=';
  const cookie = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(name));
  const token = cookie?.slice(name.length);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.first('SELECT id FROM passes WHERE slug = ? AND session_hash = ? AND revoked = 0', slug, await digest(token));
}
