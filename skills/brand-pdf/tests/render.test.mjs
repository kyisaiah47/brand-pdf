import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { PDFDocument } from 'pdf-lib';

const run = promisify(execFile);
const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts/render.mjs');
const doc = (body, style = '', head = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test document</title>${head}<style>@page { size: Letter; margin: .75in; } ${style}</style></head><body>${body}</body></html>`;
async function fixture(t) {
  const dir = await mkdtemp(path.join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), 'brand-pdf-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, input: path.join(dir, 'input.html'), output: path.join(dir, 'output.pdf') };
}
async function invoke(...args) { return run(process.execPath, [cli, ...args], { timeout: 60000 }); }
async function expectFailure(args, message) {
  await assert.rejects(invoke(...args), (error) => { assert.match(error.stderr, message); return true; });
}

test('fictional example produces exactly two complete Letter pages', async (t) => {
  const f = await fixture(t);
  const result = await invoke(path.join(skill, 'examples/report.html'), f.output);
  const receipt = JSON.parse(result.stdout);
  const bytes = await readFile(f.output);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  for (const page of pdf.getPages()) assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  assert.equal(receipt.bytes, bytes.length);
  assert.ok(bytes.length > 10000);
});

test('CSS A4 paper dimensions take precedence over Letter fallback', async (t) => {
  const f = await fixture(t);
  await writeFile(f.input, doc('<h1>A4 report</h1>', '@page { size: A4; margin: 20mm; }'));
  await invoke(f.input, f.output);
  const pdf = await PDFDocument.load(await readFile(f.output));
  assert.equal(pdf.getPageCount(), 1);
  const size = pdf.getPage(0).getSize();
  assert.ok(Math.abs(size.width - 595.28) < 1);
  assert.ok(Math.abs(size.height - 841.89) < 1);
});

test('fixed-sheet overflow fails without leaving a PDF', async (t) => {
  const f = await fixture(t);
  await writeFile(f.input, doc('<section class="pdf-page"><div style="height:1100px">Oversized content</div></section>', '.pdf-page { height:1056px; width:816px; overflow:hidden; }'));
  await expectFailure([f.input, f.output], /exceeds its sheet/);
  await assert.rejects(readFile(f.output), { code: 'ENOENT' });
});

test('missing local image fails instead of silently printing a broken icon', async (t) => {
  const f = await fixture(t);
  await writeFile(f.input, doc('<img src="missing.png" alt="Missing fixture">'));
  await expectFailure([f.input, f.output], /image|request/);
  await assert.rejects(readFile(f.output), { code: 'ENOENT' });
});

test('required web-font declaration cannot be satisfied by a system fallback', async (t) => {
  const f = await fixture(t);
  await writeFile(f.input, doc('<h1>Fallback alone is insufficient</h1>'));
  await expectFailure([f.input, f.output, '--expect-web-font', 'Undeclared Example Font'], /not declared/);
});

test('malformed declared web font fails', async (t) => {
  const f = await fixture(t);
  await writeFile(f.input, doc('<p>Required custom typeface</p>', '@font-face { font-family: "Broken Fixture"; src: url("data:font/woff2;base64,AAECAwQ=") format("woff2"); } body { font-family: "Broken Fixture", sans-serif; }'));
  await expectFailure([f.input, f.output, '--expect-web-font', 'Broken Fixture'], /font.*load|font failed/i);
});

test('existing output is preserved, including when rendering subsequently fails', async (t) => {
  const f = await fixture(t);
  const sentinel = Buffer.from('Do not replace this file');
  await writeFile(f.input, doc('<p>Replacement</p>'));
  await writeFile(f.output, sentinel);
  await expectFailure([f.input, f.output], /already exists/);
  assert.deepEqual(await readFile(f.output), sentinel);
  await writeFile(f.input, doc('<img src="not-here.png" alt="bad">'));
  await expectFailure([f.input, f.output, '--force'], /image|request/);
  assert.deepEqual(await readFile(f.output), sentinel);
});

test('explicit --force replaces a valid existing output after successful render', async (t) => {
  const f = await fixture(t);
  await writeFile(f.input, doc('<h1>Authorized replacement</h1>'));
  await writeFile(f.output, 'old output');
  await invoke(f.input, f.output, '--force');
  const pdf = await PDFDocument.load(await readFile(f.output));
  assert.equal(pdf.getPageCount(), 1);
});

test('document scripts are disabled unless explicitly enabled', async (t) => {
  const f = await fixture(t);
  await writeFile(f.input, doc('<section class="pdf-page">Static content<script>document.currentScript.parentElement.insertAdjacentHTML("beforeend", "<div style=height:2000px>Script-added overflow</div>")</script></section>', '.pdf-page { height:1056px; width:816px; overflow:hidden; }'));
  await invoke(f.input, f.output);
  await expectFailure([f.input, f.output, '--allow-scripts', '--force'], /exceeds its sheet/);
});

test('remote assets are blocked before a network request, and explicit opt-in works', async (t) => {
  const f = await fixture(t);
  let requests = 0;
  const server = createServer((req, res) => { requests += 1; res.setHeader('Content-Type', 'text/css'); res.end('body { color: #123456; }'); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/tokens.css`;
  await writeFile(f.input, doc('<h1>Remote token source</h1>', '', `<link rel="stylesheet" href="${url}">`));
  await expectFailure([f.input, f.output], /HTTP\(S\) asset was blocked/);
  assert.equal(requests, 0);
  await invoke(f.input, f.output, '--allow-remote');
  assert.equal(requests, 1);
  assert.equal((await PDFDocument.load(await readFile(f.output))).getPageCount(), 1);
});

test('paths containing spaces and shell metacharacters are passed as filenames', async (t) => {
  const f = await fixture(t);
  const input = path.join(f.dir, 'report $(never-run) & summary.html');
  const output = path.join(f.dir, 'report with spaces.pdf');
  await writeFile(input, doc('<h1>Literal filename</h1>'));
  await invoke(input, output);
  assert.equal((await PDFDocument.load(await readFile(output))).getPageCount(), 1);
});

test('help works without a browser launch; invalid arguments fail clearly', async () => {
  assert.match((await invoke('--help')).stdout, /Usage:/);
  await expectFailure([], /exactly INPUT/);
  await expectFailure(['input.html', 'output.pdf', '--timeout', '0'], /1000 to 120000/);
  await expectFailure(['input.html', 'output.png'], /end in .pdf/);
});
