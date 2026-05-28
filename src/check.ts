import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { detectRenderIssues } from "./browser/detect.js";
import type { CheckOptions, CheckResult, Finding } from "./types.js";

/** Turn a bare local path into a file:// URL; pass through http(s)/file URLs. */
function toUrl(target: string): string {
  if (/^(https?|file):\/\//.test(target)) return target;
  if (existsSync(target)) return pathToFileURL(target).href;
  // Last resort: assume http so the user gets a clear navigation error.
  return target.includes("://") ? target : "https://" + target;
}

/**
 * Render `target` in a headless browser and return every render-correctness
 * problem found. No baseline, no screenshot diff — just live layout geometry.
 */
export async function checkUrl(
  target: string,
  options: CheckOptions = {},
): Promise<CheckResult> {
  const viewport = options.viewport ?? { width: 1280, height: 800 };
  const url = toUrl(target);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    await page.goto(url, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 30_000,
    });
    // Evaluate the detector as a self-contained source string. The local
    // `__name` shim neutralizes the helper that bundlers (esbuild/tsx) inject
    // around named functions, which otherwise isn't defined in page context.
    const expr = `(() => { const __name = (f) => f; return (${detectRenderIssues.toString()})(); })()`;
    const findings = (await page.evaluate(expr)) as Finding[];
    const ok = !findings.some((f) => f.severity === "error");
    return { url, viewport, findings, ok };
  } finally {
    await browser.close();
  }
}
