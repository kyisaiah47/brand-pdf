# Brand PDF

Make reports, proposals, statements, and letters match an existing website by
reusing its actual fonts, design tokens, and component markup. One shared skill
works in **Codex and Claude Code**. It includes a local Playwright renderer,
print helpers, and a fictional two-page example.

The workflow starts from the brand's source files and ends with visual inspection
of every printed page. It does not choose a new brand or require a hosted service.

## Install

### Claude Code plugin

In Claude Code, add this repository's marketplace and install the plugin:

```text
/plugin marketplace add kyisaiah47/brand-pdf
/plugin install brand-pdf@brand-pdf
```

Start a new session, then ask:

```text
/brand-pdf:brand-pdf Create a two-page project report using this repository's
existing website typography, tokens, and table component. Save the final PDF
under documents/ and verify every page.
```

### Codex skill

Clone the repository, then copy only the self-contained skill into an unused
skill directory in your project. Inspect any existing destination before copying;
do not overwrite a skill you already use.

```sh
git clone https://github.com/kyisaiah47/brand-pdf.git
mkdir -p /path/to/project/.agents/skills
cp -R brand-pdf/skills/brand-pdf /path/to/project/.agents/skills/brand-pdf
```

Start a new Codex session in the project and invoke `$brand-pdf`. For example:

```text
$brand-pdf Turn the approved project summary into a PDF using our website's real
brand files. Use A4, retain our existing table styles, and inspect every page.
```

Both installations use the same instructions and scripts. Plugin installation
makes the skill discoverable; it does not install Node dependencies or download
a browser automatically.

## Set up the renderer

Requires Node.js 22 or later. In the installed `skills/brand-pdf` directory
(or `.agents/skills/brand-pdf` for a direct installation):

```sh
npm ci
npm run browser:install
node scripts/render.mjs examples/report.html /temporary/path/sample-report.pdf
```

Playwright downloads its own Chromium, without opening or automating your personal
browser. Linux may also require Playwright's documented browser system libraries.
The renderer and QA tools do not need an account, API key, or model API call.

Run `node scripts/render.mjs --help` for options. It supports CSS paper sizes,
required webfont checks, explicit output replacement, and opt-in remote assets or
document scripts. It rejects missing assets, failed fonts, and fixed-sheet
overflow. Existing PDFs are preserved unless `--force` is supplied.

## Use with your brand

Ask the agent to locate the real website token/font/component files, create or
read a project-local `BRAND.md`, and author local HTML with relative asset paths.
The skill includes guidance for flowing reports, fixed sheets, page counters,
font embedding checks, and visual review. Supply permitted local fonts for
consistent output across operating systems; the fictional example intentionally
uses system font stacks.

Keep source HTML and brand inputs with your document project. Rendered PDFs and
QA page images are outputs, not installed skill content. The renderer never
publishes or sends documents.

## Verify

```sh
cd skills/brand-pdf
npm ci
npm run browser:install
npm test
```

Tests render real PDFs and check page geometry/pagination, input paths, output
preservation, asset failures, font checks, script opt-in, and fixed-sheet overflow.
Generated test files live in temporary directories and are removed afterward.
For visual verification, use Poppler (`pdftoppm`, `pdfinfo`, `pdffonts`) or your
agent runtime's PDF rendering tools and inspect every page internally.

The checks are preflight signals, not a guarantee of visual brand fidelity.
Asynchronous charts should be exported in a completed static state. Tagged PDF
output is requested, but PDF/UA and PDF/A certification are outside this tool's
scope. The source HTML should be trusted; enabling scripts or remote assets
expands what that document can execute or request.

## Package and provenance

Version 0.1.2 includes an Agent Plugins `plugin.json` for OpenAI and a Claude
plugin manifest plus repository marketplace. Directory review/publication is a
separate step; repository installation does not imply official directory approval.

This publication copy was adapted from an internal document workflow. It omits
private brand packs, machine paths, customer information, mandatory studio
credits, and personal design rules. It uses an isolated bundled Chromium renderer
instead of a fixed system-browser executable.

Copyright 2026 Compound Labs. All rights reserved. See [LICENSE](LICENSE) for
installation and internal-use permission. Third-party dependency notices are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Privacy and terms

Read the [data-handling policy](PRIVACY.md) and [usage terms](LICENSE) before use.
