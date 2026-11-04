import { HttpError } from '@onebrief/atlas-bff-kit';

export function createTodoRoutes(store) {
  const browserUser = user => {
    if (user.kind === 'service') throw new HttpError(403, 'Read-only service credential');
    return user.id;
  };
  const todoId = value => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
      throw new HttpError(400, 'Invalid todo ID');
    return value;
  };
  return {
    'GET /api/todos': ({ user }) => store.list(browserUser(user)),
    'POST /api/todos': ({ user, body }) => {
      const ownerId = browserUser(user);
      if (typeof body?.title !== 'string' || !body.title.trim() || body.title.trim().length > 200)
        throw new HttpError(400, 'Enter a title between 1 and 200 characters');
      return store.add(ownerId, body.title.trim());
    },
    'PATCH /api/todos/:id': ({ user, params, body }) => {
      const ownerId = browserUser(user);
      if (typeof body?.completed !== 'boolean') throw new HttpError(400, 'completed must be a boolean');
      return store.complete(ownerId, todoId(params.id), body.completed);
    },
    'DELETE /api/todos/:id': ({ user, params }) => store.remove(browserUser(user), todoId(params.id)),
    'GET /api/v1/todos': async ({ user, query }) => {
      if (user.kind !== 'service') throw new HttpError(403, 'Service credential required');
      if (query.size) throw new HttpError(400, 'Query parameters are not supported');
      return { ownerId: user.id, todos: await store.list(user.id) };
    },
    'GET /api/ready': async () => {
      await store.ready();
      return { ok: true };
    },
  };
}
