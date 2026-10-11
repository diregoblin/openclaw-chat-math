import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import MarkdownIt from 'markdown-it';

const window = new Window({ url: 'http://localhost/' });
Object.assign(globalThis, { window, document: window.document });
const result = await build({ stdin: { contents: 'export * from "./src/math.ts"; export * from "./src/native-math.ts"; export * from "./src/control-ui.ts";', resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'browser', write: false });
const { extractMarkdownMath, enhanceNativeMath, mountMathTranscript } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
const md = new MarkdownIt({ html: false, breaks: true });
const formula = String.raw`\hat w=\arg\min_{w\geq0,;\sum w=1}|S_{\text{train}}w-y|^2`;
function bubble(source) {
  const element = document.createElement('div');
  element.dataset.messageText = source;
  element.innerHTML = `<div class="chat-text">${md.render(source)}</div>`;
  return element;
}

test('the supplied equation renders from standard and pasted delimiters in native bubbles', () => {
  for (const source of [`\\[\n${formula}\n\\]`, `$$\n${formula}\n$$`, `[\n${formula}\n]`]) {
    const element = bubble(source);
    enhanceNativeMath(element);
    assert.equal(element.querySelectorAll('math').length, 1);
    assert.equal(element.querySelector('annotation')?.textContent.trim(), formula);
    assert.equal(element.dataset.messageText, source, 'host Markdown copy retains its source');
    enhanceNativeMath(element);
    assert.equal(element.querySelectorAll('math').length, 1, 'repeated scans do not duplicate math');
  }
});

test('inline math survives alongside prices, code and ordinary links', () => {
  const source = String.raw`Цена $5 to $10; формула \(x^2\) и $y^2$.` + ' `$z$` [ссылка](https://example.com)';
  const element = bubble(source);
  const code = element.querySelector('code')?.outerHTML;
  const link = element.querySelector('a')?.outerHTML;
  enhanceNativeMath(element);
  assert.equal(element.querySelectorAll('math').length, 2);
  assert.ok(element.textContent.includes('$5 to $10'));
  assert.equal(element.querySelector('code')?.outerHTML, code);
  assert.equal(element.querySelector('a')?.outerHTML, link);
});

test('arrays, fenced TeX, invalid commands and unfinished math remain native text', () => {
  for (const source of ['[\n1, 2, 3\n]', '```latex\n\\[x^2\\]\n```', String.raw`\[\notARealCommand{x}\]`, String.raw`\[\frac{a}{b}`]) {
    const element = bubble(source);
    const before = element.innerHTML;
    enhanceNativeMath(element);
    assert.equal(element.innerHTML, before);
  }
});

test('formula commands cannot enable scripts, CSS or external resources', () => {
  const element = bubble(String.raw`\[\href{javascript:alert(1)}{x}+\includegraphics{https://example.com/pixel}\]`);
  enhanceNativeMath(element);
  assert.equal(element.querySelector('a,img,script,style,iframe'), null);
});

test('protected code is not accepted as a pasted bare-bracket formula', () => {
  assert.equal(extractMarkdownMath('```\n[\n'+formula+'\n]\n```').fragments.length, 0);
});

test('long unmatched brackets stay literal and disjoint bracket blocks retain their scope', () => {
  const incomplete = '[\n'.repeat(48000);
  assert.deepEqual(extractMarkdownMath(incomplete), { source: incomplete, fragments: [] });
  const source = '[\n1, 2\n]\n\n  [\n'+formula+'\n  ]\n\n[\n'+formula+'\n]';
  const result = extractMarkdownMath(source);
  assert.equal(result.fragments.length, 2);
  assert.ok(result.source.startsWith('[\n1, 2\n]'));
});

test('native transcript integration mounts the host once and preserves normal file clicks', async () => {
  const container = document.createElement('main');
  const abort = new AbortController();
  let mounts = 0, unmounts = 0, clicks = 0;
  const element = bubble(`\\[${formula}\\]\n\n[File](/workspace/report.pdf)`);
  element.querySelector('a').addEventListener('click', () => clicks++);
  const handle = mountMathTranscript(container, { signal: abort.signal, presented: true,
    props: { sessionKey: 'agent:main:math-test', agentId: 'main' },
    mountDefault(native) { mounts++; native.append(element); return () => unmounts++; } });
  await window.happyDOM.waitUntilComplete();
  assert.equal(mounts, 1);
  assert.equal(element.querySelectorAll('math').length, 1);
  const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  element.querySelector('a').dispatchEvent(event);
  assert.equal(clicks, 1);
  assert.equal(event.defaultPrevented, false);
  handle.dispose();
  assert.equal(unmounts, 1);
  assert.equal(container.children.length, 0);
});
