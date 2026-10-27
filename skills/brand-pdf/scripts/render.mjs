#!/usr/bin/env node
// Copyright 2026 Compound Labs. All rights reserved.
import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HELP = `Usage: node render.mjs INPUT.html OUTPUT.pdf [options]

Render a trusted local HTML document with Playwright's bundled Chromium.
  --force                  Replace an existing output (default: refuse)
  --timeout MS             Readiness and PDF timeout; 1000-120000 (default: 30000)
  --expect-web-font NAME   Require a matching loaded @font-face; repeatable
  --allow-remote           Permit HTTP(S) assets (blocked by default)
  --allow-scripts          Execute document scripts (disabled by default)
  --help                   Print this help

Page size and margins come from @page CSS. Default fallback: Letter.
No personal browser/profile is used. No account or model API is required.
`;

function argumentsFor(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: 'boolean' },
      force: { type: 'boolean' },
      timeout: { type: 'string', default: '30000' },
      'expect-web-font': { type: 'string', multiple: true, default: [] },
      'allow-remote': { type: 'boolean' },
      'allow-scripts': { type: 'boolean' },
    },
  });
  if (values.help) return { help: true };
  if (positionals.length !== 2) throw new Error('Provide exactly INPUT.html and OUTPUT.pdf. Use --help for usage.');
  const timeout = Number(values.timeout);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000) throw new Error('--timeout must be an integer from 1000 to 120000 milliseconds.');
  const input = path.resolve(positionals[0]);
  const output = path.resolve(positionals[1]);
  if (!/\.html?$/i.test(input)) throw new Error('Input must be a local .html or .htm file.');
  if (!/\.pdf$/i.test(output)) throw new Error('Output must end in .pdf.');
  if (input === output) throw new Error('Input and output must be different files.');
  return { input, output, timeout, force: Boolean(values.force), remote: Boolean(values['allow-remote']), scripts: Boolean(values['allow-scripts']), fonts: values['expect-web-font'] };
}

function bounded(promise, timeout, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeout} ms.`)), timeout); }),
  ]).finally(() => clearTimeout(timer));
}

export async function render(options) {
  await access(options.input, constants.R_OK).catch(() => { throw new Error(`Cannot read input: ${options.input}`); });
  if (!options.force) {
    // The exclusive write below also protects against a file appearing during rendering.
    try { await access(options.output); throw new Error('Output already exists. Choose another path or pass --force.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw new Error('Playwright is not installed. Run npm ci in the brand-pdf skill directory, then npm run browser:install.'); }
  let browser;
  const failures = new Set();
  try {
    browser = await chromium.launch({ headless: true, timeout: options.timeout, args: ['--allow-file-access-from-files'] });
    const context = await browser.newContext({ javaScriptEnabled: options.scripts, serviceWorkers: 'block', viewport: { width: 816, height: 1056 } });
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeout);
    page.setDefaultNavigationTimeout(options.timeout);
    await page.route('**/*', async (route) => {
      const protocol = new URL(route.request().url()).protocol;
      if (['http:', 'https:'].includes(protocol) && !options.remote) {
        failures.add('An HTTP(S) asset was blocked. Use local assets, or pass --allow-remote for trusted remote assets.');
        await route.abort('blockedbyclient');
      } else if (['file:', 'data:', 'blob:', 'http:', 'https:'].includes(protocol)) await route.continue();
      else { failures.add(`Unsupported asset protocol: ${protocol}`); await route.abort('blockedbyclient'); }
    });
    page.on('requestfailed', (request) => {
      // Avoid leaking URL query strings, tokens, or local file contents in errors.
      failures.add(`Failed ${request.resourceType()} request (${request.failure()?.errorText ?? 'unknown error'}).`);
    });
    page.on('response', (response) => { if (response.status() >= 400) failures.add(`Asset returned HTTP ${response.status()}.`); });
    page.on('pageerror', () => failures.add('Document script raised an uncaught error.'));
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(options.input).href, { waitUntil: 'load' });
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';
      document.head.append(style);
    });
    const readiness = await bounded(page.evaluate(async (expectedFonts) => {
      document.querySelectorAll('img').forEach((image) => { image.loading = 'eager'; });
      await document.fonts.ready;
      const fontFailures = [];
      const normalize = (value) => value.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      for (const family of expectedFonts) {
        const matches = [...document.fonts].filter((font) => normalize(font.family) === normalize(family));
        if (!matches.length) { fontFailures.push(`Expected web font is not declared: ${family}`); continue; }
        for (const font of matches) {
          try { await font.load(); }
          catch { fontFailures.push(`Expected web font could not load: ${family}`); }
        }
      }
      const brokenImages = [];
      for (const image of document.images) {
        try { await image.decode(); }
        catch { brokenImages.push(image.alt || 'unlabelled image'); }
        if (!image.naturalWidth && !brokenImages.includes(image.alt || 'unlabelled image')) brokenImages.push(image.alt || 'unlabelled image');
      }
      const fonts = [...document.fonts].map((font) => ({ family: font.family, status: font.status }));
      for (const font of fonts) if (font.status === 'error') fontFailures.push(`Web font failed: ${font.family}`);
      // Fixed sheets must opt in to the page contract; arbitrary overflow in flowing
      // content is not a reliable estimate of printed pagination.
      const clippedSheets = [...document.querySelectorAll('.pdf-page, [data-pdf-page]')].flatMap((sheet, index) => {
        const outer = sheet.getBoundingClientRect();
        const overflow = sheet.scrollHeight > sheet.clientHeight + 1 || sheet.scrollWidth > sheet.clientWidth + 1;
        const escaped = [...sheet.querySelectorAll('*')].some((node) => {
          const style = getComputedStyle(node);
          if (style.position === 'fixed' || style.display === 'none' || style.visibility === 'hidden') return false;
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && (box.top < outer.top - 1 || box.left < outer.left - 1 || box.right > outer.right + 1 || box.bottom > outer.bottom + 1);
        });
        return overflow || escaped ? [index + 1] : [];
      });
      return { fonts, fontFailures, brokenImages, clippedSheets };
    }, options.fonts), options.timeout, 'Asset readiness');
    if (readiness.fontFailures.length) failures.add(readiness.fontFailures.join('; '));
    if (readiness.brokenImages.length) failures.add(`${readiness.brokenImages.length} image(s) could not decode.`);
    if (readiness.clippedSheets.length) failures.add(`Fixed page content exceeds its sheet: ${readiness.clippedSheets.join(', ')}. Repaginate instead of hiding the overflow.`);
    if (failures.size) throw new Error([...failures].join('\n'));
    const pdf = await bounded(page.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true, tagged: true, outline: true, timeout: options.timeout }), options.timeout, 'PDF rendering');
    if (pdf.length < 100 || pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Chromium returned an invalid PDF.');
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, pdf, { flag: options.force ? 'w' : 'wx' });
    return { output: options.output, bytes: pdf.length, webFonts: readiness.fonts };
  } catch (error) {
    if (/Executable doesn't exist|browserType.launch.*executable/i.test(error.message)) throw new Error('Bundled Chromium is missing. Run npm run browser:install in the brand-pdf skill directory.');
    throw error;
  } finally { await browser?.close(); }
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const options = argumentsFor(argv);
    if (options.help) { process.stdout.write(HELP); return; }
    const result = await render(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) { process.stderr.write(`brand-pdf: ${error.message}\n`); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
