import { pageNames, testPath } from '../shared/links.mjs';

export function staticResponse(request, files) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const path = url.pathname;
  const oldPath = /^\/tests\/([a-z]+)(?:\/(quiz|result))?\/?$/.exec(path);
  if (oldPath && Object.hasOwn(pageNames, oldPath[1])) {
    url.pathname = testPath(oldPath[1], oldPath[2] || 'detail');
    return Response.redirect(url.href, 308);
  }
  if (!path.endsWith('/') && Object.hasOwn(files, path + '/index.html')) {
    url.pathname += '/';
    return Response.redirect(url.href, 308);
  }
  const filename = path.endsWith('/') ? path + 'index.html' : path;
  const found = Object.hasOwn(files, filename);
  const file = found ? files[filename] : files['/404.html'];
  const headers = {
    'Content-Type': file.type,
    'Cache-Control': found && path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; img-src 'self' data:"
  };
  const body = request.method === 'HEAD' ? null : file.binary ? Uint8Array.from(atob(file.content), c => c.charCodeAt(0)) : file.content;
  return new Response(body, { status: found ? 200 : 404, headers });
}
