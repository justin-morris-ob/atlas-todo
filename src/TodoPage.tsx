import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePlatform, type PageProps } from '@onebrief/atlas-sdk';
import { AsideSection, Badge, Block, Button, Empty, FeedPage, ListCard, Notice, PageHeader, Properties, Row, ViewBar, useResource } from '@onebrief/atlas-ui';
import { changes, listRef, todos } from './api';

export function TodoPage({ instanceId, visible }: PageProps) {
  const platform = usePlatform();
  const resource = useResource(() => todos.list(platform), [visible]);
  changes.useSubscription(resource.refresh);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string>();
  useEffect(() => platform.setTitle(instanceId, 'My todos'), [platform, instanceId]);
  const items = resource.data ?? [];
  const active = items.filter(todo => !todo.completed).length;
  const mutate = async (operation: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      changes.emit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your change');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    void mutate(async () => {
      await todos.add(platform, draft);
      setDraft('');
    });
  };
  const shown = items.filter(todo => filter === 'all' || todo.completed === (filter === 'completed'));
  return <FeedPage
    header={<PageHeader title="Hello, Atlas!" crumbs={['Hello Todo', platform.user.name]} meta={`${active} remaining`} actions={
      <Button onClick={() => platform.open(listRef, { beside: true })}>Open beside</Button>
    } />}
    notices={(error || resource.error) && <Notice tone="danger">{error ?? resource.error?.message} <Button onClick={() => void resource.refresh()}>Reload list</Button></Notice>}
    main={<>
      <Block name="composer" label="One small thing to do">
        <form onSubmit={add} className="stack">
          <label htmlFor={`${instanceId}-title`}>New todo</label>
          <input id={`${instanceId}-title`} className="input" value={draft} onChange={event => setDraft(event.target.value)} maxLength={200} placeholder="What would you like to do?" disabled={busy} />
          <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>Add todo</Button>
        </form>
      </Block>
      <Block name="content" label="My todos">
        <ViewBar tabs={[{ id: 'all', label: 'All', count: items.length }, { id: 'active', label: 'Active', count: active }, { id: 'completed', label: 'Completed', count: items.length - active }]} value={filter} onChange={setFilter} />
        {resource.loading && !resource.data ? <Empty>Loading todos…</Empty> : <ListCard>
          {shown.map(todo => <Row key={todo.id}
            leading={<input type="checkbox" aria-label={`Complete ${todo.title}`} checked={todo.completed} disabled={busy} onChange={() => void mutate(() => todos.complete(platform, todo))} />}
            title={todo.completed ? <s>{todo.title}</s> : todo.title}
            status={<Badge tone={todo.completed ? 'success' : 'secondary'}>{todo.completed ? 'Done' : 'To do'}</Badge>}
            action={<Button variant="quiet" aria-label={`Delete ${todo.title}`} disabled={busy} onClick={() => void mutate(() => todos.remove(platform, todo.id))}>Delete</Button>}
          />)}
          {!shown.length && <Empty>{filter === 'completed' ? 'Complete a todo to see it here.' : 'Nothing here. Add a todo above.'}</Empty>}
        </ListCard>}
      </Block>
    </>}
    aside={<AsideSection name="status" title="Your sandbox">
      <Properties items={[[ 'Storage', 'PostgreSQL' ], [ 'List', 'Personal to your session user' ]]} />
      <p>Todos survive page reloads and backend restarts. This is a local demo with name-only sign-in.</p>
      <p>Open beside to share the saved list while keeping a separate draft in each pane.</p>
    </AsideSection>}
  />;
}
