import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildFrontend } from '../frontend/build.mjs';
import { publicFiles } from '../frontend/files.mjs';
import { loadEnvelopes } from '../backend/local.mjs';

await buildFrontend();
const files = await publicFiles();
await build({
  entryPoints: [fileURLToPath(new URL('../backend/worker.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/server/index.js', import.meta.url)),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', charset: 'utf8',
  plugins: [{
    name: 'quiz-data',
    setup(builder) {
      builder.onResolve({ filter: /^site:(public-files|encrypted-books)$/ }, args => ({ path: args.path, namespace: 'quiz-data' }));
      builder.onLoad({ filter: /.*/, namespace: 'quiz-data' }, args => ({
        contents: JSON.stringify(args.path === 'site:public-files' ? files : loadEnvelopes()), loader: 'json'
      }));
    }
  }]
});
const metadata = new URL('../dist/.openai/', import.meta.url);
await mkdir(metadata, { recursive: true });
await cp(new URL('../.openai/hosting.json', import.meta.url), new URL('hosting.json', metadata));
await cp(new URL('../drizzle/', import.meta.url), new URL('drizzle/', metadata), { recursive: true });
