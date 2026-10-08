import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type PerfRunDetailResponse, type PerfRunRequest, type TestCase } from '../../api';
import { config } from '../../config';
import { ErrorState } from '../../components/states';
import { Button, Field, Input, Modal } from '../../components/ui';

interface Props {
  tests: TestCase[];
  onClose: () => void;
  onCreated: (run: PerfRunDetailResponse) => void;
}

/**
 * Request shape mirrors gatiQA-test-api's SearchApiClient: same path, fixed
 * query params and storefront headers, so the load test hits the real search
 * API exactly like a functional run does. `term` comes from the test's
 * testSpec.request.query.
 */
const SEARCH_PATH = '/capi/v55/search';

const SEARCH_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  Referer: 'https://shop.advanceautoparts.com/',
  'Accept-Language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Chromium";v="153", "Not=A?Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

const SEARCH_FIXED_PARAMS: Record<string, string> = {
  'autoCorrectResults[fitmentFilter]': 'true',
  'autoCorrectResults[vehicleSwitching]': 'true',
  'autoCorrectResults[spellingSuggestion]': 'true',
  'autoCorrectResults[preferSpellingSuggestionResults]': 'true',
  order: 'BEST_MATCH',
  count: '18',
  withoutVehicleForInterchangeableParts: 'true',
  interchangePartNumber: '',
  page: '1',
  offset: '0',
};

function queryFromSpec(test: TestCase): string | undefined {
  const spec = test.testSpec as { request?: { query?: unknown } } | undefined;
  const q = spec?.request?.query;
  return typeof q === 'string' && q.trim() ? q.trim() : undefined;
}

/**
 * Builds the free-form apiDefinition for a functional test. For search tests
 * (testSpec.request.query present) it produces a faithful replica of the
 * SearchApiClient request; otherwise the testSpec.request is passed through
 * with the dialog's base URL injected as `url`.
 */
function apiDefinitionFor(test: TestCase, baseUrl: string): Record<string, unknown> {
  const spec = test.testSpec as { request?: Record<string, unknown> } | undefined;
  const request = spec?.request ?? {};
  const term = queryFromSpec(test);
  const base = baseUrl.trim().replace(/\/+$/, '');

  if (term && base) {
    return {
      url: `${base}${SEARCH_PATH}`,
      method: 'GET',
      headers: SEARCH_HEADERS,
      queryParams: { ...SEARCH_FIXED_PARAMS, term },
      // Preserve the raw spec for the LLM's context (expectations etc.).
      functionalRequest: request,
    };
  }

  const def: Record<string, unknown> = { ...request };
  if (base && def.url == null) {
    def.url = base;
  }
  if (def.method == null) {
    def.method = 'GET';
  }
  return def;
}

