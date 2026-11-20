import http from 'node:http';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { loadBooks, openDatabase } from './local.mjs';
import { handleApi } from './api.mjs';

export async function startBackend() {
  const books = await loadBooks();
  const db = openDatabase();
  const host = process.env.BACKEND_HOST || '127.0.0.1';
  const port = Number(process.env.BACKEND_PORT || 8787);
  const server = http.createServer(async (req, res) => {
    try {
      const base = process.env.PUBLIC_ORIGIN || 'http://' + req.headers.host;
      const url = new URL(req.url, base);
      if (url.origin !== new URL(base).origin) {
        res.writeHead(400).end();
        return;
      }
      const init = { method: req.method, headers: req.headers };
      if (req.method !== 'GET' && req.method !== 'HEAD') Object.assign(init, { body: Readable.toWeb(req), duplex: 'half' });
      const remote = req.socket.remoteAddress;
      const forwarded = req.headers['x-real-ip'];
      const localProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
      const clientIp = localProxy && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : remote;
      const response = await handleApi(new Request(url, init), { db, books, merchantKey: process.env.MERCHANT_KEY, clientIp });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(400).end();
    }
  });
  server.once('close', () => db.close());
  return server.listen(port, host, () => console.log('API http://' + host + ':' + server.address().port));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startBackend();
