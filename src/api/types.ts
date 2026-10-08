import type { components } from './types.gen';

export type ApiErrorBody = components['schemas']['ApiError'];
export type Evaluator = components['schemas']['Evaluator'];
export type EvaluatorConfigField = components['schemas']['EvaluatorConfigField'];
export type ProfileEvaluator = components['schemas']['ProfileEvaluator'];
export type ProfileVersion = components['schemas']['ProfileVersion'];
export type ProfileVersionInput = components['schemas']['ProfileVersionInput'];
export type ProfileSummary = components['schemas']['ProfileSummary'];
export type ProfileDetail = components['schemas']['ProfileDetail'];
export type Expectation = components['schemas']['Expectation'];
export type TestSpec = components['schemas']['TestSpec'];
export type ClarificationQuestion = components['schemas']['ClarificationQuestion'];
export type MissingExpectation = components['schemas']['MissingExpectation'];
export type TestGenerationRequest = components['schemas']['TestGenerationRequest'];
/**
 * Additive Langfuse observability fields returned by the test-generator
 * service when tracing is enabled. All optional — absent when disabled.
 */
export interface ObservabilityFields {
  /** Langfuse/W3C trace id for the request. */
  traceId?: string;
  /** Root observation id (e.g. "test_generation"). */
  observationId?: string;
  /** LLM generation attempt id — absent on cache hits. */
  generationId?: string;
  /** True when the response was served from the semantic cache. */
  cached?: boolean;
  /** Cache-hit similarity score (0..1). */
  similarity?: number;
  /** Cache match type, e.g. "semantic" | "exact". */
  matchType?: string;
}

export type TestGenerationResponse = components['schemas']['TestGenerationResponse'] &
  ObservabilityFields & {
    /** Persisted or cache-linked test_case row id. */
    testCaseId?: string;
    /** Id of the test case matched on a cache hit. */
    matchedTestCaseId?: string;
  };
export type ClarifyRequest = components['schemas']['ClarifyRequest'];

