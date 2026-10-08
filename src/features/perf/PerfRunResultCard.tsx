import { useQuery } from '@tanstack/react-query';
import { api, type PerfRunDetailResponse, type PerfRunStatus } from '../../api';
import { Badge } from '../../components/badges';
import { DonutChart, type ChartSegment } from '../../components/charts';
import { ErrorState, Loading } from '../../components/states';
import { Card } from '../../components/ui';

const TERMINAL: PerfRunStatus[] = ['COMPLETED', 'FAILED'];

export const PERF_STATUS_BADGE: Record<PerfRunStatus, string> = {
  QUEUED: 'queued',
  GENERATING_SCRIPT: 'running',
  VALIDATING: 'running',
  EXECUTING: 'running',
  SUMMARIZING: 'running',
  COMPLETED: 'succeeded',
  FAILED: 'error',
};

export const PERF_STATUS_LABEL: Record<PerfRunStatus, string> = {
  QUEUED: 'Queued',
  GENERATING_SCRIPT: 'Generating script…',
  VALIDATING: 'Validating…',
  EXECUTING: 'Executing…',
  SUMMARIZING: 'Summarizing…',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

function fmt(v: number | null | undefined, digits = 2): string {
  return v == null ? '—' : v.toFixed(digits);
}

function fmtBytes(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} MB`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} kB`;
  return `${v} B`;
}

