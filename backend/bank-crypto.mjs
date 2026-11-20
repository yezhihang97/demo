import { pageNames } from '../shared/links.mjs';

const encoder = new TextEncoder();
const bytesFromHex = hex => Uint8Array.from(hex.match(/../g), value => parseInt(value, 16));
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const toBase64 = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));

export async function importBankKey(value, usages = ['decrypt']) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error('请在服务端配置正式题库的 QUIZ_BANK_KEY。');
  }
  return crypto.subtle.importKey('raw', bytesFromHex(value), 'AES-GCM', false, usages);
}

function parameters(slug, iv) {
  return { name: 'AES-GCM', iv, additionalData: encoder.encode('wanxiang/quiz/v1/' + slug), tagLength: 128 };
}

export function validateBook(book, slug) {
  const fields = ['name', 'tagline', 'description', 'strength', 'tip'];
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const keys = Object.keys(book.profiles || {});
  const questions = book.questions;
  const validProfiles = keys.length === 4 && keys.every(key => {
    const profile = book.profiles[key];
    return profile && fields.every(field => text(profile[field])) && Array.isArray(profile.tags) && profile.tags.length > 0 && profile.tags.every(text);
  });
  const validQuestions = Array.isArray(questions) && questions.length > 0 && questions.length <= 100 &&
    new Set(questions.map(q => q.id)).size === questions.length && questions.every(q =>
      text(q.id) && text(q.prompt) && Array.isArray(q.options) && q.options.length === 4 &&
      new Set(q.options.map(o => o.id)).size === 4 && new Set(q.options.map(o => o.profile)).size === 4 &&
      q.options.every(o => /^[a-d]$/.test(o.id) && text(o.text) && keys.includes(o.profile))
    );
  if (book.slug !== slug || !Object.hasOwn(pageNames, slug) || !validProfiles || !validQuestions) {
    throw new Error('题库结构无效，请检查主题 ' + slug + ' 的题目与画像。');
  }
}

export async function sealBook(book, key) {
  validateBook(book, book.slug);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(parameters(book.slug, iv), key, encoder.encode(JSON.stringify(book)));
  return { version: 1, slug: book.slug, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}

export async function openBook(envelope, slug, key) {
  if (envelope.version !== 1 || envelope.slug !== slug) throw new Error('题库版本或主题标识不匹配。');
  try {
    const plaintext = await crypto.subtle.decrypt(parameters(slug, fromBase64(envelope.iv)), key, fromBase64(envelope.ciphertext));
    const book = JSON.parse(new TextDecoder().decode(plaintext));
    validateBook(book, slug);
    return book;
  } catch {
    throw new Error('无法打开 ' + slug + ' 题库，请核对服务端密钥和题库文件。');
  }
}

export async function unlockBooks(envelopes, secret) {
  const key = await importBankKey(secret);
  const entries = await Promise.all(Object.keys(pageNames).map(async slug => [slug, await openBook(envelopes[slug], slug, key)]));
  return Object.fromEntries(entries);
}
