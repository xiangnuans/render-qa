export type Severity = "error" | "warning";

/** A single render-correctness problem found on the page. */
export interface Finding {
  /** Rule id, e.g. "clipped-text", "viewport-overflow". */
  rule: string;
  severity: Severity;
  /** Human-readable explanation, including the measured numbers. */
  message: string;
  /** Best-effort CSS-ish path to the offending element. */
  selector: string;
  /** Up to ~80 chars of the element's own text, for context. */
  snippet?: string;
  /** getBoundingClientRect of the element at detection time. */
  box?: { x: number; y: number; width: number; height: number };
}

export interface Viewport {
  width: number;
  height: number;
}

export interface CheckOptions {
  viewport?: Viewport;
  /** Navigation timeout in ms (default 30000). */
  timeout?: number;
  /** Playwright waitUntil (default "networkidle"). */
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  /** Path to a Playwright storageState JSON file — scan pages behind a login. */
  storageState?: string;
  /** Extra HTTP headers (e.g. an Authorization bearer token). */
  headers?: Record<string, string>;
}

export interface CheckResult {
  url: string;
  viewport: Viewport;
  findings: Finding[];
  /** true when there are no error-severity findings. */
  ok: boolean;
}
