import { fileURLToPath } from 'node:url';
import { createBff } from '@onebrief/atlas-bff-kit';
import { createAuthentication } from './auth.mjs';
import { connectDatabase, createTodoStore } from './database.mjs';
import { createTodoRoutes } from './routes.mjs';

const authenticate = createAuthentication({ readToken: process.env.TODO_BC_READ_TOKEN, ownerId: process.env.TODO_BC_OWNER_ID });
const pool = connectDatabase(process.env.TODO_DATABASE_URL);
const store = createTodoStore(pool);
try {
  await store.ready();
} catch {
  await pool.end();
  throw new Error('Todo database is unavailable or migrations have not been applied');
}
const server = createBff({
  name: 'hello-todo', port: Number(process.env.PORT ?? 8080),
  staticDir: fileURLToPath(new URL('../dist/', import.meta.url)),
  authenticate, routes: createTodoRoutes(store),
  publicRoutes: ['GET /api/ready'],
});
let closing = false;
const stop = () => {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  server.close(async () => { await pool.end(); clearTimeout(deadline); });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
