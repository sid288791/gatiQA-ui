import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type TestRunHistoryEntry } from '../../api';
import { Badge } from '../../components/badges';
import { ChartLegend, DonutChart, StackedBarHorizontal, type ChartSegment } from '../../components/charts';
import { EmptyState, ErrorState, Loading } from '../../components/states';
import { Card, PageHeader } from '../../components/ui';
import { PERF_STATUS_BADGE, PERF_STATUS_LABEL, PerfRunResultCard } from '../perf/PerfRunResultCard';

const STATUS_COLORS: Record<string, string> = {
  PASSED: '#10b981',
  FAILED: '#ef4444',
  INCONCLUSIVE: '#f59e0b',
  ERROR: '#64748b',
};

function statusBadgeValue(status: string): string {
  switch (status) {
    case 'PASSED':
      return 'pass';
    case 'FAILED':
      return 'fail';
    case 'ERROR':
      return 'error';
    default:
      return 'inconclusive';
  }
}

function checksSummary(r: TestRunHistoryEntry): string {
  if (!r.checks || r.checks.length === 0) return '—';
  const passed = r.checks.filter((c) => c.passed).length;
  return `${passed}/${r.checks.length} checks`;
}

type HistoryTab = 'functional' | 'performance';

export default function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>('functional');
  // Each dataset fetches only when its tab is selected.
  const dashboardQ = useQuery({
    queryKey: ['dashboard'], queryFn: api.getDashboard, enabled: tab === 'functional',
  });
  const historyQ = useQuery({
    queryKey: ['test-runs', 'history'], queryFn: api.listTestRunHistory, enabled: tab === 'functional',
  });
  const perfQ = useQuery({
    queryKey: ['perf-runs', 'history'], queryFn: api.listPerfRuns, enabled: tab === 'performance',
  });
  const [expandedPerfId, setExpandedPerfId] = useState<string | null>(null);

  const d = dashboardQ.data;
  const history = historyQ.data ?? [];

  const runSegments: ChartSegment[] = useMemo(
    () => [
      { label: 'Passed', value: d?.runs.passed ?? 0, color: STATUS_COLORS.PASSED },
      { label: 'Failed', value: d?.runs.failed ?? 0, color: STATUS_COLORS.FAILED },
      { label: 'Inconclusive', value: d?.runs.inconclusive ?? 0, color: STATUS_COLORS.INCONCLUSIVE },
      { label: 'Error', value: d?.runs.error ?? 0, color: STATUS_COLORS.ERROR },
    ],
    [d],
  );

  const testCaseSegments: ChartSegment[] = useMemo(
    () => [
      { label: 'Ready', value: d?.testCases.ready ?? 0, color: '#3b82f6' },
      { label: 'Draft', value: d?.testCases.draft ?? 0, color: '#f59e0b' },
      { label: 'Archived', value: d?.testCases.archived ?? 0, color: '#94a3b8' },
    ],
    [d],
  );

  const passRate = d && d.runs.total > 0 ? Math.round((d.runs.passed / d.runs.total) * 100) : null;
  const avgDuration =
    history.length > 0
      ? Math.round(history.reduce((s, r) => s + r.durationMs, 0) / history.length)
      : null;

  return (
    <div>
      <PageHeader title="History" subtitle="Test run history and evaluation outcomes." />

      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        {(['functional', 'performance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'functional' ? 'Functional tests' : 'Performance tests'}
          </button>
        ))}
      </div>

      {tab === 'functional' && (
      <>
      {dashboardQ.isError && <ErrorState error={dashboardQ.error} onRetry={() => dashboardQ.refetch()} />}

      <Card className="mb-5">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:divide-x xl:divide-slate-100">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Run outcomes
            </h3>
            <div className="flex items-center gap-4">
              <DonutChart
                segments={runSegments}
                size={104}
                strokeWidth={14}
                centerLabel={d ? String(d.runs.total) : '—'}
                centerSub="runs"
              />
              <div className="flex-1">
                <ChartLegend segments={runSegments} compact />
                <span className="sr-only" data-testid="summary-passed">{d?.runs.passed ?? '—'}</span>
                <span className="sr-only" data-testid="summary-failed">{d?.runs.failed ?? '—'}</span>
              </div>
            </div>
          </section>

          <section className="xl:pl-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Test cases
            </h3>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900" data-testid="summary-test-cases">
                {d?.testCases.total ?? '—'}
              </span>
              <span className="text-xs text-slate-500">total · {d?.testCases.active ?? '—'} active</span>
            </div>
            <StackedBarHorizontal segments={testCaseSegments} />
            <div className="mt-2.5">
              <ChartLegend segments={testCaseSegments} compact />
            </div>
          </section>

          <section className="xl:pl-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pass rate
            </h3>
            <span className="text-3xl font-semibold text-slate-900">
              {passRate === null ? '—' : `${passRate}%`}
            </span>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Total runs</dt>
                <dd className="font-medium text-slate-900" data-testid="summary-total-runs">
                  {d?.runs.total ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Avg duration</dt>
                <dd className="font-medium text-slate-900">
                  {avgDuration === null ? '—' : `${avgDuration} ms`}
                </dd>
              </div>
            </dl>
          </section>

        </div>
      </Card>

      {historyQ.isLoading && <Loading label="Loading run history…" />}
      {historyQ.isError && <ErrorState error={historyQ.error} onRetry={() => historyQ.refetch()} />}

      {historyQ.data && historyQ.data.length === 0 && (
        <EmptyState title="No runs yet">
          Run tests from the Run Tests page to see results here.
        </EmptyState>
      )}

      {historyQ.data && historyQ.data.length > 0 && (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Test case</th>
                <th className="px-4 py-2.5">Term</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">HTTP</th>
                <th className="px-4 py-2.5">Results</th>
                <th className="px-4 py-2.5">Checks</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Ran at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyQ.data.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    {r.testCaseName ?? <span className="text-slate-400">ad-hoc</span>}
                    {r.errorMessage && (
                      <p className="mt-0.5 text-xs text-red-600">{r.errorMessage}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.term}</td>
                  <td className="px-4 py-2.5">
                    <Badge value={statusBadgeValue(r.status)} label={r.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.httpStatus}</td>
                  <td className="px-4 py-2.5">{r.resultCount}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{checksSummary(r)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.durationMs} ms</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      </>
      )}

      {tab === 'performance' && (
      <>
      {perfQ.isLoading && <Loading label="Loading performance runs…" />}
      {perfQ.isError && <ErrorState error={perfQ.error} onRetry={() => perfQ.refetch()} />}

      {perfQ.data && perfQ.data.length === 0 && (
        <EmptyState title="No performance runs yet">
          Launch a performance test from the Run Tests page to see results here.
        </EmptyState>
      )}

      {perfQ.data && perfQ.data.length > 0 && (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Engine</th>
                <th className="px-4 py-2.5">Load</th>
                <th className="px-4 py-2.5">Targets</th>
                <th className="px-4 py-2.5">Ran at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perfQ.data.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedPerfId(expandedPerfId === r.id ? null : r.id)}
                  >
                    <td className="px-4 py-2.5">
                      {r.name}
                      {r.errorMessage && (
                        <p className="mt-0.5 text-xs text-red-600">{r.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge value={PERF_STATUS_BADGE[r.status]} label={PERF_STATUS_LABEL[r.status]} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.engine}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {r.concurrentUsers} VUs ·{' '}
                      {r.iterations != null ? `${r.iterations} iterations` : `${r.durationSeconds}s`}
                    </td>
                    <td className="px-4 py-2.5">{r.targetCount}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                  {expandedPerfId === r.id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-4 py-3">
                        <PerfRunResultCard runId={r.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