export function PerformanceTestDialog({ tests, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState(config.searchApiBaseUrl);
  const [concurrentUsers, setConcurrentUsers] = useState('10');
  const [durationSeconds, setDurationSeconds] = useState('30');
  const [rampUpSeconds, setRampUpSeconds] = useState('10');
  const [p95ThresholdMs, setP95ThresholdMs] = useState('500');
  const [maxErrorRatePercent, setMaxErrorRatePercent] = useState('1');
  const [iterations, setIterations] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMut = useMutation({
    mutationFn: (req: PerfRunRequest) => api.createPerfRun(req),
    onSuccess: (run) => onCreated(run),
  });

  function validate(): boolean {
    const e: Record<string, string> = {};
    const vus = Number(concurrentUsers);
    const dur = Number(durationSeconds);
    const ramp = Number(rampUpSeconds);
    const p95 = Number(p95ThresholdMs);
    const err = Number(maxErrorRatePercent);
    if (!Number.isInteger(vus) || vus < 1 || vus > 1000) e.concurrentUsers = '1–1000';
    if (!Number.isInteger(dur) || dur < 1) e.durationSeconds = 'Must be ≥ 1s';
    if (!Number.isInteger(ramp) || ramp < 0) e.rampUpSeconds = 'Must be ≥ 0s';
    if (Number.isInteger(dur) && Number.isInteger(ramp) && dur + ramp > 300) {
      e.durationSeconds = 'duration + ramp-up must be ≤ 300s (engine limit)';
    }
    if (!Number.isInteger(p95) || p95 < 1) e.p95ThresholdMs = 'Must be ≥ 1ms';
    if (Number.isNaN(err) || err < 0 || err > 100) e.maxErrorRatePercent = '0–100';
    if (iterations.trim()) {
      const it = Number(iterations);
      if (!Number.isInteger(it) || it < 1 || it > 100000) e.iterations = '1–100000';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    createMut.mutate({
      name: name.trim() || undefined,
      engine: 'k6',
      targets: tests.map((t) => ({
        functionalTestCaseId: t.id,
        functionalTestCaseName: t.name,
        apiDefinition: apiDefinitionFor(t, baseUrl),
      })),
      concurrentUsers: Number(concurrentUsers),
      durationSeconds: Number(durationSeconds),
      rampUpSeconds: Number(rampUpSeconds),
      p95ThresholdMs: Number(p95ThresholdMs),
      maxErrorRatePercent: Number(maxErrorRatePercent),
      iterations: iterations.trim() ? Number(iterations) : undefined,
    });
  }

  return (
    <Modal title="Performance test" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">
        {tests.length} selected test{tests.length === 1 ? '' : 's'} will be load-tested via k6.
        The AI agent generates, validates and executes the script.
      </p>
      <ul className="mb-4 max-h-28 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
        {tests.map((t) => (
          <li key={t.id} className="truncate text-xs text-slate-600" title={t.name}>
            {t.name}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <Field label="Run name" hint="Optional — defaults to perf-<vus>vu-<duration>s">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="checkout-load-test" />
        </Field>
        <Field
          label="Search API base URL"
          hint="Prefilled from VITE_SEARCH_API_BASE_URL — the same target test-api uses for functional runs"
        >
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/search"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Concurrent users" error={errors.concurrentUsers}>
            <Input
              type="number" min={1} max={1000} value={concurrentUsers}
              onChange={(e) => setConcurrentUsers(e.target.value)}
            />
          </Field>
          <Field label="Duration (s)" error={errors.durationSeconds}>
            <Input
              type="number" min={1} value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
            />
          </Field>
          <Field label="Ramp-up (s)" error={errors.rampUpSeconds}>
            <Input
              type="number" min={0} value={rampUpSeconds}
              onChange={(e) => setRampUpSeconds(e.target.value)}
            />
          </Field>
          <Field label="P95 threshold (ms)" error={errors.p95ThresholdMs}>
            <Input
              type="number" min={1} value={p95ThresholdMs}
              onChange={(e) => setP95ThresholdMs(e.target.value)}
            />
          </Field>
          <Field label="Max error rate (%)" error={errors.maxErrorRatePercent}>
            <Input
              type="number" min={0} max={100} step="0.1" value={maxErrorRatePercent}
              onChange={(e) => setMaxErrorRatePercent(e.target.value)}
            />
          </Field>
          <Field
            label="Max requests"
            hint="Optional hard cap — run stops after N requests regardless of duration"
            error={errors.iterations}
          >
            <Input
              type="number" min={1} max={100000} value={iterations}
              onChange={(e) => setIterations(e.target.value)}
              placeholder="e.g. 10"
            />
          </Field>
        </div>
      </div>

      {createMut.isError && (
        <div className="mt-3">
          <ErrorState error={createMut.error} />
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
        <Button variant="secondary" onClick={onClose} disabled={createMut.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={createMut.isPending}>
          {createMut.isPending ? 'Queuing…' : 'Start performance test'}
        </Button>
      </div>
    </Modal>
  );
}
