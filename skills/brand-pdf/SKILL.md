---
name: brand-pdf
description: Create PDF reports, proposals, letters, and statements that reuse an existing website's real typography, design tokens, and component patterns. Use when a document must match a brand; includes local HTML-to-PDF rendering and page-by-page verification.
---

# Brand PDF

Build the document from the brand's source materials, then inspect the actual
printed result. A successful render does not prove brand fidelity or pagination.
The same workflow works in Codex and Claude Code; no MCP connection is required.

## Establish the source

Identify the requested document, audience, paper size, source repository or
approved brand files, and output destination. Read repository instructions and
any existing brand pack before authoring. Use the actual token CSS, font files,
theme attributes, logo assets, and relevant component markup. Do not replace an
existing brand with the bundled sample or introduce covers, accents, credits, or
disclaimers the user did not request.

Reuse a local `BRAND.md` when present. Otherwise, record a compact brand pack in
the document project: authoritative source paths, required theme attributes,
fonts/weights, tokens, component classes, asset rights, and print exceptions.
See [brand packs](references/brand-packs.md) when creating one. Package only
assets the user is permitted to use; never copy private customer data into an
example or public package.

## Author for print

Use local HTML with relative asset paths. Import source tokens/fonts/components,
then add narrowly scoped print rules. Reuse the website's real table, title-row,
and metadata grammar; keep behavior and browser UI out of the printed document.
[Print mechanics](assets/print.css) supplies optional pagination helpers without
choosing a brand. [The fictional example](examples/report.html) demonstrates the
file layout, not a required visual style.

Choose pagination deliberately:

- **Flowing content:** let Chromium paginate, repeat table headings, avoid breaks
  inside short rows/figures, and use CSS page counters for real page numbers.
- **Fixed sheets:** use `.pdf-page` or `[data-pdf-page]`, explicit dimensions,
  and an intentional content split. The renderer rejects overflow from these
  boxes; do not hide or shrink content merely to make a check pass.

Read [print and verification](references/print-and-verify.md) for page geometry,
font checks, covers, running furniture, and common failure modes.

## Render locally

Run commands with the skill directory as the working directory. Resolve its
actual installed path; do not assume a home directory or plugin cache path.
The renderer reads the document and may execute trusted HTML scripts only when
explicitly enabled. Review unfamiliar HTML before rendering it.

```sh
npm ci
npm run browser:install
node scripts/render.mjs /absolute/path/report.html /absolute/path/report.pdf
```

Setup downloads Playwright's Chromium and npm dependencies. Use the existing
installation when available; do not install again for every document. Missing
browser libraries on Linux may need the platform's Playwright setup steps.

The renderer uses an isolated bundled Chromium, print CSS, background colors,
font/image readiness, and fixed-sheet overflow checks. It refuses existing
outputs unless `--force` is supplied. Local-only assets and disabled document
scripts are the default. Use `--allow-remote` or `--allow-scripts` only when the
specific document requires trusted resources or scripts, and report that choice.
Use `--expect-web-font "Family Name"` for required `@font-face` declarations.
No login, personal browser profile, model API, or publishing action is needed.

## Verify the deliverable

Inspect the PDF's page count, dimensions, extracted text, and embedded fonts
where tooling permits. Render every page to an image and visually inspect it
using the runtime's image-viewing tool. A PDF-reading tool that genuinely renders
each page is also suitable. Check loaded typefaces against the source, complete
text/rows, image quality, contrast, full-bleed edges where intended, running
furniture, page numbers, and unintended blank pages. Source HTML or a browser
screenshot alone cannot establish what the PDF printed.

Fix the source, rebuild, and repeat the affected checks. If visual inspection is
unavailable, say that the PDF is rendered but visually unverified; do not claim
it is ready to send. Keep source inputs and the requested final export; clean up
temporary page images. Return the requested PDF path and any material limitations.
Do not open a viewer or send the document externally unless that is part of the
user's request or the host's established delivery rules.
