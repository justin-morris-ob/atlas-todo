import type { RegisterApp } from '@onebrief/atlas-sdk';
import { homeUpdates } from '@onebrief/atlas-contract-shell';
import { listRef } from './api';
import { HomeTodos } from './HomeTodos';
import { TodoPage } from './TodoPage';

const register: RegisterApp = registry => {
  registry.app({
    id: 'hello-todo',
    menu: async () => ({ views: [{ id: 'mine', label: 'My todos', icon: 'check', ref: listRef }], collections: [] }),
    quickActions: [{ id: 'open', label: 'Add a todo', run: platform => platform.open(listRef) }],
  });
  registry.page({ entityType: 'list', component: TodoPage });
  registry.contribute(homeUpdates, { key: 'todos', meta: { title: 'Hello Todo', seeAll: listRef }, component: HomeTodos });
};

export default register;
