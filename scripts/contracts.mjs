import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
const target = new URL('../src/generated/api.ts', import.meta.url);
const generated = astToString(await openapiTS(new URL('../api/openapi.json', import.meta.url)));
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== generated) throw new Error('Run pnpm contracts to regenerate API types.');
} else await writeFile(target, generated);
