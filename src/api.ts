import type { ObjectRef, Platform } from '@onebrief/atlas-sdk';
import { createTopic } from '@onebrief/atlas-ui';

import type { components } from './generated/api';

export type Todo = components['schemas']['Todo'];

export const listRef: ObjectRef = { appId: 'hello-todo', entityType: 'list', entityId: 'mine' };
export const changes = createTopic();
export const todos = {
  list: (platform: Platform) => platform.api<Todo[]>('hello-todo', '/todos'),
  add: (platform: Platform, title: string) => platform.api<Todo>('hello-todo', '/todos', {
    method: 'POST', body: JSON.stringify({ title }),
  }),
  complete: (platform: Platform, todo: Todo) => platform.api<Todo>('hello-todo', `/todos/${encodeURIComponent(todo.id)}`, {
    method: 'PATCH', body: JSON.stringify({ completed: !todo.completed }),
  }),
  remove: (platform: Platform, id: string) => platform.api<void>('hello-todo', `/todos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
