import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

await rm('dist', { recursive: true, force: true });
await build({ entryPoints: ['src/index.ts'], outfile: 'dist/index.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node24',
  external: ['openclaw', 'openclaw/*', '@openclaw/*'], legalComments: 'eof' });
execFileSync(process.env.OPENCLAW_CLI || 'openclaw', ['plugins', 'build', '--root', process.cwd()],
  { stdio: 'inherit', shell: false });

// Collect the complete notices for the packages actually present in the browser
// bundle. Do not ship node_modules, host SDK code, or development-only packages.
const graph = await build({ entryPoints: ['src/control-ui.ts'], bundle: true,
  platform: 'browser', format: 'esm', write: false, metafile: true });
const packages = new Map();
for (const input of Object.keys(graph.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let root = dirname(input);
  while (root !== '.') {
    try {
      const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
      packages.set(`${metadata.name}@${metadata.version}`, { root, metadata });
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      root = dirname(root);
    }
  }
}
await rm('licenses', { recursive: true, force: true });
await mkdir('licenses', { recursive: true });
const index = ['# Bundled third-party notices', '', '| Package | License | Texts |', '| --- | --- | --- |'];
for (const [name, { root, metadata }] of [...packages].sort()) {
  const notices = (await readdir(root)).filter(file => /^(license|copying|notice)/i.test(file)).sort();
  if (!notices.length) throw new Error(`Missing license texts for ${name}`);
  const target = join('licenses', name.replaceAll('/', '__').replaceAll('@', '_'));
  await mkdir(target, { recursive: true });
  for (const file of notices) await cp(join(root, file), join(target, basename(file)));
  index.push(`| ${name} | ${metadata.license} | ${notices.map(file => `[${file}](${target.slice('licenses/'.length)}/${file})`).join(', ')} |`);
}
await writeFile('licenses/README.md', index.join('\n') + '\n');
