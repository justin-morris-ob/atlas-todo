import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { HttpError } from '@onebrief/atlas-bff-kit';

export function connectDatabase(connectionString) {
  if (!connectionString) throw new Error('TODO_DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000, statement_timeout: 5000 });
  pool.on('error', () => console.error('[hello-todo] Database connection lost'));
  return pool;
}

export function createTodoStore(pool) {
  const columns = 'id, title, completed';
  return {
    ready: () => pool.query('SELECT id FROM hello_todo.todos LIMIT 0'),
    async list(ownerId) {
      return (await pool.query(`SELECT ${columns} FROM hello_todo.todos WHERE owner_id = $1 ORDER BY position LIMIT 100`, [ownerId])).rows;
    },
    async add(ownerId, title) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerId]);
        const { rows } = await client.query('SELECT count(*)::int AS count FROM hello_todo.todos WHERE owner_id = $1', [ownerId]);
        if (rows[0].count >= 100) throw new HttpError(409, 'This demo supports up to 100 todos');
        const result = await client.query(`INSERT INTO hello_todo.todos (id, owner_id, title) VALUES ($1, $2, $3) RETURNING ${columns}`, [randomUUID(), ownerId, title]);
        await client.query('COMMIT');
        return result.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async complete(ownerId, id, completed) {
      const { rows } = await pool.query(`UPDATE hello_todo.todos SET completed = $3 WHERE owner_id = $1 AND id = $2 RETURNING ${columns}`, [ownerId, id, completed]);
      if (!rows.length) throw new HttpError(404, 'Todo not found');
      return rows[0];
    },
    async remove(ownerId, id) {
      const result = await pool.query('DELETE FROM hello_todo.todos WHERE owner_id = $1 AND id = $2', [ownerId, id]);
      if (!result.rowCount) throw new HttpError(404, 'Todo not found');
    },
  };
}
