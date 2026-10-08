import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type AnalysisSummaryRequest, type AnalysisSummaryResponse, type DashboardTotals } from '../../api';
import { ObservabilityPanel } from '../../components/ObservabilityPanel';
import { ErrorState, Loading } from '../../components/states';
import { Button, Card, Field, PageHeader, Select } from '../../components/ui';

const OPERATIONS = [
  { value: '', label: 'All operations' },
  { value: 'analysis-summary', label: 'analysis-summary' },
  { value: 'test-generation', label: 'test-generation' },
];

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  return `${ms.toFixed(ms < 10 ? 2 : 0)}ms`;
}

function fmtPct(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function fmtCost(cost: number | null | undefined): string {
  if (cost == null) return '—';
  return `$${cost.toFixed(5)}`;
}

function fmtTokens(total: number | null, known: number | null | undefined): string {
  if (total == null) return `${known ?? 0}*`;
  return total.toLocaleString();
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function TotalsGrid({ t }: { t: DashboardTotals }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total requests" value={t.totalRequests.toString()} />
      <StatCard label="Failed" value={t.failedRequests.toString()} sub={fmtPct(t.errorRate)} />
      <StatCard label="Cache hits" value={t.cacheHits.toString()} sub={fmtPct(t.cacheHitRate)} />
      <StatCard label="LLM calls" value={(t.llmCalls ?? 0).toString()} />
      <StatCard label="Embedding calls" value={(t.embeddingCalls ?? 0).toString()} />
      <StatCard
        label="Total tokens"
        value={fmtTokens(t.totalTokens, t.knownTotalTokens)}
        sub={t.totalTokens == null ? '* partial — some calls missing usage' : undefined}
      />
      <StatCard
        label="Total cost"
        value={fmtCost(t.totalCostUsd)}
        sub={t.totalCostUsd == null ? `* partial — known: ${fmtCost(t.knownCostUsd)}` : undefined}
      />
      <StatCard label="Avg latency" value={fmtMs(t.averageLatencyMs)} sub={`p50: ${fmtMs(t.p50LatencyMs)} · p95: ${fmtMs(t.p95LatencyMs)}`} />
    </div>
  );
}

function OperationBreakdown({ byOp }: { byOp: Record<string, Partial<DashboardTotals>> }) {
  const entries = Object.entries(byOp);
  if (entries.length === 0) return null;
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">By operation</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Operation</th>
              <th className="py-2 pr-4">Requests</th>
              <th className="py-2 pr-4">Failed</th>
              <th className="py-2 pr-4">Cache hits</th>
              <th className="py-2 pr-4">LLM</th>
              <th className="py-2 pr-4">Tokens</th>
              <th className="py-2 pr-4">Cost</th>
              <th className="py-2 pr-4">Avg latency</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([op, d]) => (
              <tr key={op} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-4 font-medium text-slate-800">{op}</td>
                <td className="py-2 pr-4">{d.totalRequests ?? '—'}</td>
                <td className="py-2 pr-4">{d.failedRequests ?? '—'}</td>
                <td className="py-2 pr-4">{d.cacheHits ?? '—'}</td>
                <td className="py-2 pr-4">{d.llmCalls ?? '—'}</td>
                <td className="py-2 pr-4">{fmtTokens(d.totalTokens ?? null, d.knownTotalTokens)}</td>
                <td className="py-2 pr-4">{fmtCost(d.totalCostUsd ?? null)}</td>
                <td className="py-2 pr-4">{fmtMs(d.averageLatencyMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TracesTable({ traces }: { traces: AnalysisSummaryResponse['dashboard'] extends { traces: infer T } ? T : never }) {
  if (!traces || traces.length === 0) return null;
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Recent traces</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Request ID</th>
              <th className="py-2 pr-4">Operation</th>
              <th className="py-2 pr-4">Model</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Cached</th>
              <th className="py-2 pr-4">Latency</th>
              <th className="py-2 pr-4">Tokens</th>
              <th className="py-2 pr-4">Cost</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.requestId} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-4 font-mono text-xs text-slate-600">{t.requestId.slice(0, 12)}…</td>
                <td className="py-2 pr-4">{t.operation}</td>
                <td className="py-2 pr-4">{t.model ?? '—'}</td>
                <td className="py-2 pr-4">
                  <span className={t.status === 'success' ? 'text-emerald-600' : 'text-red-600'}>
                    {t.status}
                  </span>
                </td>
                <td className="py-2 pr-4">{t.source ?? '—'}</td>
                <td className="py-2 pr-4">{t.cached ? '✓' : '—'}</td>
                <td className="py-2 pr-4">{fmtMs(t.latencyMs)}</td>
                <td className="py-2 pr-4">{t.totalTokens ?? '—'}</td>
                <td className="py-2 pr-4">{fmtCost(t.totalCostUsd ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function toIsoDate(iso: string): string {
  return iso ? new Date(iso).toISOString() : '';
}

export default function ObservabilityDashboardPage() {
  const [fromTime, setFromTime] = useState(daysAgoIso(7).slice(0, 10));
  const [toTime, setToTime] = useState(new Date().toISOString().slice(0, 10));
  const [operation, setOperation] = useState('');
  const [limit, setLimit] = useState('10');
  const [result, setResult] = useState<AnalysisSummaryResponse | null>(null);

  const dashMut = useMutation({
    mutationFn: (params: AnalysisSummaryRequest) =>
      api.createAnalysisSummary(params),
    onSuccess: setResult,
  });

  function handleFetch() {
    dashMut.mutate({
      analysis: {
        totalProducts: 0,
        analyzedProducts: 0,
        findings: [],
      },
      fromTime: toIsoDate(fromTime),
      toTime: toIsoDate(toTime),
      operation: operation || undefined,
      limit: Number(limit) || 10,
    });
  }

  const dash = result?.dashboard;
  const metrics = result?.metrics;

  return (
    <div>
      <PageHeader
        title="Observability Dashboard"
        subtitle="LLM usage metrics, costs, latency, and cache stats across test-generation and analysis-summary operations."
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="From">
            <input
              type="date"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Operation">
            <Select value={operation} onChange={(e) => setOperation(e.target.value)}>
              {OPERATIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Limit">
            <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </Select>
          </Field>
          <div className="pb-1">
            <Button onClick={handleFetch} disabled={dashMut.isPending}>
              {dashMut.isPending ? 'Fetching…' : 'Fetch dashboard'}
            </Button>
          </div>
        </div>
        {dashMut.isError && (
          <div className="mt-3">
            <ErrorState error={dashMut.error} />
          </div>
        )}
      </Card>

      {dashMut.isPending && !result && <Loading label="Loading dashboard…" />}

      {dash && (
        <>
          {!dash.available ? (
            <Card>
              <p className="text-sm text-amber-700">
                Dashboard unavailable: {dash.unavailableReason ?? 'Postgres is not reachable.'}
              </p>
            </Card>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                {dash.fromTime && <span>From: {dash.fromTime}</span>}
                {dash.toTime && <span>To: {dash.toTime}</span>}
                {dash.hasMore && <span className="text-amber-600">More results available</span>}
              </div>

              <div className="mb-5">
                <TotalsGrid t={dash.totals} />
              </div>

              <div className="mb-5">
                <OperationBreakdown byOp={dash.byOperation} />
              </div>

              <div className="mb-5">
                <TracesTable traces={dash.traces} />
              </div>
            </>
          )}
        </>
      )}

      {metrics && (
        <Card className="mb-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Request metrics</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Request ID" value={metrics.requestId?.slice(0, 12) + '…' ?? '—'} />
            <StatCard label="Operation" value={metrics.operation} />
            <StatCard label="Provider" value={metrics.provider ?? '—'} />
            <StatCard label="Model" value={metrics.model ?? '—'} />
            <StatCard label="Latency" value={fmtMs(metrics.latencyMs)} />
            <StatCard label="LLM calls" value={(metrics.llmCalls ?? 0).toString()} />
            <StatCard label="Embedding calls" value={(metrics.embeddingCalls ?? 0).toString()} />
            <StatCard label="Source" value={metrics.source ?? '—'} />
            <StatCard label="Input tokens" value={(metrics.inputTokens ?? 0).toString()} />
            <StatCard label="Output tokens" value={(metrics.outputTokens ?? 0).toString()} />
            <StatCard
              label="Total tokens"
              value={fmtTokens(metrics.totalTokens ?? null, metrics.knownTotalTokens)}
              sub={metrics.totalTokens == null ? '* partial' : undefined}
            />
            <StatCard
              label="Cost"
              value={fmtCost(metrics.totalCostUsd ?? null)}
              sub={metrics.costStatus ? `status: ${metrics.costStatus}` : undefined}
            />
          </div>

          {metrics.observations && metrics.observations.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Observations</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Kind</th>
                      <th className="py-2 pr-4">Model</th>
                      <th className="py-2 pr-4">Latency</th>
                      <th className="py-2 pr-4">Tokens</th>
                      <th className="py-2 pr-4">Cost</th>
                      <th className="py-2 pr-4">tok/s</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.observations.map((o) => (
                      <tr key={o.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4 font-medium text-slate-800">{o.name}</td>
                        <td className="py-2 pr-4">{o.kind}</td>
                        <td className="py-2 pr-4">{o.model ?? '—'}</td>
                        <td className="py-2 pr-4">{fmtMs(o.latencyMs)}</td>
                        <td className="py-2 pr-4">{o.totalTokens ?? '—'}</td>
                        <td className="py-2 pr-4">{fmtCost(o.totalCostUsd ?? null)}</td>
                        <td className="py-2 pr-4">{o.outputTokensPerSecond ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4">
            <ObservabilityPanel
              traceId={result?.traceId}
              observationId={result?.observationId}
              generationId={result?.generationId}
              cached={result?.cached}
              ids={[{ label: 'summaryId', value: result?.summaryId }]}
            />
          </div>
        </Card>
      )}

      {result?.summary && (
        <Card className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Summary</h3>
          <p className="whitespace-pre-line rounded-md bg-indigo-50 p-3 text-sm text-slate-700">
            {result.summary}
          </p>
        </Card>
      )}
    </div>
  );
}
