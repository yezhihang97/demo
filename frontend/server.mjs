import http from 'node:http';
import { isIP } from 'node:net';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { publicFiles } from './files.mjs';
import { staticResponse } from './static.mjs';

export async function startFrontend() {
  if (!existsSync(new URL('./dist/index.html', import.meta.url))) {
    const { buildFrontend } = await import('./build.mjs');
    await buildFrontend();
  }
  const files = await publicFiles();
  const host = process.env.FRONTEND_HOST || '127.0.0.1';
  const port = Number(process.env.FRONTEND_PORT || 4173);
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      // Only accept client IP metadata from an explicitly trusted upstream.
      const forwarded = req.headers['x-real-ip'];
      const ip = process.env.TRUST_PROXY === '1' && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : req.socket.remoteAddress;
      const upstream = http.request({
        hostname: process.env.API_HOST || '127.0.0.1', port: Number(process.env.BACKEND_PORT || 8787),
        path: req.url, method: req.method, headers: { ...req.headers, 'x-real-ip': ip }
      }, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      });
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: '暂时无法连接测验服务。' }));
      });
      req.pipe(upstream);
      return;
    }
    try {
      const origin = process.env.PUBLIC_ORIGIN || 'http://' + req.headers.host;
      const url = new URL(req.url, origin);
      if (url.origin !== new URL(origin).origin) { res.writeHead(400).end(); return; }
      const response = staticResponse(new Request(url, { method: req.method }), files);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(400).end(); }
  });
  return server.listen(port, host, () => console.log('Website http://' + host + ':' + server.address().port));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startFrontend();
