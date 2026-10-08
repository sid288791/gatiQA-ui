/**
 * Synthetic in-memory backend for development and e2e tests.
 * Active ONLY when VITE_USE_FIXTURES=true (see src/api/index.ts).
 * Implements the same GatiQaApi contract as the real HTTP client.
 */
import { ApiError } from './client';
import type {
  AnalysisSummaryRequest,
  AnalysisSummaryResponse,
  ClarifyRequest,
  CreateTestCaseRequest,
  DashboardResponse,
  EvaluationProfile,
  Evaluator,
  EvaluatorCatalogEntry,
  GatiQaApi,
  ListTestCasesParams,
  PerfRunDetailResponse,
  PerfRunRequest,
  PerfRunSummaryResponse,
  ProfileDetail,
  ProfileSummary,
  ProfileVersion,
  ProfileVersionInput,
  TestCase,
  TestGenerationRequest,
  TestGenerationResponse,
  TestRunHistoryEntry,
  TestRunResponse,
  DashboardData,
} from './types';

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}-${Math.random().toString(36).slice(2, 7)}`;

function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, { code, message }, message);
}

// ---- Fixture data -----------------------------------------------------------

const evaluators: Evaluator[] = [
  {
    id: 'eval-accuracy',
    name: 'Answer Accuracy',
    version: '1.2.0',
    description: 'Compares actual output against expected answer.',
    configSchema: [
      { key: 'matchMode', label: 'Match mode', type: 'select', required: true, options: ['exact', 'semantic'], default: 'semantic' },
      { key: 'caseSensitive', label: 'Case sensitive', type: 'boolean', required: false, default: false },
    ],
  },
  {
    id: 'eval-latency',
    name: 'Latency Budget',
    version: '0.9.1',
    description: 'Fails responses slower than the configured budget.',
    configSchema: [
      { key: 'maxLatencyMs', label: 'Max latency (ms)', type: 'number', required: true },
    ],
  },
  {
    id: 'eval-safety',
    name: 'Safety Screen',
    version: '2.0.0',
    description: 'Detects unsafe or policy-violating output.',
    configSchema: [
      { key: 'policyPack', label: 'Policy pack', type: 'string', required: true },
    ],
  },
  {
    id: 'eval-schema',
    name: 'Schema Conformance',
    version: '1.0.3',
    description: 'Validates output structure against a JSON schema.',
    configSchema: [
      { key: 'schema', label: 'JSON schema', type: 'string', required: true, description: 'JSON Schema the output must satisfy.' },
      { key: 'strict', label: 'Strict mode', type: 'boolean', required: false, default: true },
    ],
  },
];

const profiles: ProfileDetail[] = [
  {
    id: 'prof-support',
    name: 'Support Agent Quality',
    description: 'Baseline quality gate for the support agent.',
    versions: [
      {
        version: 2,
        createdAt: '2026-09-10T09:30:00Z',
        createdBy: 'qa-lead@gatiqa.dev',
        passThreshold: 0.8,
        inconclusiveThreshold: 0.5,
        evaluators: [
          { evaluatorId: 'eval-accuracy', weight: 60, config: { matchMode: 'semantic', caseSensitive: false } },
          { evaluatorId: 'eval-safety', weight: 40, config: { policyPack: 'default' } },
        ],
      },
      {
        version: 1,
        createdAt: '2026-09-01T14:00:00Z',
        createdBy: 'qa-lead@gatiqa.dev',
        passThreshold: 0.7,
        evaluators: [{ evaluatorId: 'eval-accuracy', weight: 100, config: { matchMode: 'exact' } }],
      },
    ],
  },
];

const testCases: TestCase[] = [];
const testRunHistory: TestRunHistoryEntry[] = [];
const perfRuns = new Map<string, { req: PerfRunRequest; createdAt: number; id: string }>();

const drafts = new Map<string, TestGenerationResponse & { _input: string; _profileId: string; _version: number }>();
let currentDraftId: string | null = null;

// ---- Helpers ----------------------------------------------------------------

function validateProfileInput(input: ProfileVersionInput) {
  const total = input.evaluators.reduce((s, e) => s + e.weight, 0);
  if (input.evaluators.length === 0) fail(400, 'VALIDATION_FAILED', 'At least one evaluator is required.');
  if (Math.abs(total - 100) > 0.001) {
    fail(400, 'VALIDATION_FAILED', `Total evaluator weight must equal 100 (got ${total}).`);
  }
  for (const e of input.evaluators) {
    const ev = evaluators.find((x) => x.id === e.evaluatorId);
    if (!ev) fail(400, 'VALIDATION_FAILED', `Unknown evaluator ${e.evaluatorId}.`);
    for (const field of ev!.configSchema) {
      const v = e.config?.[field.key];
      if (field.required && (v === undefined || v === null || v === '')) {
        fail(400, 'VALIDATION_FAILED', `Missing required config "${field.key}" for ${ev!.name}.`);
      }
    }
  }
  if (input.passThreshold < 0 || input.passThreshold > 1) {
    fail(400, 'VALIDATION_FAILED', 'passThreshold must be between 0 and 1.');
  }
}

function toSummary(p: ProfileDetail): ProfileSummary {
  const latest = p.versions[0];
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    latestVersion: latest.version,
    versionCount: p.versions.length,
    updatedAt: latest.createdAt,
  };
}

function buildDraftResponse(
  req: TestGenerationRequest,
  clarifications: TestGenerationResponse['clarifications'],
  missing: TestGenerationResponse['missingExpectations'],
  status: TestGenerationResponse['status'],
): TestGenerationResponse & { _input: string; _profileId: string; _version: number } {
  const appliedDefaults = Object.entries(req.approvedDefaults ?? {}).map(([field, value]) => ({
    field,
    value,
  }));
  return {
    status,
    draft: {
      request: { query: req.input },
      expectations: {
        products: [
          {
            sku: 'SKU-100',
            maximumRank: 3,
            price: { value: '99.99', currency: 'USD', tolerance: '0.01' },
            badges: [],
          },
        ],
      },
      clarifications: [],
    },
    appliedDefaults,
    clarifications,
    missingExpectations: missing,
    validationIssues: [],
    metadata: {
      provider: 'openaichat',
      model: 'qwen3:4b',
      promptVersion: '2026-09.1',
    },
    traceId: nextId('trace').replace(/[^a-z0-9]/gi, '').padEnd(32, '0').slice(0, 32),
    observationId: nextId('obs'),
    generationId: nextId('gen'),
    testCaseId: nextId('tc'),
    _input: req.input,
    _profileId: req.profile?.profileId ?? '',
    _version: req.profile?.version ?? 0,
  };
}

// ---- API implementation -----------------------------------------------------

export const fixtureApi: GatiQaApi = {
  async listEvaluators() {
    await delay();
    return evaluators;
  },

  async listProfiles() {
    await delay();
    return profiles.map(toSummary);
  },

  async getProfile(profileId) {
    await delay();
    const p = profiles.find((x) => x.id === profileId);
    if (!p) fail(404, 'NOT_FOUND', `Profile ${profileId} not found.`);
    return p!;
  },

  async createProfile(input) {
    await delay();
    if (!input.name?.trim()) fail(400, 'VALIDATION_FAILED', 'Profile name is required.');
    validateProfileInput(input);
    const p: ProfileDetail = {
      id: nextId('prof'),
      name: input.name!.trim(),
      description: input.description ?? '',
      versions: [
        {
          version: 1,
          createdAt: now(),
          createdBy: 'fixtures@gatiqa.dev',
          evaluators: input.evaluators,
          passThreshold: input.passThreshold,
          inconclusiveThreshold: input.inconclusiveThreshold,
        },
      ],
    };
    profiles.unshift(p);
    return p;
  },

  async createProfileVersion(profileId, input) {
    await delay();
    const p = profiles.find((x) => x.id === profileId);
    if (!p) fail(404, 'NOT_FOUND', `Profile ${profileId} not found.`);
    validateProfileInput(input);
    const v: ProfileVersion = {
      version: p.versions[0].version + 1,
      createdAt: now(),
      createdBy: 'fixtures@gatiqa.dev',
      evaluators: input.evaluators,
      passThreshold: input.passThreshold,
      inconclusiveThreshold: input.inconclusiveThreshold,
    };
    p.versions.unshift(v);
    return v;
  },

  async generateTestDraft(req: TestGenerationRequest) {
    await delay(300);
    if (!req.input.trim()) fail(400, 'VALIDATION_FAILED', 'Input is required.');
    if (req.profile) {
      const profile = profiles.find((p) => p.id === req.profile!.profileId);
      if (!profile) fail(400, 'VALIDATION_FAILED', 'Unknown profile.');
      if (!profile.versions.some((v) => v.version === req.profile!.version)) {
        fail(400, 'VALIDATION_FAILED', `Profile ${req.profile!.profileId} has no version ${req.profile!.version}.`);
      }
    }
    const draftId = nextId('draft');
    currentDraftId = draftId;
    const resp = buildDraftResponse(
      req,
      [
        {
          id: 'q-env-behavior',
          question: 'Should the test assert on response time as well as content?',
          field: 'expectations',
          options: ['Content only', 'Content + latency'],
        },
        {
          id: 'q-locale',
          question: 'Which locale should the response be evaluated in?',
          options: ['en-US', 'auto-detect'],
        },
      ],
      [{ id: 'me-1', hint: 'No expectation covers error handling when the target system is unavailable.', suggestedKind: 'custom' }],
      'NEEDS_CLARIFICATION',
    );
    drafts.set(draftId, resp);
    return resp;
  },

  async clarifyTestDraft(draftId, req: ClarifyRequest) {
    await delay(250);
    const id = currentDraftId ?? draftId;
    const draft = drafts.get(id);
    if (!draft) fail(404, 'NOT_FOUND', `Draft ${draftId} not found.`);
    const unanswered = draft.clarifications.filter(
      (c) => !req.answers.some((a) => a.questionId === c.id && a.answer.trim()),
    );
    const revised: TestGenerationResponse & { _input: string; _profileId: string; _version: number } = {
      ...draft,
      clarifications: unanswered,
      status: unanswered.length === 0 ? 'READY_FOR_REVIEW' : 'NEEDS_CLARIFICATION',
    };
    drafts.set(draftId, revised);
    return revised;
  },

  async createTestCase(req: CreateTestCaseRequest): Promise<TestCase> {
    await delay();
    const ts = now();
    const tc: TestCase = {
      id: nextId('tc'),
      name: req.name,
      description: req.description,
      testSpec: req.test_spec,
      evaluationProfileId: req.evaluation_profile_id ?? null,
      evaluationProfileName: null,
      status: 'READY',
      createdBy: req.created_by,
      createdAt: ts,
      updatedAt: ts,
    };
    testCases.unshift(tc);
    return tc;
  },

  async listTestCases(params: ListTestCasesParams = {}): Promise<TestCase[]> {
    await delay();
    let items = [...testCases];
    if (params.status) items = items.filter((t) => t.status === params.status);
    if (params.profileId)
      items = items.filter((t) => t.evaluationProfileId === params.profileId);
    return items;
  },

  async getTestCase(id: string): Promise<TestCase> {
    await delay();
    const t = testCases.find((x) => x.id === id);
    if (!t) fail(404, 'NOT_FOUND', `Test case ${id} not found.`);
    return t;
  },

  async updateTestCase(id: string, req: Partial<CreateTestCaseRequest>): Promise<TestCase> {
    await delay();
    const i = testCases.findIndex((x) => x.id === id);
    if (i < 0) fail(404, 'NOT_FOUND', `Test case ${id} not found.`);
    const prev = testCases[i];
    const updated: TestCase = {
      ...prev,
      name: req.name ?? prev.name,
      description: req.description ?? prev.description,
      testSpec: req.test_spec ?? prev.testSpec,
      evaluationProfileId: req.evaluation_profile_id ?? prev.evaluationProfileId,
      updatedAt: now(),
    };
    testCases[i] = updated;
    return updated;
  },

  async deleteTestCase(id: string): Promise<void> {
    await delay();
    const i = testCases.findIndex((x) => x.id === id);
    if (i < 0) fail(404, 'NOT_FOUND', `Test case ${id} not found.`);
    testCases.splice(i, 1);
  },

  async runTestCase(term: string, testCaseId?: string): Promise<TestRunResponse> {
    await delay();
    const testCase = testCaseId ? testCases.find((t) => t.id === testCaseId) : undefined;
    const evaluation = testCaseId
      ? {
          testCaseId,
          testCaseName: testCase?.name ?? '',
          passed: true,
          checks: [],
        }
      : undefined;
    testRunHistory.unshift({
      id: nextId('run'),
      testCaseId: testCaseId ?? null,
      testCaseName: testCase?.name ?? null,
      term,
      status: evaluation ? 'PASSED' : 'INCONCLUSIVE',
      httpStatus: 200,
      resultCount: 0,
      checks: evaluation?.checks ?? null,
      errorMessage: null,
      durationMs: 120,
      createdAt: now(),
    });
    return {
      term,
      httpStatus: 200,
      result: { numberOfProducts: 0, products: [] },
      evaluation,
      analysis: {
        totalProducts: 0,
        analyzedProducts: 0,
        findings: [
          {
            type: 'NOT_SHIPPABLE',
            severity: 'WARNING',
            count: 2,
            reason: 'shippable=false (hazmat or shipping restriction)',
            details: [
              { sku: 'A1214', reason: 'hazmat' },
              { sku: 'G7014J', reason: 'hazmat' },
            ],
          },
        ],
      },
    };
  },

  async createAnalysisSummary(req: AnalysisSummaryRequest): Promise<AnalysisSummaryResponse> {
    await delay();
    const traceId = nextId('trace').replace(/[^a-z0-9]/gi, '').padEnd(32, '0').slice(0, 32);
    const observationId = nextId('obs');
    const summaryId = nextId('sum');
    const requestId = nextId('req');

    const dashboardTotals = {
      totalRequests: 42,
      failedRequests: 3,
      cacheHits: 9,
      fallbackRequests: 2,
      llmCalls: 36,
      embeddingCalls: 38,
      retries: 3,
      inputTokens: 10200,
      outputTokens: 5100,
      totalTokens: 15300,
      knownTotalTokens: 15300,
      requestsWithUnknownTokens: 0,
      totalCostUsd: 0.01824,
      knownCostUsd: 0.01824,
      requestsWithUnknownCost: 0,
      currency: 'USD',
      averageLatencyMs: 1840.42,
      p50LatencyMs: 1725.55,
      p95LatencyMs: 3120.8,
      errorRate: 0.07143,
      cacheHitRate: 0.21429,
    };

    const dashboard: DashboardData = {
      available: true,
      unavailableReason: null,
      fromTime: req.fromTime ?? '2026-09-13T14:00:03.101223Z',
      toTime: req.toTime ?? '2026-09-20T14:00:03.101223Z',
      operation: req.operation ?? null,
      limit: req.limit ?? 5,
      offset: req.offset ?? 0,
      hasMore: true,
      totals: dashboardTotals,
      byOperation: {
        'analysis-summary': {
          totalRequests: 25,
          failedRequests: 2,
          cacheHits: 7,
          fallbackRequests: 2,
          llmCalls: 20,
          embeddingCalls: 22,
          retries: 2,
          inputTokens: 6200,
          outputTokens: 3000,
          totalTokens: 9200,
          knownTotalTokens: 9200,
          totalCostUsd: 0.0106,
          knownCostUsd: 0.0106,
          averageLatencyMs: 1600.2,
          p50LatencyMs: 1500.4,
          p95LatencyMs: 2800.9,
          errorRate: 0.08,
          cacheHitRate: 0.28,
        },
        'test-generation': {
          totalRequests: 17,
          failedRequests: 1,
          cacheHits: 2,
          fallbackRequests: 0,
          llmCalls: 16,
          embeddingCalls: 16,
          retries: 1,
          inputTokens: 4000,
          outputTokens: 2100,
          totalTokens: 6100,
          knownTotalTokens: 6100,
          totalCostUsd: 0.00764,
          knownCostUsd: 0.00764,
          averageLatencyMs: 2200.6,
          p50LatencyMs: 2050.1,
          p95LatencyMs: 3500.4,
          errorRate: 0.05882,
          cacheHitRate: 0.11765,
        },
      },
      traces: [
        {
          requestId,
          operation: 'analysis-summary',
          provider: 'ollama',
          model: 'qwen3:4b',
          startedAt: '2026-09-20T14:00:01.123456Z',
          completedAt: '2026-09-20T14:00:03.004512Z',
          latencyMs: 1881.06,
          status: 'success',
          source: 'llm',
          cached: false,
          llmCalls: 1,
          embeddingCalls: 1,
          inputTokens: 120,
          outputTokens: 50,
          totalTokens: 170,
          totalCostUsd: 0.00042,
          costStatus: 'estimated',
        },
      ],
    };

    if (!req.analysis) {
      return { dashboard };
    }

    const a = req.analysis;
    const lines = a.findings.map(
      (f) => `- ${f.severity} ${f.type}: ${f.count ?? 0} products (${f.reason ?? ''})`,
    );
    return {
      summary: `Analyzed ${a.analyzedProducts} of ${a.totalProducts} products.${
        lines.length ? `\n${lines.join('\n')}` : ''
      }`,
      summaryId,
      traceId,
      observationId,
      generationId: nextId('gen'),
      cached: false,
      metrics: {
        requestId,
        operation: 'analysis-summary',
        provider: 'ollama',
        model: 'qwen3:4b',
        promptVersion: '2026-09.1',
        traceId,
        observationId,
        summaryId,
        testCaseId: null,
        startedAt: '2026-09-20T14:00:01.123456Z',
        completedAt: '2026-09-20T14:00:03.004512Z',
        latencyMs: 1881.06,
        status: 'success',
        errorType: null,
        source: 'llm',
        cached: false,
        fallbackReason: null,
        llmCalls: 1,
        embeddingCalls: 1,
        retries: 0,
        inputTokens: 120,
        outputTokens: 50,
        totalTokens: 170,
        knownTotalTokens: 170,
        costStatus: 'estimated',
        totalCostUsd: 0.00042,
        knownCostUsd: 0.00042,
        currency: 'USD',
        observations: [
          {
            id: nextId('obs'),
            name: 'canonicalization',
            kind: 'span',
            startedAt: '2026-09-20T14:00:01.124455Z',
            latencyMs: 0.21,
            status: 'success',
            observationId: nextId('obs'),
            metadata: { inputChars: 421 },
          },
          {
            id: nextId('obs'),
            name: 'embedding',
            kind: 'embedding',
            startedAt: '2026-09-20T14:00:01.130020Z',
            latencyMs: 58.19,
            status: 'success',
            model: 'nomic-embed-text',
            provider: 'ollama',
            inputTokens: 20,
            outputTokens: 0,
            totalTokens: 20,
            totalCostUsd: 0.00002,
            metadata: {},
          },
          {
            id: nextId('obs'),
            name: 'llm_summarize',
            kind: 'generation',
            startedAt: '2026-09-20T14:00:01.305412Z',
            latencyMs: 1650.43,
            status: 'success',
            generationId: nextId('gen'),
            model: 'qwen3:4b',
            provider: 'ollama',
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            totalCostUsd: 0.0004,
            outputTokensPerSecond: 100,
            metadata: { operation: 'analysis-summary', promptVersion: '2026-09.1', jsonMode: false },
          },
        ],
        metadata: {
          operation: 'analysis-summary',
          provider: 'ollama',
          model: 'qwen3:4b',
          promptVersion: '2026-09.1',
          summaryId,
        },
      },
      metricsPersisted: true,
      dashboard,
    };
  },

  async listEvaluationProfiles(): Promise<EvaluationProfile[]> {
    await delay();
    return profiles.flatMap((p) =>
      p.versions.map((v) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        passThreshold: v.passThreshold,
        evaluators: v.evaluators.map((e) => ({
          evaluatorType: e.evaluatorId,
          displayName: e.evaluatorId,
          enabled: true,
          weight: e.weight,
          configuration: e.config,
        })),
        createdAt: v.createdAt,
        updatedAt: v.createdAt,
      })),
    );
  },

  async getEvaluationProfile(id: string): Promise<EvaluationProfile> {
    await delay();
    const all = await this.listEvaluationProfiles();
    const p = all.find((x) => x.id === id);
    if (!p) fail(404, 'NOT_FOUND', `Evaluation profile ${id} not found.`);
    return p;
  },

  async listEvaluatorCatalog(): Promise<EvaluatorCatalogEntry[]> {
    await delay();
    return evaluators.map((e) => ({
      evaluatorType: e.id,
      displayName: e.name,
      description: e.description,
      configuration: {},
    }));
  },

  async getDashboard(): Promise<DashboardResponse> {
    await delay();
    const count = (status: string) =>
      testCases.filter((t) => t.status === status).length;
    const runCount = (status: string) =>
      testRunHistory.filter((r) => r.status === status).length;
    return {
      testCases: {
        total: testCases.length,
        draft: count('DRAFT'),
        ready: count('READY'),
        archived: count('ARCHIVED'),
        active: testCases.filter((t) => t.status !== 'ARCHIVED').length,
      },
      runs: {
        total: testRunHistory.length,
        passed: runCount('PASSED'),
        failed: runCount('FAILED'),
        inconclusive: runCount('INCONCLUSIVE'),
        error: runCount('ERROR'),
      },
      recentRuns: testRunHistory.slice(0, 5),
    };
  },

  async listTestRunHistory(): Promise<TestRunHistoryEntry[]> {
    await delay();
    return testRunHistory;
  },

  // ---- Performance testing (gatiQA-perf-api fixtures) ----------------------

  async createPerfRun(req: PerfRunRequest): Promise<PerfRunDetailResponse> {
    await delay();
    if (!req.targets?.length) fail(400, 'VALIDATION_FAILED', 'At least one target is required.');
    const id = nextId('perf');
    perfRuns.set(id, { req, createdAt: Date.now(), id });
    return toPerfRunDetail(perfRuns.get(id)!);
  },

  async listPerfRuns(): Promise<PerfRunSummaryResponse[]> {
    await delay();
    return [...perfRuns.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => toPerfRunSummary(toPerfRunDetail(r)));
  },

  async getPerfRun(id: string): Promise<PerfRunDetailResponse> {
    await delay();
    const r = perfRuns.get(id);
    if (!r) fail(404, 'NOT_FOUND', `Performance run ${id} not found.`);
    return toPerfRunDetail(r);
  },

  async listPerfEngineTools(): Promise<string[]> {
    await delay();
    return ['validate_script', 'run_script'];
  },
};

// ---- Perf fixture helpers ---------------------------------------------------

function toPerfRunDetail(r: { req: PerfRunRequest; createdAt: number; id: string }): PerfRunDetailResponse {
  // Simulate lifecycle: QUEUED for ~1.5s, then COMPLETED with synthetic metrics.
  const elapsed = Date.now() - r.createdAt;
  const done = elapsed > 1500;
  const iso = new Date(r.createdAt).toISOString();
  const p95 = r.req.p95ThresholdMs * 0.82;
  const errRate = Math.min(r.req.maxErrorRatePercent * 0.4, 100);
  return {
    id: r.id,
    name: r.req.name ?? `perf-${r.req.concurrentUsers}vu-${r.req.durationSeconds}s`,
    engine: r.req.engine ?? 'k6',
    status: done ? 'COMPLETED' : 'EXECUTING',
    concurrentUsers: r.req.concurrentUsers,
    durationSeconds: r.req.durationSeconds,
    rampUpSeconds: r.req.rampUpSeconds,
    p95ThresholdMs: r.req.p95ThresholdMs,
    maxErrorRatePercent: r.req.maxErrorRatePercent,
    iterations: r.req.iterations ?? null,
    generatedScript: done
      ? `import http from 'k6/http';\nimport { check, sleep } from 'k6';\n\nexport const options = { vus: ${r.req.concurrentUsers}, duration: '${r.req.durationSeconds}s' };\n\nexport default function () {\n  const res = http.get('${(r.req.targets[0]?.apiDefinition?.url as string) ?? 'https://example.test/api'}');\n  check(res, { 'status is 200': (r) => r.status === 200 });\n  sleep(1);\n}`
      : null,
    scriptValidated: done,
    validationMessage: null,
    generationAttempts: done ? 1 : 0,
    errorMessage: null,
    createdBy: r.req.createdBy ?? 'fixtures@gatiqa.dev',
    createdAt: iso,
    startedAt: iso,
    completedAt: done ? new Date(r.createdAt + 1500).toISOString() : null,
    targets: r.req.targets.map((t) => ({
      functionalTestCaseId: t.functionalTestCaseId ?? null,
      functionalTestCaseName: t.functionalTestCaseName ?? null,
      apiDefinition: t.apiDefinition,
    })),
    result: done
      ? {
          id: nextId('perfres'),
          requestsPerSec: 412.6,
          totalRequests: r.req.concurrentUsers * r.req.durationSeconds * 8,
          avgLatencyMs: p95 * 0.55,
          p50LatencyMs: p95 * 0.48,
          p90LatencyMs: p95 * 0.78,
          p95LatencyMs: p95,
          p99LatencyMs: p95 * 1.15,
          errorRatePercent: errRate,
          p95ThresholdPassed: true,
          errorRateThresholdPassed: true,
          overallPassed: true,
          aiSummary: `Fixture summary: ${r.req.concurrentUsers} VUs over ${r.req.durationSeconds}s sustained ~413 req/s with p95 ${Math.round(p95)}ms (under the ${r.req.p95ThresholdMs}ms threshold) and ${errRate.toFixed(2)}% errors. All thresholds passed.`,
          createdAt: new Date(r.createdAt + 1500).toISOString(),
        }
      : null,
    rawStdout: null,
  };
}

function toPerfRunSummary(d: PerfRunDetailResponse): PerfRunSummaryResponse {
  return {
    id: d.id,
    name: d.name,
    engine: d.engine,
    status: d.status,
    concurrentUsers: d.concurrentUsers,
    durationSeconds: d.durationSeconds,
    rampUpSeconds: d.rampUpSeconds,
    p95ThresholdMs: d.p95ThresholdMs,
    maxErrorRatePercent: d.maxErrorRatePercent,
    iterations: d.iterations,
    targetCount: d.targets.length,
    errorMessage: d.errorMessage,
    createdAt: d.createdAt,
    startedAt: d.startedAt,
    completedAt: d.completedAt,
  };
}
