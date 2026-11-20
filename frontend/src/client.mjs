import { testPath } from './catalog.mjs';

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api' + path, {
      method, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || '提交失败，请重试。');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw new Error('暂时连接不上服务器，请检查网络后重试。');
  } finally {
    clearTimeout(timer);
  }
}

export const attemptPath = (slug, page, id) => testPath(slug, page) + '?id=' + encodeURIComponent(id);
export const testApi = slug => '/tests/' + slug;

export async function startQuiz(slug) {
  const { id } = await api(testApi(slug) + '/attempts', { method: 'POST', body: {} });
  location.assign(attemptPath(slug, 'quiz', id));
}
