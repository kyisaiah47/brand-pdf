# Print and verify

## Page geometry

Define paper size and margins in `@page`. The renderer uses `preferCSSPageSize`
and falls back to Letter only when the document does not specify a size.
The bundled fixed-sheet helper is Letter; for A4 or custom sizes, update both the
named `@page` rule and the sheet's width/height together. Keep the user-selected
paper size and do not silently scale a layout to make it fit.

Flowing reports work best with real page margins and native CSS margin boxes:

```css
@page {
  size: A4;
  margin: 20mm;
  @bottom-right { content: counter(page) ' / ' counter(pages); }
}
```

Do not hardcode page totals into DOM text. Avoid full-page `position: fixed`
backgrounds that paint over content on subsequent pages. A cover, when useful,
can use a named page with zero margins, while interior pages retain their margins.
Explicitly set margin-box `content: none` on pages that should have no furniture.

`break-inside: avoid` is for a short item, not an entire multi-page section.
An oversized table cell or unbreakable row still needs redesign. Check long URLs,
wide numeric columns, repeated headings, orphan headings, and the final page.

Fixed-sheet checks are a useful preflight, not a complete print-layout validator.
They catch scroll overflow and descendants escaping the sheet in print media.
They do not simulate every fragmentation decision, detect all overlaps, or judge
typography. Intentionally bleeding content needs a deliberate print layout
rather than bypassing clipping checks with `overflow: hidden`.

## Rendering and assets

The renderer waits for fonts and image decode, then prints. It fails on failed
requests, HTTP errors, failed web fonts, broken images, and declared fixed-sheet
overflow. It disables transitions/animation and executes no document scripts by
default. If a trusted chart needs a script, enable scripts explicitly and ensure
its completed state is ready before the `load` event/font-image checks finish.
Arbitrary asynchronous application readiness is not automatically detected;
export a static completed chart for predictable output.

Remote assets make output dependent on the network, versions, and authorization.
Prefer permitted local assets. If `--allow-remote` is required, inspect the actual
result and preserve the relevant source/version details. Do not embed secrets,
cookies, auth headers, or user credentials into document HTML.

A loaded CSS font is not proof of the printed face. Inspect the PDF when the
font silently falls back, lacks a language subset, or differs from the site's
licensed family. Wait for the actual browser's `document.fonts.ready`; arbitrary
sleep delays do not establish readiness.

## Review actual PDF pages

When Poppler is available:

```sh
pdfinfo /path/report.pdf
pdffonts /path/report.pdf
pdftotext -layout /path/report.pdf /path/report.txt
pdftoppm -png -scale-to 1600 /path/report.pdf /temporary/path/page
```

Use the runtime's internal image tool to inspect **every** generated page. Do not
automatically open every QA image on the user's desktop. For long documents,
contact sheets help navigation but do not replace reading dense pages at a
legible size. Remove QA images when the review is complete.

Review complete rows, captions, diacritics, currency symbols, page breaks,
page numbers, and missing assets. Compare at least one representative rendered
page with the source brand. Table/text extraction is supporting evidence: it
cannot show clipping, font substitution, off-page paint, or visual hierarchy.

Chromium tagging/outline output is requested, but this is not a PDF/UA or PDF/A
conformance tool. Do not promise accessible or archival certification without
an appropriate independent validation step.
