import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importBankKey, openBook, sealBook, validateBook } from '../backend/bank-crypto.mjs';
import { pageNames } from '../shared/links.mjs';

const [action, inputDirectory] = process.argv.slice(2);
if (!['pack', 'export'].includes(action) || (inputDirectory && action !== 'pack')) {
  throw new Error('使用 npm run bank:export 或 npm run bank:pack。');
}
const encrypted = fileURLToPath(new URL('../backend/content/', import.meta.url));
const workspace = fileURLToPath(new URL('../backend/content-work/', import.meta.url));
const key = await importBankKey(process.env.QUIZ_BANK_KEY, ['encrypt', 'decrypt']);
const writes = [];
for (const slug of Object.keys(pageNames)) {
  const target = resolve(encrypted, slug + '.enc.json');
  const plain = resolve(inputDirectory || workspace, slug + '.json');
  const existing = existsSync(target) ? await openBook(JSON.parse(await readFile(target, 'utf8')), slug, key) : null;
  if (action === 'pack') {
    const book = JSON.parse(await readFile(plain, 'utf8'));
    validateBook(book, slug);
    if (JSON.stringify(existing) === JSON.stringify(book)) continue;
    const sealed = await sealBook(book, key);
    await openBook(sealed, slug, key);
    writes.push([target, JSON.stringify(sealed, null, 2) + '\n']);
  } else {
    if (!existing) throw new Error('缺少加密题库 ' + slug);
    const output = JSON.stringify(existing, null, 2) + '\n';
    if (existsSync(plain)) {
      if (JSON.stringify(JSON.parse(await readFile(plain, 'utf8'))) === JSON.stringify(existing)) continue;
      throw new Error('编辑目录已有未保存的修改，请先保存 ' + slug + '。');
    }
    writes.push([plain, output]);
  }
}
await mkdir(action === 'export' ? workspace : encrypted, { recursive: true });
for (const [target, content] of writes) {
  const temporary = target + '.' + crypto.randomUUID() + '.tmp';
  await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
}
console.log(action === 'export' ? '已解密到 Git 忽略的 backend/content-work/。' : '已校验并保存加密题库。');
