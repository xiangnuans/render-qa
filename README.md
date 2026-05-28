# RenderGuard

**Baseline-free render-correctness checks for the web.** Catches text overflow,
clipping, and off-canvas bleed — no screenshots, no baselines, no review queue.

```bash
npx renderguard check https://your-site.com
```

```
RenderGuard 1280x800  https://your-site.com

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
the thousand, and a lot of that output silently overflows or clips. RenderGuard is
the gate for that class of bug.

## What it checks today

| Rule | Severity | What it means |
|---|---|---|
| `clipped-text` | error | Text is cut off by `overflow:hidden` with no ellipsis (silent data loss) |
| `clipped-text-vertical` | warning | Text is taller than its clipping box |
| `viewport-overflow` | error | A text element extends past the right edge of the viewport |
| `page-horizontal-scroll` | error | The page is wider than the viewport |

It does **not** flag intentional `text-overflow: ellipsis` truncation.

## Usage

```bash
# A live URL
npx renderguard check https://example.com

# A local HTML file
npx renderguard check ./dist/index.html

# A specific viewport (great for catching mobile-only overflow)
npx renderguard check https://example.com --viewport 390x844

# Machine-readable output for CI / dashboards
npx renderguard check https://example.com --json
```

### Programmatic API

```ts
import { checkUrl } from "renderguard";

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

Scans `demo/fixtures/` (four pages, three deliberately broken, one clean) and
prints how many have render issues.

## Roadmap

- [ ] More no-baseline rules: low contrast (WCAG), tiny tap targets, off-screen-left/top
- [ ] GitHub Action — annotate the offending elements right on the PR
- [ ] Hosted GitHub App with a dashboard and history (the paid layer)
- [ ] Streaming chat-UI checks: stick-to-bottom, no-flicker, tool-render order

## License

MIT © xiangnuans
