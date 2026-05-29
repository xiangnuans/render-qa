/**
 * Demo: scan a folder of pages and report which ones have render issues.
 *
 * This is the "I scanned N pages and M of them had text bleeding off-screen"
 * demo. The fixtures here are deliberately broken (and one is clean) so the
 * result is reproducible offline. Point it at real URLs to see it in the wild.
 *
 *   npm run demo
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkUrl } from "../src/check.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");

async function main(): Promise<void> {
  const pages = readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(fixturesDir, f));

  console.log(`\nRenderGuard demo — scanning ${pages.length} pages\n`);

  let flagged = 0;
  for (const page of pages) {
    const result = await checkUrl(page);
    const name = page.split("/").pop();

    if (result.findings.length === 0) {
      console.log(`  \x1b[32m✓\x1b[0m ${name} — clean`);
    } else {
      flagged++;
      const rules = [...new Set(result.findings.map((f) => f.rule))].join(", ");
      const mark = result.ok ? "\x1b[33m▲\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`  ${mark} ${name} — ${result.findings.length} issue(s): ${rules}`);
    }
  }

  console.log(
    `\n\x1b[1m${flagged} of ${pages.length} pages have render issues.\x1b[0m\n`,
  );
}

main().catch((err) => {
  console.error("demo failed:", err);
  process.exit(1);
});
