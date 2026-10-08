import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type AnalysisSummaryResponse, type TestCase, type TestRunResponse } from '../../api';
import { Badge } from '../../components/badges';
import { ObservabilityPanel } from '../../components/ObservabilityPanel';
import { EmptyState, ErrorState, Loading } from '../../components/states';
import { Button, Card, Field, Modal, PageHeader, Select } from '../../components/ui';
import { PerformanceTestDialog } from '../perf/PerformanceTestDialog';
import { PerfRunResultCard } from '../perf/PerfRunResultCard';

const ENVIRONMENTS = [
  { id: 'dev', name: 'dev' },
  { id: 'stage', name: 'stage' },
  { id: 'prod', name: 'prod' },
];

interface RunResult {
  test: TestCase;
  term: string;
  resp?: TestRunResponse;
  error?: unknown;
}

function queryFromSpec(test: TestCase): string {
  const spec = test.testSpec as
    | { request?: { query?: unknown } }
    | string
    | undefined;
  // Backend returns testSpec as an object; tolerate a JSON string just in case.
  const request =
    typeof spec === 'string'
      ? (JSON.parse(spec) as { request?: { query?: unknown } }).request
      : spec?.request;
  const query = request?.query;
  return typeof query === 'string' && query.trim() ? query : test.name;
}

