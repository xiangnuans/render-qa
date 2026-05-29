import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkUrl } from "../src/check.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => join(here, "..", "demo", "fixtures", name);

const rulesOf = (findings: { rule: string }[]) => findings.map((f) => f.rule);

describe("detectRenderIssues", () => {
  it("reports nothing on a correctly-rendered page (and ignores intentional ellipsis)", async () => {
    const result = await checkUrl(fixture("clean.html"));
    expect(result.findings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("flags text that is hard-clipped with no ellipsis", async () => {
    const result = await checkUrl(fixture("clipped-text.html"));
    expect(rulesOf(result.findings)).toContain("clipped-text");
    expect(result.ok).toBe(false);
  });

  it("flags a block that forces page-level horizontal scroll", async () => {
    const result = await checkUrl(fixture("horizontal-scroll.html"));
    expect(rulesOf(result.findings)).toContain("page-horizontal-scroll");
    expect(result.ok).toBe(false);
  });

  it("flags an element bleeding past the right edge of the viewport", async () => {
    const result = await checkUrl(fixture("overflow-bleed.html"));
    expect(rulesOf(result.findings)).toContain("viewport-overflow");
    expect(result.ok).toBe(false);
  });

  it("flags text that fails WCAG AA contrast", async () => {
    const result = await checkUrl(fixture("low-contrast.html"));
    expect(rulesOf(result.findings)).toContain("low-contrast");
    expect(result.ok).toBe(false);
  });

  it("flags an interactive target smaller than 24x24px", async () => {
    const result = await checkUrl(fixture("tap-target.html"));
    expect(rulesOf(result.findings)).toContain("small-tap-target");
  });

  it("includes the measured numbers and a selector in each finding", async () => {
    const result = await checkUrl(fixture("clipped-text.html"));
    const clip = result.findings.find((f) => f.rule === "clipped-text");
    expect(clip).toBeDefined();
    expect(clip?.selector).toBeTruthy();
    expect(clip?.message).toMatch(/\d+px/);
  });
});
