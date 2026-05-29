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

// Annotations — surface each finding on the run.
for (const f of result.findings) {
  const cmd = f.severity === "error" ? "error" : "warning";
  console.log(`::${cmd} title=render-qa: ${f.rule}::${f.message} (at ${f.selector})`);
}

// Job summary table.
const lines = [`### render-qa — ${url}`, ""];
if (result.findings.length === 0) {
  lines.push("✅ No render issues found.");
} else {
  lines.push("| severity | rule | where | detail |", "|---|---|---|---|");
  for (const f of result.findings) {
    const sev = f.severity === "error" ? "❌ error" : "⚠️ warning";
    const detail = f.message.replace(/\|/g, "\\|");
    lines.push(`| ${sev} | \`${f.rule}\` | \`${f.selector}\` | ${detail} |`);
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
