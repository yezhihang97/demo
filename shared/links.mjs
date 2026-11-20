// Public delivery links are shared by the storefront pages and the issuing API.
export const pageNames = Object.freeze({
  history: 'lishirenwu',
  social: 'shejiaodongwu',
  travel: 'lvxingfengge',
  creative: 'chuangzuolinggan'
});

const suffix = { detail: '', quiz: '-dati', result: '-jieguo' };

export function testPath(slug, stage = 'detail') {
  if (!Object.hasOwn(pageNames, slug) || !Object.hasOwn(suffix, stage)) throw new Error('Unknown quiz page');
  return '/' + pageNames[slug] + suffix[stage] + '.html';
}
