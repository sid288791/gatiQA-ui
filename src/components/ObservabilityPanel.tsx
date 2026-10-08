import { useState } from 'react';
import { config } from '../config';
import type { ObservabilityFields } from '../api/types';

interface IdRow {
  label: string;
  value?: string;
  /** Shown instead of the value when value is absent (e.g. cache-hit note). */
  fallback?: string;
}

interface Props extends ObservabilityFields {
  /** Extra stable IDs to surface, e.g. testCaseId / summaryId / matchedReportId. */
  ids?: IdRow[];
  /** Label for the matched entity on a cache hit, e.g. "matchedTestCaseId". */
  matchedLabel?: string;
  matchedId?: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * Langfuse observability metadata for test-generation / analysis-summary
 * responses. Renders nothing when no observability fields are present —
 * tracing disabled means the UI looks exactly as before.
 */
export function ObservabilityPanel({
  traceId,
  observationId,
  generationId,
  cached,
  similarity,
  matchType,
  ids = [],
  matchedLabel,
  matchedId,
}: Props) {
  const rows: IdRow[] = [
    ...ids,
    { label: 'traceId', value: traceId },
    { label: 'observationId', value: observationId },
    {
      label: 'generationId',
      value: generationId,
      fallback:
        cached && !generationId ? 'served from semantic cache — no LLM call' : undefined,
    },
  ].filter((r) => r.value || r.fallback);

  const similarityPct =
    similarity != null ? `${Math.round(similarity * 100)}%` : null;

  if (rows.length === 0 && !cached) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Observability
        </h3>
        {cached && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
            Cache hit{matchType ? ` · ${matchType}` : ''}
            {similarityPct ? ` · ${similarityPct}` : ''}
          </span>
        )}
        {traceId && (
          <a
            href={`${config.langfuseBaseUrl}/traces`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs font-medium text-brand-600 hover:underline"
            title={`Search trace ${traceId} in Langfuse`}
          >
            View in Langfuse ↗
          </a>
        )}
      </div>
      {rows.length > 0 && (
        <dl className="mt-2 space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-xs">
              <dt className="w-28 shrink-0 font-medium text-slate-500">{r.label}</dt>
              {r.value ? (
                <>
                  <dd className="truncate font-mono text-slate-700" title={r.value}>
                    {r.value}
                  </dd>
                  <CopyButton value={r.value} />
                </>
              ) : (
                <dd className="italic text-slate-400">{r.fallback}</dd>
              )}
            </div>
          ))}
          {cached && matchedId && matchedLabel && (
            <div className="flex items-center gap-2 text-xs">
              <dt className="w-28 shrink-0 font-medium text-slate-500">{matchedLabel}</dt>
              <dd className="truncate font-mono text-slate-700" title={matchedId}>
                {matchedId}
              </dd>
              <CopyButton value={matchedId} />
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
