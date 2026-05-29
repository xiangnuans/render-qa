/**
 * Scan real, live URLs and report which have render issues.
 *
 *   npm run scan:live -- https://example.com https://news.ycombinator.com
 *
 * Unlike `npm run demo` (deterministic local fixtures), this hits the network,
 * so results vary as sites change. Handy for build-in-public proof and for
 * finding false positives on real-world pages before you trust the tool.
 */
import { checkUrl } from "../src/check.js";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.error("Usage: npm run scan:live -- <url> [url...]");
  process.exit(2);
}

let withIssues = 0;
for (const url of urls) {
  try {
    const r = await checkUrl(url, { waitUntil: "load", timeout: 45_000 });
    const errs = r.findings.filter((f) => f.severity === "error").length;
    const warns = r.findings.filter((f) => f.severity === "warning").length;
    if (r.findings.length === 0) {
      console.log(`\x1b[32m✓\x1b[0m ${url} — clean`);
    } else {
      withIssues++;
      const rules = [...new Set(r.findings.map((f) => f.rule))].join(", ");
      const mark = errs > 0 ? "\x1b[31m✗\x1b[0m" : "\x1b[33m▲\x1b[0m";
      console.log(`${mark} ${url} — ${errs} error(s), ${warns} warning(s): ${rules}`);
    }
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).split("\n")[0];
    console.log(`\x1b[2m!\x1b[0m ${url} — could not scan (${msg})`);
  }
}

console.log(`\n\x1b[1m${withIssues} of ${urls.length} pages have render issues.\x1b[0m`);
