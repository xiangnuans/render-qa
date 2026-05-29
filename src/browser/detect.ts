import type { Finding } from "../types.js";

/**
 * Runs INSIDE the page (serialized by Playwright via page.evaluate).
 *
 * Must be fully self-contained: no module imports, no closure over Node-side
 * variables. All helpers are declared inline so the function source is complete
 * when stringified into the browser context.
 *
 * The whole point of render-qa: this answers "is this single render correct?"
 * using live layout geometry — NOT "did it change vs a baseline screenshot?".
 */
export function detectRenderIssues(): Finding[] {
  const findings: Finding[] = [];
  const tolerance = 1; // px slack to avoid sub-pixel noise
  const vw = window.innerWidth;

  function isHidden(el: Element, style: CSSStyleDeclaration): boolean {
    return (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    );
  }

  // Concatenate only the element's OWN text (direct text nodes), so we flag the
  // leaf that actually holds the clipped text instead of every ancestor.
  function directText(el: Element): string {
    let t = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === 3) t += node.textContent || "";
    });
    return t.replace(/\s+/g, " ").trim();
  }

  function cssPath(el: Element): string {
    if (el.id) return "#" + el.id;
    const parts: string[] = [];
    let cur: Element | null = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 4) {
      let sel = cur.tagName.toLowerCase();
      if (cur.classList.length) {
        sel += "." + Array.from(cur.classList).slice(0, 2).join(".");
      }
      const parent: Element | null = cur.parentElement;
      if (parent) {
        const tag = cur.tagName;
        const sibs = Array.from(parent.children).filter(
          (c) => c.tagName === tag,
        );
        if (sibs.length > 1) sel += ":nth-of-type(" + (sibs.indexOf(cur) + 1) + ")";
      }
      parts.unshift(sel);
      if (cur.id) {
        parts[0] = "#" + cur.id;
        break;
      }
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }

  function parseRGB(s: string): [number, number, number, number] | null {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
    return [p[0], p[1], p[2], p.length >= 4 ? p[3] : 1];
  }

  function relLuminance(r: number, g: number, b: number): number {
    const f = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrastRatio(l1: number, l2: number): number {
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Walk up to the first ancestor with a non-transparent background color.
  function effectiveBg(el: Element): [number, number, number] {
    let cur: Element | null = el;
    while (cur) {
      const c = parseRGB(getComputedStyle(cur).backgroundColor);
      if (c && c[3] > 0) return [c[0], c[1], c[2]];
      cur = cur.parentElement;
    }
    return [255, 255, 255]; // assume a white page background
  }

  function isButtonLike(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return true;
    if (el.getAttribute("role") === "button") return true;
    if (tag === "input") {
      const t = (el.getAttribute("type") || "").toLowerCase();
      // Native checkbox/radio are intentionally small — don't flag those.
      return t === "button" || t === "submit" || t === "reset";
    }
    return false;
  }

  // --- Rule: page-level horizontal scroll -------------------------------
  const doc = document.documentElement;
  if (doc.scrollWidth > vw + tolerance) {
    findings.push({
      rule: "page-horizontal-scroll",
      severity: "error",
      message:
        "Page scrolls horizontally: content is " +
        doc.scrollWidth +
        "px wide but the viewport is only " +
        vw +
        "px.",
      selector: "html",
    });
  }

  // --- Per-element rules -------------------------------------------------
  const all = document.body ? Array.from(document.body.querySelectorAll("*")) : [];
  for (const el of all) {
    const style = getComputedStyle(el);
    if (isHidden(el, style)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;

    const text = directText(el);
    const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

    // Rule: element bleeds past the right edge of the viewport.
    if (rect.right > vw + tolerance && text.length > 0) {
      findings.push({
        rule: "viewport-overflow",
        severity: "error",
        message:
          "Element extends " +
          Math.round(rect.right - vw) +
          "px past the right edge of the viewport.",
        selector: cssPath(el),
        snippet: text.slice(0, 80),
        box,
      });
    }

    // Rule: interactive target smaller than the 24x24px WCAG 2.2 minimum.
    if (isButtonLike(el) && (rect.width < 24 || rect.height < 24)) {
      findings.push({
        rule: "small-tap-target",
        severity: "warning",
        message:
          "Interactive target is " +
          Math.round(rect.width) +
          "x" +
          Math.round(rect.height) +
          "px, below the 24x24px minimum.",
        selector: cssPath(el),
        snippet: text.slice(0, 80) || undefined,
        box,
      });
    }

    if (text.length === 0) continue;

    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const clipsX = overflowX === "hidden" || overflowX === "clip";
    const clipsY = overflowY === "hidden" || overflowY === "clip";
    const hasEllipsis = style.textOverflow === "ellipsis";

    // Rule: text clipped horizontally with no ellipsis (silent data loss).
    if (clipsX && !hasEllipsis && el.scrollWidth > el.clientWidth + tolerance) {
      findings.push({
        rule: "clipped-text",
        severity: "error",
        message:
          "Text is clipped horizontally: content is " +
          el.scrollWidth +
          "px wide inside a " +
          el.clientWidth +
          "px box, with no ellipsis.",
        selector: cssPath(el),
        snippet: text.slice(0, 80),
        box,
      });
    }

    // Rule: text clipped vertically (cut off at the bottom).
    if (clipsY && el.scrollHeight > el.clientHeight + tolerance) {
      findings.push({
        rule: "clipped-text-vertical",
        severity: "warning",
        message:
          "Text may be clipped vertically: content is " +
          el.scrollHeight +
          "px tall inside a " +
          el.clientHeight +
          "px box.",
        selector: cssPath(el),
        snippet: text.slice(0, 80),
        box,
      });
    }

    // Rule: text fails WCAG AA contrast against its background.
    const col = parseRGB(style.color);
    if (col && col[3] >= 0.9) {
      const fontSize = parseFloat(style.fontSize) || 16;
      const bold = (parseInt(style.fontWeight, 10) || 400) >= 700;
      const large = fontSize >= 24 || (fontSize >= 18.66 && bold);
      const threshold = large ? 3 : 4.5;
      const bg = effectiveBg(el);
      const ratio = contrastRatio(
        relLuminance(col[0], col[1], col[2]),
        relLuminance(bg[0], bg[1], bg[2]),
      );
      if (ratio < threshold - 0.05) {
        findings.push({
          rule: "low-contrast",
          severity: "error",
          message:
            "Text contrast is " +
            ratio.toFixed(2) +
            ":1, below the WCAG AA minimum of " +
            threshold +
            ":1.",
          selector: cssPath(el),
          snippet: text.slice(0, 80),
          box,
        });
      }
    }
  }

  return findings;
}
