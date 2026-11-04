export async function fetchAtlasTodos({ baseUrl, token, signal }) {
  if (!token || token.length < 32) throw new Error('A server-side BC read token is required');
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash) throw new Error('Use a base URL without credentials, query or fragment');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    throw new Error('HTTPS is required outside loopback');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/api/v1/todos`;
  const timeout = AbortSignal.timeout(5000);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout, redirect: 'error',
  });
  if (!response.ok) throw new Error(`Atlas todos request failed: HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data?.ownerId !== 'string' || !Array.isArray(data.todos) || data.todos.length > 100 || data.todos.some(todo =>
    typeof todo?.id !== 'string' || typeof todo.title !== 'string' || todo.title.length > 200 || typeof todo.completed !== 'boolean'))
    throw new Error('Atlas returned an invalid todo response');
  return data;
}
