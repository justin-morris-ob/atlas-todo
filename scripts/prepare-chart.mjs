import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ref = process.env.ATLAS_CHART_REF;
const expected = process.env.ATLAS_CHART_SHA256;
const version = process.env.ATLAS_CHART_VERSION;
if (!version || !/^[0-9A-Za-z.+-]+$/.test(version)) throw new Error('Set ATLAS_CHART_VERSION to the approved chart version.');
if (!ref?.startsWith('oci://nexus.int.onebrief.tools/onebrief/atlas/') || !/^sha256:[a-f0-9]{64}$/.test(expected ?? '')) throw new Error('Set ATLAS_CHART_REF and ATLAS_CHART_SHA256 from an approved Atlas publication.');
const dir = await mkdtemp(join(tmpdir(), 'hello-todo-chart-'));
try {
  const pull = spawnSync('helm', ['pull', ref, '--version', version, '--destination', dir], { stdio: 'inherit' });
  if (pull.status !== 0) throw new Error('Atlas chart download failed');
  const files = (await readdir(dir)).filter(file => file.startsWith('atlas-app-') && file.endsWith('.tgz'));
  if (files.length !== 1) throw new Error('Expected one atlas-app library archive');
  const file = join(dir, files[0]);
  const actual = `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`;
  if (actual !== expected) throw new Error('Atlas chart checksum mismatch');
  const destination = new URL('../chart/charts/', import.meta.url);
  await mkdir(destination, { recursive: true });
  await copyFile(file, new URL(files[0], destination));
} finally { await rm(dir, { recursive: true, force: true }); }
