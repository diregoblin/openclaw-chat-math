import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const staging = new URL('../.release/package/', import.meta.url);
await rm(new URL('../.release/', import.meta.url), { recursive: true, force: true });
await mkdir(staging, { recursive: true });
for (const file of ['dist', 'licenses', 'LICENSE', 'NOTICE', 'README.md', 'CHANGELOG.md', 'docs']) {
  await cp(new URL(file, root), new URL(file, staging), { recursive: true });
}
const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
delete metadata.devDependencies;
delete metadata.scripts;
delete metadata.openclaw.controlUi;
metadata.files = ['dist', 'licenses', 'LICENSE', 'NOTICE', 'README.md', 'CHANGELOG.md', 'docs', 'openclaw.plugin.json'];
await writeFile(new URL('package.json', staging), JSON.stringify(metadata, null, 2) + '\n');
await cp(new URL('openclaw.plugin.json', root), new URL('openclaw.plugin.json', staging));
execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', '..', '--json'],
  { cwd: staging, stdio: 'inherit', shell: false });
