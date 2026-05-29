// Entrypoint for the render-qa GitHub Action.
// Runs the repo's own built code (dist/), so it needs no published npm package.
// Emits workflow annotations (::error:: / ::warning::) and a job summary table.
import { appendFileSync } from "node:fs";
import { checkUrl } from "../dist/index.js";

const url = process.env.INPUT_URL;
const failOn = (process.env.INPUT_FAIL_ON || "error").toLowerCase();
const vpRaw = process.env.INPUT_VIEWPORT || "1280x800";

if (!url) {
  console.error("render-qa: 'url' input is required");
  process.exit(2);
}

let viewport;
const m = vpRaw.match(/^(\d+)x(\d+)$/);
if (m) viewport = { width: Number(m[1]), height: Number(m[2]) };

const result = await checkUrl(url, { viewport });

// Group by rule so a repeated issue doesn't emit hundreds of annotations
// (GitHub caps at ~10 per step anyway).
const groups = new Map();
for (const f of result.findings) {
  const g = groups.get(f.rule);
  if (g) g.push(f);
  else groups.set(f.rule, [f]);
}

// Annotations — one per rule.
for (const [rule, group] of groups) {
  const f = group[0];
  const cmd = f.severity === "error" ? "error" : "warning";
  const count = group.length > 1 ? ` (${group.length} occurrences)` : "";
  console.log(`::${cmd} title=render-qa: ${rule}${count}::${f.message} (at ${f.selector})`);
}

// Job summary table — one row per rule with a count + example.
const lines = [`### render-qa — ${url}`, ""];
if (result.findings.length === 0) {
  lines.push("✅ No render issues found.");
} else {
  lines.push("| severity | rule | count | example |", "|---|---|---|---|");
  for (const [rule, group] of groups) {
    const f = group[0];
    const sev = f.severity === "error" ? "❌ error" : "⚠️ warning";
    const detail = f.message.replace(/\|/g, "\\|");
    lines.push(`| ${sev} | \`${rule}\` | ${group.length} | ${detail} |`);
  }
}
const summary = lines.join("\n") + "\n";
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
  console.log("\n" + summary);
}

const hasError = result.findings.some((f) => f.severity === "error");
const hasWarning = result.findings.some((f) => f.severity === "warning");
const fail = failOn === "warning" ? hasError || hasWarning : hasError;
process.exit(fail ? 1 : 0);
