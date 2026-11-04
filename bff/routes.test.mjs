import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv';
import { createBff } from '@onebrief/atlas-bff-kit';
import { createAuthentication } from './auth.mjs';
import { connectDatabase, createTodoStore } from './database.mjs';
import { createTodoRoutes } from './routes.mjs';
import { fetchAtlasTodos } from '../examples/bc-client.mjs';

test('Postgres persists todos across backend restart and limits BC to its configured read-only list', async t => {
  const connectionString = process.env.TODO_TEST_DATABASE_URL;
  assert.ok(connectionString && new URL(connectionString).pathname.endsWith('_test'), 'Run scripts/local.mjs setup, then scripts/local.mjs test (requires a dedicated _test database)');
  const owner = `test-${randomUUID()}`;
  const other = `${owner}-other`;
  const token = 'test-only-bc-read-token-0000000000000000';
  const schema = JSON.parse(await readFile(new URL('../api/openapi.json', import.meta.url), 'utf8'));
  const validate = new Ajv().compile({ ...schema.components.schemas.TodoList, definitions: schema.components.schemas });
  const authenticate = createAuthentication({ readToken: token, ownerId: owner, sessionAuthenticate: async value => {
    if (value === 'alice') return { id: owner };
    if (value === 'bob') return { id: other };
    return null;
  } });
  let pool;
  let server;
  let origin;
  const start = async () => {
    pool = connectDatabase(connectionString);
    server = createBff({ name: 'todo-test', port: 0, routes: createTodoRoutes(createTodoStore(pool)), authenticate });
    await once(server, 'listening');
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  };
  await start();
  t.after(async () => {
    await pool.query('DELETE FROM hello_todo.todos WHERE owner_id = ANY($1)', [[owner, other]]);
    await stop();
  });
  const request = (path, { auth = 'alice', method = 'GET', body } = {}) => fetch(`${origin}${path}`, {
    method, headers: { authorization: auth ? `Bearer ${auth}` : '', 'content-type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  for (const auth of ['', 'wrong-token'])
    assert.equal((await request('/api/v1/todos', { auth })).status, 401);
  assert.equal((await request('/api/v1/todos')).status, 403);
  assert.equal((await request('/api/v1/todos?ownerId=bob', { auth: token })).status, 400);
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const path = method === 'POST' ? '/api/todos' : '/api/todos/00000000-0000-4000-8000-000000000001';
    assert.equal((await request(path, { method, auth: token, body: method === 'DELETE' ? undefined : { title: 'Forbidden', completed: true } })).status, 403);
  }
  for (const body of [null, {}, { title: ' ' }, { title: 42 }, { title: 'x'.repeat(201) }])
    assert.equal((await request('/api/todos', { method: 'POST', body })).status, 400);
  const createdResponse = await request('/api/todos', { method: 'POST', body: { title: "  Persist 'quoted' todo  " } });
  assert.equal(createdResponse.status, 200);
  const created = await createdResponse.json();
  assert.equal(created.title, "Persist 'quoted' todo");
  assert.equal((await request(`/api/todos/${created.id}`, { auth: 'bob', method: 'PATCH', body: { completed: true } })).status, 404);
  assert.equal((await request(`/api/todos/${created.id}`, { auth: 'bob', method: 'DELETE' })).status, 404);
  assert.equal((await request('/api/todos/not-a-uuid', { method: 'DELETE' })).status, 400);
  assert.equal((await request(`/api/todos/${created.id}`, { method: 'PATCH', body: { completed: 'yes' } })).status, 400);
  const completed = await request(`/api/todos/${created.id}`, { method: 'PATCH', body: { completed: true } });
  assert.equal((await completed.json()).completed, true);
  await request('/api/todos', { auth: 'bob', method: 'POST', body: { title: 'Private to Bob' } });
  const before = await fetchAtlasTodos({ baseUrl: origin, token });
  assert.equal(validate(before), true, JSON.stringify(validate.errors));
  assert.deepEqual(before, { ownerId: owner, todos: [{ ...created, completed: true }] });
  await stop();
  await start();
  assert.deepEqual(await fetchAtlasTodos({ baseUrl: origin, token }), before);
  await assert.rejects(pool.query('CREATE TABLE hello_todo.forbidden (id integer)'), { code: '42501' });
  await assert.rejects(pool.query('DROP TABLE hello_todo.todos'), { code: '42501' });
  await assert.rejects(pool.query('CREATE TABLE public.forbidden (id integer)'), { code: '42501' });
  assert.equal((await request(`/api/todos/${created.id}`, { method: 'DELETE' })).status, 204);
  assert.deepEqual((await fetchAtlasTodos({ baseUrl: origin, token })).todos, []);
  assert.equal((await request(`/api/todos/${created.id}`, { method: 'DELETE' })).status, 404);
  const requests = Array.from({ length: 105 }, (_, index) => request('/api/todos', { method: 'POST', body: { title: `Bounded todo ${index}` } }));
  const statuses = (await Promise.all(requests)).map(response => response.status);
  assert.equal(statuses.filter(status => status === 200).length, 100);
  assert.equal(statuses.filter(status => status === 409).length, 5);
  assert.equal((await fetchAtlasTodos({ baseUrl: origin, token })).todos.length, 100);
});

test('service authentication refuses missing or weak configuration', () => {
  assert.throws(() => createAuthentication({}), /TODO_BC_READ_TOKEN/);
  assert.throws(() => createAuthentication({ readToken: 'short', ownerId: 'p-priya' }), /TODO_BC_READ_TOKEN/);
  assert.throws(() => createAuthentication({ readToken: 'x'.repeat(32) }), /TODO_BC_OWNER_ID/);
});
