# Build a brand pack from the source

Keep the pack in the document's project so the document can be rebuilt without
modifying the installed skill. A useful minimal layout is:

```
documents/
  report.html
  print.css
  brand/
    BRAND.md
    brand.css
```

`BRAND.md` should answer these concrete questions:

1. Which source files own color/spacing tokens, typography, and component rules?
2. Which theme attributes or root classes make those rules active?
3. Which exact font families, weights, styles, and language subsets are needed?
4. Which source markup supplies a table, metadata row, heading, or letterhead?
5. Which assets may be used, and where did their permission/license come from?
6. What print-only adjustments are necessary, and how will fidelity be checked?

Prefer relative imports of the existing CSS while working within one checkout.
If output must be transferable, vendor only the permitted minimal source assets
into the document project and record their origin. A pack containing absolute
paths to one developer's machine is not portable. Do not distribute private
source assets or a licensed webfont without checking its embedding rights.

Import order should make ownership clear: source fonts/tokens first, relevant
component rules next, document print exceptions last. Avoid loading an app's
entire JavaScript or indiscriminate CSS reset just to recreate a letterhead.
Retain the exact static markup where it provides the established visual grammar.

For a required web font, pass `--expect-web-font` using its CSS family name. This
requires a declared `@font-face` to load successfully; it does not prove the font
has every glyph or that every text run uses it. Inspect the printed PDF and use
`pdffonts` or another PDF inspector to verify embedded faces. System-font stacks
are intentionally platform dependent; document that limitation or supply a
permitted web font when typography must match across machines.

Never invent a legal scope statement, certification, customer metric, studio
credit, or logo usage to fill a template. Use approved text and source assets.
