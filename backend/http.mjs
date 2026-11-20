export class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

export async function readJson(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, '请使用 JSON 格式提交。');
  }
  const reader = request.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new HttpError(413, '提交内容过长。');
      }
      chunks.push(value);
    }
  }
  try {
    const value = JSON.parse(await new Blob(chunks).text());
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch { /* Return the same validation message for all malformed bodies. */ }
  throw new HttpError(400, '提交内容无效，请重试。');
}

export function requireMethod(request, method) {
  if (request.method !== method) throw new HttpError(405, '请求方式不正确。', { Allow: method });
}
