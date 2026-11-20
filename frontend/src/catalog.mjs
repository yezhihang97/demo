import { testPath } from '../../shared/links.mjs';
export { testPath };

export const catalog = [
  {
    slug: 'history', name: '历史人物', group: '人文性格', title: '你最像哪位历史人物？',
    intro: '从处事与交友的小细节里，寻找你的古代知己。',
    detail: '一场被雨打乱的聚会，一个临时起意的周末。你处理小事的方式，也许藏着与某位古人的默契。',
    alt: '朱红日轮前的古代文人木刻肖像', count: 30, minutes: 8
  },
  {
    slug: 'social', name: '社交动物', group: '人际相处', title: '你的社交动物是什么？',
    intro: '在人群里，发现你和朋友相处的独特节奏。',
    detail: '走进有点陌生的聚会，接住朋友的一句心事。看看你习惯怎样靠近别人，哪一种动物最像人群里的你。',
    alt: '深青色花叶间回望的狐狸版画', count: 30, minutes: 8
  },
  {
    slug: 'travel', name: '旅行风格', group: '生活方式', title: '你的旅行风格是哪一种？',
    intro: '把目的地交给直觉，看你会走上哪条路。',
    detail: '留出一段空白行程，来到一座陌生小城。你会怎样安排这段只属于自己的时间？',
    alt: '徒步者走向群青山峰与金色日出的版画', count: 30, minutes: 8
  },
  {
    slug: 'creative', name: '创作灵感', group: '生活方式', title: '你的创作灵感从哪里来？',
    intro: '从第一笔到成形，寻找点亮你灵感的瞬间。',
    detail: '面对一张空白的纸、一件旧物或一段偶遇，什么会让你动手？顺着你的选择，找出最自然的创作起点。',
    alt: '珊瑚粉色天空下笔尖迸出星光的版画', count: 30, minutes: 8
  }
];

export const sections = { '/': 'home', '/redeem/': 'redeem', '/library/': 'library', '/manage/': 'manage' };
export const cover = slug => '/art/' + slug + '.webp';

export function resolvePage(pathname) {
  const path = pathname.replace(/\/index\.html$/, '/');
  if (Object.hasOwn(sections, path)) return { page: sections[path] };
  for (const book of catalog) {
    for (const page of ['detail', 'quiz', 'result']) {
      if (path === testPath(book.slug, page)) return { page, book };
    }
  }
  return { page: 'missing' };
}
