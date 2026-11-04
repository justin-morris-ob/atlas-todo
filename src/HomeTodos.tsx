import { usePlatform } from '@onebrief/atlas-sdk';
import { Button, Empty, ListCard, Notice, Row, useResource } from '@onebrief/atlas-ui';
import { changes, listRef, todos } from './api';

export function HomeTodos() {
  const platform = usePlatform();
  const resource = useResource(() => todos.list(platform), []);
  changes.useSubscription(resource.refresh);
  if (resource.error) return <Notice tone="danger">Could not load todos. <Button onClick={() => void resource.refresh()}>Retry</Button></Notice>;
  if (!resource.data) return <Empty>Loading todos…</Empty>;
  const active = resource.data.filter(todo => !todo.completed);
  return <ListCard>
    {active.slice(0, 3).map(todo => <Row key={todo.id} title={todo.title} meta="To do" onClick={() => platform.open(listRef)} />)}
    {!active.length && <Empty>All done. Add your next todo.</Empty>}
    <Button onClick={() => platform.open(listRef)}>Open my todos ({active.length})</Button>
  </ListCard>;
}