/** k6 end-of-test report: checks, data transfer, iterations, VUs, timing breakdown. */
function K6Report({ run }: { run: PerfRunDetailResponse }) {
  const r = run.result;
  if (!r) return null;
  const hasAny =
    r.checksPassed != null || r.dataReceivedBytes != null ||
    r.iterationsCompleted != null || r.vusMax != null || r.reqWaitingAvgMs != null;
  if (!hasAny) return null;

  const checksTotal = (r.checksPassed ?? 0) + (r.checksFailed ?? 0);
  const checksPct = checksTotal > 0 ? ((r.checksPassed ?? 0) / checksTotal) * 100 : null;

  const timings: { label: string; ms: number | null; color: string }[] = [
    { label: 'blocked', ms: r.reqBlockedAvgMs, color: '#94a3b8' },
    { label: 'connecting', ms: r.reqConnectingAvgMs, color: '#f59e0b' },
    { label: 'tls', ms: r.reqTlsAvgMs, color: '#a78bfa' },
    { label: 'sending', ms: r.reqSendingAvgMs, color: '#38bdf8' },
    { label: 'waiting (TTFB)', ms: r.reqWaitingAvgMs, color: '#2563eb' },
    { label: 'receiving', ms: r.reqReceivingAvgMs, color: '#10b981' },
  ];
  const timingTotal = timings.reduce((s, t) => s + (t.ms ?? 0), 0);

  const rows: { name: string; value: string }[] = [
    {
      name: 'checks',
      value: checksTotal > 0
        ? `${fmt(checksPct, 1)}% — ✓ ${r.checksPassed} ✗ ${r.checksFailed}`
        : '—',
    },
    { name: 'data_received', value: fmtBytes(r.dataReceivedBytes) },
    { name: 'data_sent', value: fmtBytes(r.dataSentBytes) },
    {
      name: 'http_reqs',
      value: r.totalRequests != null
        ? `${r.totalRequests.toLocaleString()} (${fmt(r.requestsPerSec, 2)}/s)`
        : '—',
    },
    {
      name: 'iterations',
      value: r.iterationsCompleted != null
        ? `${r.iterationsCompleted.toLocaleString()} (${fmt(r.iterationsPerSec, 2)}/s)`
        : '—',
    },
    {
      name: 'iteration_duration',
      value: r.iterationDurationAvgMs != null
        ? `avg=${fmt(r.iterationDurationAvgMs)}ms p(95)=${fmt(r.iterationDurationP95Ms)}ms`
        : '—',
    },
    { name: 'vus_max', value: r.vusMax != null ? String(r.vusMax) : '—' },
  ];

  const checkSegments: ChartSegment[] = [
    { label: 'Passed', value: r.checksPassed ?? 0, color: '#10b981' },
    { label: 'Failed', value: r.checksFailed ?? 0, color: '#ef4444' },
  ];

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        k6 report
      </h4>
      <div className="flex items-start gap-6">
        <table className="flex-1 text-xs">
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.name}>
                <td className="w-40 py-1.5 font-mono text-slate-500">{row.name}</td>
                <td className="py-1.5 font-medium text-slate-800">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {checksTotal > 0 && (
          <div className="flex flex-col items-center">
            <DonutChart
              segments={checkSegments}
              size={88}
              strokeWidth={12}
              centerLabel={`${fmt(checksPct, 0)}%`}
              centerSub="checks"
            />
            <p className="mt-1 text-xs text-slate-500">
              ✓ {r.checksPassed} / ✗ {r.checksFailed}
            </p>
          </div>
        )}
      </div>

      {timingTotal > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-slate-500">Request timing breakdown (avg)</p>
          <div className="flex h-4 w-full overflow-hidden rounded">
            {timings.map((t) =>
              t.ms != null && t.ms > 0 ? (
                <div
                  key={t.label}
                  style={{ width: `${(t.ms / timingTotal) * 100}%`, background: t.color }}
                  title={`${t.label}: ${fmt(t.ms)}ms`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {timings.map((t) =>
              t.ms != null && t.ms > 0 ? (
                <span key={t.label} className="flex items-center gap-1 text-xs text-slate-600">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: t.color }} />
                  {t.label} {fmt(t.ms)}ms
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

/** Horizontal latency bar chart: avg/p50/p90/p95/p99 vs the p95 threshold. */
function LatencyBars({ run }: { run: PerfRunDetailResponse }) {
  const r = run.result;
  if (!r) return null;
  const rows: { label: string; ms: number | null }[] = [
    { label: 'min', ms: r.minLatencyMs },
    { label: 'avg', ms: r.avgLatencyMs },
    { label: 'p50', ms: r.p50LatencyMs },
    { label: 'p90', ms: r.p90LatencyMs },
    { label: 'p95', ms: r.p95LatencyMs },
    { label: 'p99', ms: r.p99LatencyMs },
    { label: 'max', ms: r.maxLatencyMs },
  ];
  const max = Math.max(run.p95ThresholdMs, ...rows.map((x) => x.ms ?? 0)) * 1.05;
  return (
    <div className="space-y-1.5">
      {rows.map((row) => {
        const pct = row.ms != null ? Math.min((row.ms / max) * 100, 100) : 0;
        const overThreshold = row.ms != null && row.ms > run.p95ThresholdMs;
        return (
          <div key={row.label} className="flex items-center gap-2 text-xs">
            <span className="w-8 text-right font-medium text-slate-600">{row.label}</span>
            <div className="relative h-4 flex-1 rounded bg-slate-100">
              <div
                className="h-4 rounded"
                style={{
                  width: `${pct}%`,
                  background: overThreshold ? '#dc2626' : '#2563eb',
                }}
              />
              <div
                className="absolute top-0 h-4 w-px bg-red-500"
                style={{ left: `${Math.min((run.p95ThresholdMs / max) * 100, 100)}%` }}
                title={`p95 threshold: ${run.p95ThresholdMs}ms`}
              />
            </div>
            <span className="w-16 font-mono text-slate-700">{fmt(row.ms)}ms</span>
          </div>
        );
      })}
      <p className="text-xs text-slate-400">
        <span className="text-red-500">│</span> p95 threshold {run.p95ThresholdMs}ms
      </p>
    </div>
  );
}

/**
 * Polls a perf run until it reaches a terminal state, then renders metrics,
 * threshold verdicts, a latency chart and the AI summary.
 */
export function PerfRunResultCard({ runId }: { runId: string }) {
  const runQ = useQuery({
    queryKey: ['perf-run', runId],
    queryFn: () => api.getPerfRun(runId),
    refetchInterval: (query) =>
      query.state.data && TERMINAL.includes(query.state.data.status) ? false : 2000,
  });

  if (runQ.isLoading) return <Loading label="Loading performance run…" />;
  if (runQ.isError) return <ErrorState error={runQ.error} onRetry={() => runQ.refetch()} />;
  const run = runQ.data!;
  const r = run.result;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{run.name}</h3>
          <p className="text-xs text-slate-500">
            {run.engine} · {run.concurrentUsers} VUs ·{' '}
            {run.iterations != null ? `${run.iterations} iterations` : `${run.durationSeconds}s`}
            {run.iterations == null && run.rampUpSeconds > 0 ? ` (+${run.rampUpSeconds}s ramp)` : ''} ·{' '}
            {run.targets.length} target{run.targets.length === 1 ? '' : 's'}
          </p>
        </div>
        <span className="flex items-center gap-2">
          {r?.overallPassed != null && (
            <Badge value={r.overallPassed ? 'pass' : 'fail'} label={r.overallPassed ? 'PASS' : 'FAIL'} />
          )}
          <Badge value={PERF_STATUS_BADGE[run.status]} label={PERF_STATUS_LABEL[run.status]} />
        </span>
      </div>

      {run.status === 'FAILED' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {run.errorMessage ?? 'Run failed.'}
        </div>
      )}

      {!TERMINAL.includes(run.status) && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
          {PERF_STATUS_LABEL[run.status]}
          {run.generationAttempts > 0 && ` (attempt ${run.generationAttempts})`}
        </div>
      )}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Requests/sec" value={fmt(r.requestsPerSec, 1)} />
            <Metric label="Total requests" value={r.totalRequests != null ? r.totalRequests.toLocaleString() : '—'} />
            <Metric
              label="Error rate"
              value={`${fmt(r.errorRatePercent)}%`}
              sub={`threshold < ${run.maxErrorRatePercent}%`}
            />
            <Metric
              label="P95 latency"
              value={`${fmt(r.p95LatencyMs)}ms`}
              sub={`threshold < ${run.p95ThresholdMs}ms`}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {r.p95ThresholdPassed != null && (
              <Badge
                value={r.p95ThresholdPassed ? 'pass' : 'fail'}
                label={`p95 < ${run.p95ThresholdMs}ms: ${r.p95ThresholdPassed ? 'PASS' : 'FAIL'}`}
              />
            )}
            {r.errorRateThresholdPassed != null && (
              <Badge
                value={r.errorRateThresholdPassed ? 'pass' : 'fail'}
                label={`errors < ${run.maxErrorRatePercent}%: ${r.errorRateThresholdPassed ? 'PASS' : 'FAIL'}`}
              />
            )}
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Latency distribution
            </h4>
            <LatencyBars run={run} />
          </div>

          <K6Report run={run} />

          {r.aiSummary && (
            <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
                AI summary
              </h4>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.aiSummary}</p>
            </div>
          )}

          {run.generatedScript && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                Generated k6 script
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                {run.generatedScript}
              </pre>
            </details>
          )}

          {run.rawStdout && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                Raw k6 output
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                {run.rawStdout}
              </pre>
            </details>
          )}
        </>
      )}
    </Card>
  );
}
