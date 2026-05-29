# render-qa

**Baseline-free render-correctness checks for the web.** Catch text overflow,
clipping, off-canvas bleed, low color contrast (WCAG), and tiny tap targets —
straight from a single render, with no screenshots and no baselines. Runs
locally or in CI, and it's built for the broken layouts that AI-generated UIs
produce by the thousand.

```bash
npx playwright install chromium   # once, downloads the headless browser
npx render-qa check https://your-site.com
```

```
render-qa 1280x800  https://your-site.com

✗ error clipped-text
  Text is clipped horizontally: content is 412px wide inside a 160px box, with no ellipsis.
  at div.pill
  text: "Generated summary: revenue up 12% quarter over quarter across all regions"

✗ error page-horizontal-scroll
  Page scrolls horizontally: content is 1600px wide but the viewport is only 1280px.
  at html

2 error(s), 0 warning(s)
```

Exits non-zero when it finds an error, so you can drop it straight into CI.

## Why this exists

Visual regression tools (Chromatic, Percy, Argos, Lost Pixel) answer **"did this
render *change* vs a baseline screenshot?"** — they need baselines and a human to
approve diffs. Accessibility linters (axe) check contrast and ARIA but don't look
at layout.

Nobody checks the simpler, more frequent question: **"is this single render
actually *correct*?"** Text bleeding past the edge, labels chopped off with no
ellipsis, a stray element forcing a horizontal scrollbar — these are bugs you can
detect from live layout geometry, with **no baseline at all**.

That gap matters more every month: AI now generates UIs, slides, and components by
the thousand, and a lot of that output silently overflows or clips. render-qa is
the gate for that class of bug.

## What it checks today

| Rule | Severity | What it means |
|---|---|---|
| `clipped-text` | error | Text is cut off by `overflow:hidden` with no ellipsis (silent data loss) |
| `clipped-text-vertical` | warning | Text is taller than its clipping box |
| `viewport-overflow` | error | A text element extends past the right edge of the viewport |
| `page-horizontal-scroll` | error | The page is wider than the viewport |
| `low-contrast` | error | Text fails the WCAG AA contrast ratio against its background |
| `small-tap-target` | warning | An interactive control is smaller than 24×24px |

It does **not** flag intentional `text-overflow: ellipsis` truncation, native
checkbox/radio sizes, or text on a complex/transparent background it can't read.

## Usage

```bash
# A live URL
npx render-qa check https://example.com

# A local HTML file
npx render-qa check ./dist/index.html

# A specific viewport (great for catching mobile-only overflow)
npx render-qa check https://example.com --viewport 390x844

# Machine-readable output for CI / dashboards
npx render-qa check https://example.com --json
```

### Programmatic API

```ts
import { checkUrl } from "render-qa";

const result = await checkUrl("https://example.com", {
  viewport: { width: 390, height: 844 },
});

if (!result.ok) {
  for (const f of result.findings) console.log(f.rule, f.selector, f.message);
}
```

## Try the demo

```bash
npm install
npx playwright install chromium
npm run demo
```

Scans `demo/fixtures/` (six pages, five deliberately broken, one clean) and
prints how many have render issues.

## Use in CI (GitHub Action)

```yaml
# .github/workflows/render-qa.yml
on: [pull_request]
jobs:
  render-qa:
    runs-on: ubuntu-latest
    steps:
      - uses: xiangnuans/render-qa@v0
        with:
          url: https://your-preview-url.example.com
          viewport: 390x844      # optional, default 1280x800
          fail-on: error         # or "warning"
```

Each finding shows up as an annotation on the run, plus a summary table in the
job. The job fails (non-zero) on an `error` — or on a `warning` too, if you set
`fail-on: warning`. Full example in [`examples/`](./examples/render-qa.yml).

## Roadmap

- [x] No-baseline rules: clipping, viewport overflow, low contrast (WCAG), tiny tap targets
- [x] GitHub Action — annotations + job summary, fails CI on findings
- [ ] More rules: off-screen (left/top), overlapping text, invisible-on-image text
- [ ] PR-level review UI that maps findings back to source
- [ ] Hosted dashboard with history (the paid layer)
- [ ] Streaming chat-UI checks: stick-to-bottom, no-flicker, tool-render order

## License

MIT © xiangnuans
