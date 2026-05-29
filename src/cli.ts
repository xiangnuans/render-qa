#!/usr/bin/env node
import { checkUrl } from "./check.js";
import type { CheckResult, Viewport } from "./types.js";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function parseViewport(value: string | undefined): Viewport | undefined {
  if (!value) return undefined;
  const m = value.match(/^(\d+)x(\d+)$/);
  if (!m) return undefined;
  return { width: Number(m[1]), height: Number(m[2]) };
}

function printHuman(result: CheckResult): void {
  const errors = result.findings.filter((f) => f.severity === "error");
  const warnings = result.findings.filter((f) => f.severity === "warning");

  console.log(
    `\n${BOLD}render-qa${RESET} ${DIM}${result.viewport.width}x${result.viewport.height}${RESET}  ${result.url}`,
  );

  if (result.findings.length === 0) {
    console.log(`${GREEN}✓ no render issues found${RESET}\n`);
    return;
  }

  // Group by rule so a repeated issue (e.g. low contrast on every row) shows
  // once with a count instead of hundreds of near-identical lines.
  const byRule = new Map<string, typeof result.findings>();
  for (const f of result.findings) {
    const g = byRule.get(f.rule);
    if (g) g.push(f);
    else byRule.set(f.rule, [f]);
  }

  for (const [rule, group] of byRule) {
    const sev = group[0].severity;
    const color = sev === "error" ? RED : YELLOW;
    const tag = sev === "error" ? "✗ error" : "▲ warn";
    const count = group.length > 1 ? ` ${DIM}(${group.length}×)${RESET}` : "";
    console.log(`\n${color}${tag}${RESET} ${BOLD}${rule}${RESET}${count}`);
    for (const f of group.slice(0, 3)) {
      console.log(`  ${f.message}`);
      console.log(
        `  ${DIM}at${RESET} ${f.selector}${f.snippet ? `  ${DIM}—${RESET} "${f.snippet}"` : ""}`,
      );
    }
    if (group.length > 3) {
      console.log(`  ${DIM}…and ${group.length - 3} more${RESET}`);
    }
  }

  console.log(
    `\n${errors.length ? RED : GREEN}${errors.length} error(s)${RESET}, ${warnings.length} warning(s)\n`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const target = args[1];

  if (cmd !== "check" || !target || target.startsWith("-")) {
    console.error(
      "Usage: render-qa check <url|path> [--json] [--viewport WxH]",
    );
    process.exit(2);
  }

  const json = args.includes("--json");
  const viewport = parseViewport(args[args.indexOf("--viewport") + 1]);

  const result = await checkUrl(target, { viewport });

  if (json) console.log(JSON.stringify(result, null, 2));
  else printHuman(result);

  // Non-zero exit on any error-severity finding → fails CI.
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  const msg = err?.message ?? String(err);
  // First-run on a clean machine: Chromium isn't downloaded yet. Give an
  // actionable instruction instead of a cryptic Playwright stack trace.
  if (/Executable doesn'?t exist|playwright install|browserType\.launch/i.test(msg)) {
    console.error(
      `${RED}render-qa: Chromium isn't installed.${RESET}\n` +
        `Run this once, then re-run your command:\n\n` +
        `  npx playwright install chromium\n`,
    );
    process.exit(2);
  }
  console.error(`${RED}render-qa failed:${RESET}`, msg);
  process.exit(2);
});
