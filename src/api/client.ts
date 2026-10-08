import { config } from '../config';
import { traceHeaders } from './traceContext';
import type {
  AnalysisSummaryRequest,
  AnalysisSummaryResponse,
  ApiErrorBody,
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
  TestCase,
  TestGenerationResponse,
  TestRunHistoryEntry,
  TestRunResponse,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: { field: string; message: string }[];

  constructor(status: number, body: ApiErrorBody | undefined, fallback: string) {
    super(body?.message ?? fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? `HTTP_${status}`;
    this.fieldErrors = body?.fieldErrors;
  }

  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

async function request<T>(path: string, init?: RequestInit, absolutePath = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (config.apiToken) {
    headers['Authorization'] = `Bearer ${config.apiToken}`;
  }
  const url = absolutePath ? path : `${config.apiBaseUrl}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new ApiError(0, undefined, 'Network error: could not reach the gatiQA API.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as ApiErrorBody | undefined;
    throw new ApiError(res.status, body, `Request failed with status ${res.status}.`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const httpApi: GatiQaApi = {
  listEvaluators: () => request<Evaluator[]>('/evaluators'),
  listProfiles: () => request<ProfileSummary[]>('/profiles'),
  getProfile: (profileId) => request<ProfileDetail>(`/profiles/${profileId}`),
  createProfile: (input) =>
    request<ProfileDetail>('/profiles', { method: 'POST', body: JSON.stringify(input) }),
  createProfileVersion: (profileId, input) =>
    request<ProfileVersion>(`/profiles/${profileId}/versions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  generateTestDraft: (req) =>
    request<TestGenerationResponse>('/internal/v1/test-generations', {
      method: 'POST',
      headers: traceHeaders(),
      body: JSON.stringify(req),
    }, true),
  clarifyTestDraft: (draftId, req) =>
    request<TestGenerationResponse>(`/internal/v1/test-generations/${draftId}/clarify`, {
      method: 'POST',
      headers: traceHeaders(),
      body: JSON.stringify(req),
    }, true),
  createTestCase: (req: CreateTestCaseRequest) =>
    request<TestCase>('/internal/v1/test-cases', {
      method: 'POST',
      body: JSON.stringify(req),
    }, true),
  listTestCases: (params: ListTestCasesParams = {}) =>
    request<TestCase[]>(
      `/api/test-cases${qs({ status: params.status, profileId: params.profileId })}`,
      undefined,
      true,
    ),
  getTestCase: (id) => request<TestCase>(`/api/test-cases/${id}`, undefined, true),
  updateTestCase: (id, req) =>
    request<TestCase>(`/api/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: req.name,
        description: req.description,
        testSpec: req.test_spec,
        evaluationProfileId: req.evaluation_profile_id,
        createdBy: req.created_by,
      }),
    }, true),
  deleteTestCase: (id) =>
    request<void>(`/api/test-cases/${id}`, { method: 'DELETE' }, true),
  runTestCase: (term, testCaseId) =>
    request<TestRunResponse>(
      `/api/test-runs?term=${encodeURIComponent(term)}${testCaseId ? `&testCaseId=${encodeURIComponent(testCaseId)}` : ''}`,
      undefined,
      true,
    ),
  createAnalysisSummary: (req: AnalysisSummaryRequest) =>
    request<AnalysisSummaryResponse>('/internal/v1/analysis-summaries', {
      method: 'POST',
      headers: traceHeaders(),
      body: JSON.stringify(req),
    }, true),
  listEvaluationProfiles: () =>
    request<EvaluationProfile[]>('/api/evaluation-profiles', undefined, true),
  getEvaluationProfile: (id) =>
    request<EvaluationProfile>(`/api/evaluation-profiles/${id}`, undefined, true),
  listEvaluatorCatalog: () =>
    request<EvaluatorCatalogEntry[]>('/api/evaluation-profiles/evaluators', undefined, true),
  getDashboard: () => request<DashboardResponse>('/api/dashboard', undefined, true),
  listTestRunHistory: () =>
    request<TestRunHistoryEntry[]>('/api/test-runs/history', undefined, true),
  // Performance testing (gatiQA-perf-api — separate service, own base URL)
  createPerfRun: (req: PerfRunRequest) =>
    request<PerfRunDetailResponse>(`${config.perfApiBaseUrl}/perf-runs`, {
      method: 'POST',
      body: JSON.stringify(req),
    }, true),
  listPerfRuns: () =>
    request<PerfRunSummaryResponse[]>(`${config.perfApiBaseUrl}/perf-runs`, undefined, true),
  getPerfRun: (id: string) =>
    request<PerfRunDetailResponse>(`${config.perfApiBaseUrl}/perf-runs/${id}`, undefined, true),
  listPerfEngineTools: (engine?: string) =>
    request<string[]>(`${config.perfApiBaseUrl}/perf-runs/tools${qs({ engine })}`, undefined, true),
};
