import { openDatabase } from './local.mjs';
import { pageNames } from '../shared/links.mjs';
import { issuePass, orderReference } from './passes.mjs';

const [slug, reference] = process.argv.slice(2);
if (!Object.hasOwn(pageNames, slug) || !reference) {
  console.error('用法：npm run issue -- <history|social|travel|creative> <已付款订单编号>');
  process.exitCode = 1;
} else {
  const db = openDatabase();
  try {
    const pass = await issuePass(db, slug, orderReference(reference));
    const origin = process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:' + (process.env.FRONTEND_PORT || 4173);
    console.log('测验链接 ' + new URL(pass.path, origin).href + '\n兑换码 ' + pass.code);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