/** Real backend: POST /internal/v1/test-cases */
export interface CreateTestCaseRequest {
  name: string;
  description?: string;
  test_spec: {
    request: Record<string, unknown>;
    expectations: Record<string, unknown>;
  };
  evaluation_profile_id?: string | null;
  created_by: string;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  testSpec: {
    request: Record<string, unknown>;
    expectations: Record<string, unknown>;
    clarifications?: unknown[];
  };
  evaluationProfileId: string | null;
  evaluationProfileName?: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Filters for GET /api/test-cases */
export interface ListTestCasesParams {
  status?: string;
  profileId?: string;
}

/** Real backend: GET /api/test-runs?term=<query>&testCaseId=<id> */
export interface TestRunEvaluationCheck {
  type: string;
  description: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface TestRunEvaluation {
  testCaseId: string;
  testCaseName: string;
  passed: boolean;
  checks: TestRunEvaluationCheck[];
}

export interface AnalysisFindingDetail {
  sku?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface AnalysisFinding {
  type: string;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL' | 'INFO' | string;
  count?: number;
  reason?: string;
  details?: AnalysisFindingDetail[];
  /** Findings may carry arbitrary extra attributes depending on the search API response. */
  [key: string]: unknown;
}

export interface TestRunAnalysis {
  totalProducts: number;
  analyzedProducts: number;
  findings: AnalysisFinding[];
}

/** Real backend: POST /internal/v1/analysis-summaries */

export interface AnalysisSummaryRequest {
  analysis?: TestRunAnalysis;
  fromTime?: string;
  toTime?: string;
  operation?: 'analysis-summary' | 'test-generation' | string;
  limit?: number;
  offset?: number;
}

export interface MetricsObservation {
  id: string;
  name: string;
  kind: 'span' | 'embedding' | 'generation' | string;
  startedAt?: string;
  latencyMs?: number;
  status?: string;
  errorType?: string | null;
  observationId?: string;
  generationId?: string | null;
  model?: string | null;
  provider?: string | null;
  attempt?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  inputCostUsd?: number | null;
  outputCostUsd?: number | null;
  totalCostUsd?: number | null;
  providerTimingsMs?: Record<string, number>;
  outputTokensPerSecond?: number | null;
  metadata?: Record<string, unknown>;
}

export interface MetricsResponse {
  requestId: string;
  operation: string;
  provider?: string;
  model?: string;
  promptVersion?: string;
  traceId?: string;
  observationId?: string;
  summaryId?: string;
  testCaseId?: string | null;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  status?: string;
  errorType?: string | null;
  source?: string;
  cached?: boolean;
  fallbackReason?: string | null;
  llmCalls?: number;
  embeddingCalls?: number;
  retries?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number | null;
  knownTotalTokens?: number;
  costStatus?: string;
  totalCostUsd?: number | null;
  knownCostUsd?: number;
  currency?: string;
  observations?: MetricsObservation[];
  metadata?: Record<string, unknown>;
}

export interface DashboardTotals {
  totalRequests: number;
  failedRequests: number;
  cacheHits: number;
  fallbackRequests?: number;
  llmCalls: number;
  embeddingCalls: number;
  retries?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens: number | null;
  knownTotalTokens: number;
  requestsWithUnknownTokens?: number;
  totalCostUsd: number | null;
  knownCostUsd: number;
  requestsWithUnknownCost?: number;
  currency?: string;
  averageLatencyMs: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
  errorRate: number;
  cacheHitRate: number;
}

export interface DashboardTrace {
  requestId: string;
  operation: string;
  provider?: string;
  model?: string;
  startedAt?: string;
  completedAt?: string;
  latencyMs: number;
  status: string;
  source?: string;
  cached?: boolean;
  llmCalls?: number;
  embeddingCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalCostUsd?: number;
  costStatus?: string;
}

export interface DashboardData {
  available: boolean;
  unavailableReason?: string | null;
  fromTime?: string;
  toTime?: string;
  operation?: string | null;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  totals: DashboardTotals;
  byOperation: Record<string, Partial<DashboardTotals>>;
  traces: DashboardTrace[];
}

export interface AnalysisSummaryResponse extends ObservabilityFields {
  summary?: string;
  summaryId?: string;
  matchedReportId?: string;
  metrics?: MetricsResponse;
  metricsPersisted?: boolean;
  dashboard?: DashboardData;
}

export interface TestRunResponse {
  term: string;
  httpStatus: number;
  result: {
    numberOfProducts: number;
    products: Record<string, unknown>[];
    filters?: Record<string, unknown>;
  };
  evaluation?: TestRunEvaluation;
  analysis?: TestRunAnalysis;
}

/** Real backend: GET /api/test-runs/history — one entry per executed run. */
export interface TestRunHistoryEntry {
  id: string;
  testCaseId: string | null;
  testCaseName: string | null;
  term: string;
  status: 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | 'ERROR' | string;
  httpStatus: number;
  resultCount: number;
  checks: TestRunEvaluationCheck[] | null;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string;
}

/** Real backend: GET /api/dashboard */
export interface DashboardResponse {
  testCases: {
    total: number;
    draft: number;
    ready: number;
    archived: number;
    active: number;
  };
  runs: {
    total: number;
    passed: number;
    failed: number;
    inconclusive: number;
    error: number;
  };
  recentRuns: TestRunHistoryEntry[];
}

/** Real backend: GET /api/evaluation-profiles */
export interface EvaluationProfileEvaluator {
  evaluatorType: string;
  displayName: string;
  enabled: boolean;
  weight: number;
  configuration: Record<string, unknown>;
}

export interface EvaluationProfile {
  id: string;
  name: string;
  description?: string;
  passThreshold: number;
  evaluators: EvaluationProfileEvaluator[];
  createdAt: string;
  updatedAt: string;
}

/** Real backend: GET /api/evaluation-profiles/evaluators */
export interface EvaluatorCatalogEntry {
  evaluatorType: string;
  displayName: string;
  description?: string;
  configuration?: Record<string, unknown>;
}

// ---- Performance testing (gatiQA-perf-api) ---------------------------------

export type PerfRunStatus =
  | 'QUEUED'
  | 'GENERATING_SCRIPT'
  | 'VALIDATING'
  | 'EXECUTING'
  | 'SUMMARIZING'
  | 'COMPLETED'
  | 'FAILED';

/**
 * One selected functional test + its API definition for load testing.
 * `apiDefinition` is free-form ({url, method, headers, queryParams, body,
 * testData}) — gatiQA-perf-api's own contract, not the functional testSpec.
 */
export interface PerfTargetRequest {
  functionalTestCaseId?: string;
  functionalTestCaseName?: string;
  apiDefinition: Record<string, unknown>;
}

/** POST /api/perf-runs request body. */
export interface PerfRunRequest {
  name?: string;
  engine?: string;
  targets: PerfTargetRequest[];
  concurrentUsers: number;
  durationSeconds: number;
  rampUpSeconds: number;
  p95ThresholdMs: number;
  maxErrorRatePercent: number;
  /** Optional hard cap on total requests; overrides duration when set. */
  iterations?: number;
  createdBy?: string;
}

export interface PerfResultResponse {
  id: string;
  requestsPerSec: number | null;
  totalRequests: number | null;
  avgLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  p50LatencyMs: number | null;
  p90LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  errorRatePercent: number | null;
  p95ThresholdPassed: boolean | null;
  errorRateThresholdPassed: boolean | null;
  overallPassed: boolean | null;
  checksPassed: number | null;
  checksFailed: number | null;
  dataReceivedBytes: number | null;
  dataSentBytes: number | null;
  iterationsCompleted: number | null;
  iterationsPerSec: number | null;
  iterationDurationAvgMs: number | null;
  iterationDurationP95Ms: number | null;
  vusMax: number | null;
  reqBlockedAvgMs: number | null;
  reqConnectingAvgMs: number | null;
  reqTlsAvgMs: number | null;
  reqSendingAvgMs: number | null;
  reqWaitingAvgMs: number | null;
  reqReceivingAvgMs: number | null;
  aiSummary: string | null;
  createdAt: string;
}

export interface PerfRunSummaryResponse {
  id: string;
  name: string;
  engine: string;
  status: PerfRunStatus;
  concurrentUsers: number;
  durationSeconds: number;
  rampUpSeconds: number;
  p95ThresholdMs: number;
  maxErrorRatePercent: number;
  iterations: number | null;
  targetCount: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PerfRunDetailResponse {
  id: string;
  name: string;
  engine: string;
  status: PerfRunStatus;
  concurrentUsers: number;
  durationSeconds: number;
  rampUpSeconds: number;
  p95ThresholdMs: number;
  maxErrorRatePercent: number;
  iterations: number | null;
  generatedScript: string | null;
  scriptValidated: boolean;
  validationMessage: string | null;
  generationAttempts: number;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  targets: {
    functionalTestCaseId: string | null;
    functionalTestCaseName: string | null;
    apiDefinition: Record<string, unknown>;
  }[];
  result: PerfResultResponse | null;
  rawStdout: string | null;
}

/** Backend surface consumed by the UI. Mirrors the OpenAPI operationIds. */
export interface GatiQaApi {
  listEvaluators(): Promise<Evaluator[]>;
  listProfiles(): Promise<ProfileSummary[]>;
  getProfile(profileId: string): Promise<ProfileDetail>;
  createProfile(input: ProfileVersionInput): Promise<ProfileDetail>;
  createProfileVersion(profileId: string, input: ProfileVersionInput): Promise<ProfileVersion>;
  generateTestDraft(req: TestGenerationRequest): Promise<TestGenerationResponse>;
  clarifyTestDraft(draftId: string, req: ClarifyRequest): Promise<TestGenerationResponse>;
  createTestCase(req: CreateTestCaseRequest): Promise<TestCase>;
  listTestCases(params?: ListTestCasesParams): Promise<TestCase[]>;
  getTestCase(id: string): Promise<TestCase>;
  updateTestCase(id: string, req: Partial<CreateTestCaseRequest>): Promise<TestCase>;
  deleteTestCase(id: string): Promise<void>;
  runTestCase(term: string, testCaseId?: string): Promise<TestRunResponse>;
  createAnalysisSummary(req: AnalysisSummaryRequest): Promise<AnalysisSummaryResponse>;
  listEvaluationProfiles(): Promise<EvaluationProfile[]>;
  getEvaluationProfile(id: string): Promise<EvaluationProfile>;
  listEvaluatorCatalog(): Promise<EvaluatorCatalogEntry[]>;
  getDashboard(): Promise<DashboardResponse>;
  listTestRunHistory(): Promise<TestRunHistoryEntry[]>;
  // Performance testing (gatiQA-perf-api)
  createPerfRun(req: PerfRunRequest): Promise<PerfRunDetailResponse>;
  listPerfRuns(): Promise<PerfRunSummaryResponse[]>;
  getPerfRun(id: string): Promise<PerfRunDetailResponse>;
  listPerfEngineTools(engine?: string): Promise<string[]>;
}
