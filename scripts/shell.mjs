import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
const checkout = process.env.ATLAS_CHECKOUT;
if (!checkout) throw new Error('Set ATLAS_CHECKOUT to an installed Atlas checkout with the shell built.');
const shellDir = resolve(checkout, 'src/apps/shell');
const child = spawn(process.execPath, ['bff/server.mjs'], {
  cwd: shellDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
    PORT: '4710',
    ATLAS_SHELL_ORIGIN: 'http://localhost:4710',
    ATLAS_SHELL_INTERNAL_URL: 'http://localhost:4710',
    ATLAS_ENABLED_APPS: 'hello-todo',
    ATLAS_HELLO_TODO_URL: 'http://localhost:4711',
    ATLAS_HELLO_TODO_INTERNAL_URL: 'http://localhost:4711',
    ATLAS_SLOT_GRANTS: await readFile(resolve(shellDir, 'chart/slot-grants.json'), 'utf8'),
  },
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
