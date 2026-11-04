import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from '../bff/database.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const workspace = app;
const privateDir = new URL('../.local/hello-todo/', import.meta.url);
const configFile = new URL('config.json', privateDir);
const command = process.argv[2];
const run = (bin, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(bin, args, { cwd: workspace, env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}`, ...env }, stdio: 'inherit' });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); };
  child.once('error', error => { cleanup(); reject(error); });
  child.once('exit', (code, signal) => {
    cleanup();
    if (code === 0 || signal === 'SIGTERM' || signal === 'SIGINT' || code === 130 || code === 143) resolve();
    else reject(new Error(`Command failed (${code})`));
  });
});
await mkdir(privateDir, { recursive: true, mode: 0o700 });
let config;
try { config = JSON.parse(await readFile(configFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT' || command !== 'setup') throw error;
  const secret = () => randomBytes(32).toString('hex');
  config = { adminPassword: secret(), runtimePassword: secret(), readToken: secret(), ownerId: 'p-priya' };
  await writeFile(configFile, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
}
const dbUrl = (admin, test = false) => `postgresql://${admin ? 'postgres' : 'hello_todo_runtime'}:${admin ? config.adminPassword : config.runtimePassword}@127.0.0.1:55470/hello_todo${test ? '_test' : ''}`;
const runtimeEnv = { TODO_DATABASE_URL: dbUrl(false), TODO_BC_READ_TOKEN: config.readToken, TODO_BC_OWNER_ID: config.ownerId };
const compose = args => run('docker', ['compose', '-f', `${app}compose.yaml`, ...args], { TODO_POSTGRES_PASSWORD: config.adminPassword });

if (command === 'setup') {
  await compose(['up', '-d', '--wait', '--wait-timeout', '90']);
  const admin = connectDatabase(dbUrl(true));
  try {
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'hello_todo_runtime'")).rowCount) {
      const { rows } = await admin.query("SELECT format('CREATE ROLE hello_todo_runtime LOGIN PASSWORD %L', $1::text) AS statement", [config.runtimePassword]);
      await admin.query(rows[0].statement);
    }
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = 'hello_todo_test'")).rowCount)
      await admin.query('CREATE DATABASE hello_todo_test');
    await admin.query('REVOKE ALL ON DATABASE hello_todo FROM PUBLIC; GRANT CONNECT ON DATABASE hello_todo TO hello_todo_runtime');
    await admin.query('REVOKE ALL ON DATABASE hello_todo_test FROM PUBLIC; GRANT CONNECT ON DATABASE hello_todo_test TO hello_todo_runtime');
  } finally { await admin.end(); }
  for (const test of [false, true])
    await run(process.execPath, [`${app}scripts/migrate.mjs`], { TODO_MIGRATION_DATABASE_URL: dbUrl(true, test) });
  console.log('Postgres ready. Credentials retained privately in .local/hello-todo/config.json.');
} else if (command === 'start') {
  await run(process.execPath, ['bff/server.mjs'], { ...runtimeEnv, PORT: process.env.PORT ?? '4711', ATLAS_SHELL_ORIGIN: process.env.ATLAS_SHELL_ORIGIN ?? 'http://localhost:4710', ATLAS_SHELL_INTERNAL_URL: process.env.ATLAS_SHELL_INTERNAL_URL ?? 'http://localhost:4710' });
} else if (command === 'fetch') {
  await run(process.execPath, [`${app}examples/fetch-todos.mjs`], { TODO_BC_READ_TOKEN: config.readToken, ATLAS_TODO_BASE_URL: process.env.ATLAS_TODO_BASE_URL ?? 'http://localhost:4711' });
} else if (command === 'test') {
  await run(process.execPath, ['--test', `${app}bff/routes.test.mjs`], { TODO_TEST_DATABASE_URL: dbUrl(false, true) });
} else if (command === 'stop-db') {
  await compose(['stop']);
} else {
  throw new Error('Usage: node scripts/local.mjs setup|start|fetch|test|stop-db');
}
