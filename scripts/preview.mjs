import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('.preview', { recursive: true });
const source = await readFile('docs/example.md', 'utf8');
await build({ stdin: { resolveDir: process.cwd(), contents: `
  import MarkdownIt from 'markdown-it';
  import { enhanceNativeMath } from './src/native-math.ts';
  const source = ${JSON.stringify(source)};
  const bubble = document.querySelector('[data-message-text]');
  bubble.setAttribute('data-message-text', source);
  bubble.querySelector('.chat-text').innerHTML = new MarkdownIt({html:false,breaks:true}).render(source);
  enhanceNativeMath(bubble);
` }, outfile: '.preview/example.js', bundle: true, platform: 'browser', format: 'esm' });
await writeFile('.preview/index.html', `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Chat Math — public rendering example</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#121620;color:#e9edf5;font:17px/1.65 system-ui,sans-serif}
main{max-width:920px;margin:40px auto;padding:30px 40px;border:1px solid #303a4c;border-radius:20px;background:#1b2230}
header{border-bottom:1px solid #303a4c;padding-bottom:18px;margin-bottom:20px}h1{font-size:28px;margin:0 0 3px}
small{color:#abb8cf}.chat-text h2{font-size:18px;color:#9cc8ff;margin-top:25px}code{color:#a6d8c8}p{margin:10px 0}
math{font-family:math}footer{color:#abb8cf;font-size:13px;border-top:1px solid #303a4c;margin-top:28px;padding-top:15px}
</style>
<main><header><h1>Chat Math</h1><small>0.1.0-alpha.2 · Local KaTeX → MathML · No CDN or bundled fonts</small></header>
<article data-message-text><div class="chat-text"></div></article>
<footer>Public sample rendered by the plugin's actual DOM adapter. This standalone preview is not an OpenClaw screenshot.</footer></main>
<script type="module" src="./example.js"></script></html>`);
console.log('Preview ready: .preview/index.html');