export default function RunTestsPage() {
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [environmentId, setEnvironmentId] = useState('');
  const [runResults, setRunResults] = useState<RunResult[]>([]);
  const [aiReports, setAiReports] = useState<Record<string, { resp?: AnalysisSummaryResponse; error?: unknown }>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [perfDialogOpen, setPerfDialogOpen] = useState(false);
  const [perfRunIds, setPerfRunIds] = useState<string[]>([]);

  const testsQ = useQuery({
    queryKey: ['test-cases'],
    queryFn: () => api.listTestCases(),
  });

  const runMut = useMutation({
    mutationFn: async (tests: TestCase[]): Promise<RunResult[]> =>
      Promise.all(
        tests.map(async (t) => {
          const term = queryFromSpec(t);
          try {
            const resp = await api.runTestCase(term, t.id);
            return { test: t, term, resp };
          } catch (error) {
            return { test: t, term, error };
          }
        }),
      ),
    onSuccess: (results) => {
      setRunResults(results);
      setAiReports({});
    },
  });

  const reportMut = useMutation({
    mutationFn: async (results: RunResult[]) => {
      const entries = await Promise.all(
        results
          .filter((r) => r.resp?.analysis)
          .map(async (r): Promise<[string, { resp?: AnalysisSummaryResponse; error?: unknown }]> => {
            try {
              const res = await api.createAnalysisSummary({ analysis: r.resp!.analysis! });
              return [r.test.id, { resp: res }];
            } catch (error) {
              return [r.test.id, { error }];
            }
          }),
      );
      return Object.fromEntries(entries);
    },
    onSuccess: (reports) => {
      setAiReports(reports);
      setReportOpen(true);
    },
  });

  const canStart = selectedTests.size > 0 && !!environmentId && !runMut.isPending;

  function toggleTest(id: string) {
    setSelectedTests((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Run Tests"
        subtitle="Select saved tests and an approved environment. Runs execute asynchronously."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-semibold">Saved tests</h2>
          {testsQ.isLoading && <Loading label="Loading tests…" />}
          {testsQ.isError && <ErrorState error={testsQ.error} onRetry={() => testsQ.refetch()} />}
          {testsQ.data && testsQ.data.length === 0 && (
            <EmptyState title="No saved tests">
              Generate and approve a test first.
            </EmptyState>
          )}
          {testsQ.data && testsQ.data.length > 0 && (
            <ul className="space-y-2">
              {testsQ.data.map((t) => (
                <li key={t.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                      selectedTests.has(t.id) ? 'border-brand-400 bg-brand-50/40' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selectedTests.has(t.id)}
                      onChange={() => toggleTest(t.id)}
                      aria-label={`Select ${t.name}`}
                    />
                    <span className="flex-1">
                      <span className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t.name}</span>
                        <Badge value={t.status} />
                      </span>
                      {t.description && (
                        <span className="mt-0.5 block text-xs text-slate-500">{t.description}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold">Environment</h2>
          <Field label="Execution environment">
            <Select
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
              aria-label="Environment"
            >
              <option value="">Select an environment…</option>
              {ENVIRONMENTS.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <Button
              onClick={() =>
                runMut.mutate(
                  (testsQ.data ?? []).filter((t) => selectedTests.has(t.id)),
                )
              }
              disabled={!canStart}
            >
              {runMut.isPending ? 'Running…' : `Start run (${selectedTests.size} test${selectedTests.size === 1 ? '' : 's'})`}
            </Button>
            <Button
              variant="secondary"
              className="ml-2"
              onClick={() => setPerfDialogOpen(true)}
              disabled={selectedTests.size === 0}
            >
              Performance test
            </Button>
            {runMut.isError && (
              <div className="mt-3">
                <ErrorState error={runMut.error} />
              </div>
            )}
          </div>
        </Card>
      </div>

      {runResults.length > 0 && (
        <Card className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Run results</h2>
            {runResults.some((r) => r.resp?.analysis) && (
              <Button
                onClick={() =>
                  Object.keys(aiReports).length > 0
                    ? setReportOpen(true)
                    : reportMut.mutate(runResults)
                }
                disabled={reportMut.isPending}
              >
                {reportMut.isPending ? 'Generating…' : 'AI report'}
              </Button>
            )}
          </div>
          <ul className="space-y-4">
            {runResults.map((r) => (
              <li key={r.test.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.test.name}</span>
                  <span className="flex items-center gap-2">
                    {r.resp?.evaluation && (
                      <Badge
                        value={r.resp.evaluation.passed ? 'pass' : 'fail'}
                        label={r.resp.evaluation.passed ? 'PASSED' : 'FAILED'}
                      />
                    )}
                    {r.resp && <Badge value={r.resp.httpStatus === 200 ? 'approved' : 'failed'} label={`HTTP ${r.resp.httpStatus}`} />}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  term: <span className="font-mono">{r.term}</span>
                  {r.resp && (
                    <> · {r.resp.result.numberOfProducts} product{r.resp.result.numberOfProducts === 1 ? '' : 's'}</>
                  )}
                </p>
                {r.resp?.evaluation && (
                  <div
                    className={`mt-2 rounded-md border p-3 ${
                      r.resp.evaluation.passed
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <h3
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        r.resp.evaluation.passed ? 'text-emerald-800' : 'text-red-800'
                      }`}
                    >
                      Evaluation — {r.resp.evaluation.passed ? 'passed' : 'failed'}
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {r.resp.evaluation.checks.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Badge value={c.passed ? 'pass' : 'fail'} label={c.passed ? '✓' : '✗'} />
                          <span className="flex-1 text-slate-700">
                            {c.description}
                            <span className="ml-2 text-xs text-slate-500">
                              expected <span className="font-mono">{JSON.stringify(c.expected)}</span>
                              {' · '}actual <span className="font-mono">{JSON.stringify(c.actual)}</span>
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.resp?.analysis && (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Analysis
                      <span className="ml-2 font-normal normal-case text-slate-500">
                        {r.resp.analysis.analyzedProducts} of {r.resp.analysis.totalProducts} products analyzed
                      </span>
                    </h3>
                    {r.resp.analysis.findings.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No findings.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {r.resp.analysis.findings.map((f, i) => {
                          const knownKeys = new Set(['type', 'severity', 'count', 'reason', 'details']);
                          const extras = Object.entries(f).filter(([k]) => !knownKeys.has(k));
                          return (
                            <li key={i} className="rounded-md border border-slate-200 bg-white p-2.5">
                              <div className="flex items-center gap-2">
                                <Badge
                                  value={f.severity === 'WARNING' ? 'inconclusive' : f.severity === 'INFO' ? 'queued' : 'fail'}
                                  label={f.severity}
                                />
                                <span className="text-sm font-medium text-slate-800">
                                  {f.type.replace(/_/g, ' ')}
                                </span>
                                {f.count != null && (
                                  <span className="text-xs text-slate-500">× {f.count}</span>
                                )}
                              </div>
                              {f.reason && <p className="mt-1 text-xs text-slate-500">{f.reason}</p>}
                              {extras.length > 0 && (
                                <dl className="mt-1.5 space-y-0.5">
                                  {extras.map(([k, v]) => (
                                    <div key={k} className="flex gap-2 text-xs">
                                      <dt className="font-medium text-slate-600">{k}</dt>
                                      <dd className="font-mono text-slate-500">
                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              )}
                              {f.details && f.details.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5">
                                  {f.details.map((d, j) => (
                                    <li key={j} className="flex flex-wrap items-center gap-x-2 text-xs">
                                      {d.sku != null && (
                                        <span className="font-mono font-medium text-slate-700">{d.sku}</span>
                                      )}
                                      {Object.entries(d)
                                        .filter(([k]) => k !== 'sku')
                                        .map(([k, v]) => (
                                          <span key={k} className="text-slate-500">
                                            {k === 'reason' ? String(v) : `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`}
                                          </span>
                                        ))}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {r.error ? (
                  <div className="mt-2">
                    <ErrorState error={r.error} />
                  </div>
                ) : (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">
                    {JSON.stringify(r.resp, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {perfRunIds.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-base font-semibold">Performance runs</h2>
          {perfRunIds.map((id) => (
            <PerfRunResultCard key={id} runId={id} />
          ))}
        </div>
      )}

      {perfDialogOpen && (
        <PerformanceTestDialog
          tests={(testsQ.data ?? []).filter((t) => selectedTests.has(t.id))}
          onClose={() => setPerfDialogOpen(false)}
          onCreated={(run) => {
            setPerfDialogOpen(false);
            setPerfRunIds((ids) => [run.id, ...ids]);
          }}
        />
      )}

      {reportOpen && (
        <Modal title="AI report" onClose={() => setReportOpen(false)}>
          <ul className="space-y-4">
            {runResults
              .filter((r) => aiReports[r.test.id])
              .map((r) => (
                <li key={r.test.id}>
                  <p className="text-sm font-medium text-slate-900">{r.test.name}</p>
                  {aiReports[r.test.id].resp ? (
                    <>
                      <p className="mt-1 whitespace-pre-line rounded-md bg-indigo-50 p-2.5 text-sm text-slate-700">
                        {aiReports[r.test.id].resp!.summary}
                      </p>
                      <div className="mt-2">
                        <ObservabilityPanel
                          traceId={aiReports[r.test.id].resp!.traceId}
                          observationId={aiReports[r.test.id].resp!.observationId}
                          generationId={aiReports[r.test.id].resp!.generationId}
                          cached={aiReports[r.test.id].resp!.cached}
                          similarity={aiReports[r.test.id].resp!.similarity}
                          matchType={aiReports[r.test.id].resp!.matchType}
                          matchedLabel="matchedReportId"
                          matchedId={aiReports[r.test.id].resp!.matchedReportId}
                          ids={[{ label: 'summaryId', value: aiReports[r.test.id].resp!.summaryId }]}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="mt-1">
                      <ErrorState error={aiReports[r.test.id].error} />
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
