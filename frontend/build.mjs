import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { catalog, testPath } from './src/catalog.mjs';

export async function buildFrontend() {
  await build({ configFile: fileURLToPath(new URL('./vite.config.mjs', import.meta.url)) });
  const out = new URL('./dist/', import.meta.url);
  const shell = await readFile(new URL('index.html', out), 'utf8');
  const pages = [
    ['/redeem/', '兑换测验'], ['/library/', '我的测验'], ['/manage/', '兑换码管理']
  ];
  for (const item of catalog) {
    pages.push([testPath(item.slug), item.title], [testPath(item.slug, 'quiz'), item.name + ' · 答题'], [testPath(item.slug, 'result'), item.name + ' · 结果']);
  }
  for (const [path, title] of pages) {
    const target = new URL(path.slice(1) + (path.endsWith('/') ? 'index.html' : ''), out);
    await mkdir(new URL('./', target), { recursive: true });
    const html = shell.replace('<title>万象测验馆</title>', '<title>' + title + ' · 万象测验馆</title>');
    await writeFile(target, html);
  }
  await writeFile(new URL('404.html', out), shell.replace('<title>万象测验馆', '<title>页面未找到 · 万象测验馆'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildFrontend();
