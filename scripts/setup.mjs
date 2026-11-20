import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

try {
  writeFileSync(new URL('../.env', import.meta.url), 'MERCHANT_KEY=' + randomBytes(32).toString('hex') + '\nQUIZ_BANK_KEY=\n', { flag: 'wx', mode: 0o600 });
  console.log('管理密钥已写入 .env。请从项目所有者的私密备份填写 QUIZ_BANK_KEY 后启动。');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('项目已存在 .env，请使用其中的管理密钥。');
}
