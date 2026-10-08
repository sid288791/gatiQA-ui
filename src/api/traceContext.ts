/**
 * W3C trace-context propagation for calls into the test-generator service.
 *
 * When the UI already participates in a trace (e.g. an upstream caller set a
 * traceparent), forward it so service spans attach to the caller's trace.
 * When no context exists, omit the header — the service starts a fresh trace.
 *
 * Format: traceparent = 00-<32-hex-trace-id>-<16-hex-span-id>-<flags>
 */

const TRACEPARENT_RE = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

let currentTraceParent: string | null = null;

/** Set the active W3C traceparent for subsequent internal API calls. */
export function setTraceParent(traceparent: string | null): void {
  currentTraceParent = traceparent && TRACEPARENT_RE.test(traceparent) ? traceparent : null;
}

/** Current traceparent header value, or null when no valid context exists. */
export function getTraceParent(): string | null {
  return currentTraceParent;
}

/** Headers to merge into a request — empty when no trace context is active. */
export function traceHeaders(): Record<string, string> {
  return currentTraceParent ? { traceparent: currentTraceParent } : {};
}
