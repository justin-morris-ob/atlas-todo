import { readFile } from 'node:fs/promises';
import { connectDatabase } from '../bff/database.mjs';

if (!process.env.TODO_MIGRATION_DATABASE_URL) throw new Error('TODO_MIGRATION_DATABASE_URL is required');
const pool = connectDatabase(process.env.TODO_MIGRATION_DATABASE_URL);
const client = await pool.connect();
try {
  await client.query(await readFile(new URL('../migrations/001-todos.sql', import.meta.url), 'utf8'));
  console.log('Todo migration applied');
} finally {
  client.release();
  await pool.end();
}
