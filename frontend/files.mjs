import { readdir, readFile } from 'node:fs/promises';

const mime = {
  html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', webp: 'image/webp', png: 'image/png', ico: 'image/x-icon'
};

// Only compiled public files enter this map. Neither server serves the project tree.
export async function publicFiles() {
  const files = {};
  async function readDirectory(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) {
        await readDirectory(new URL(entry.name + '/', directory), path + '/');
      } else if (entry.isFile()) {
        const type = mime[entry.name.split('.').pop()];
        if (!type) continue;
        const binary = type.startsWith('image/');
        const data = await readFile(new URL(entry.name, directory));
        files[path] = { type, binary, content: data.toString(binary ? 'base64' : 'utf8') };
      }
    }
  }
  await readDirectory(new URL('./dist/', import.meta.url), '/');
  return files;
}
