import { config } from '../config';
import { httpApi } from './client';
import { fixtureApi } from './fixtures';
import type {
  EvaluationProfile,
  Evaluator,
  GatiQaApi,
  ProfileDetail,
  ProfileSummary,
} from './types';

/**
 * Single entry point for all backend access.
 * Fixture mode is an explicit development setting (VITE_USE_FIXTURES=true).
 * Test-generation endpoints always hit the real backend.
 */
const base: GatiQaApi = config.useFixtures ? fixtureApi : httpApi;

function toProfileSummary(p: EvaluationProfile): ProfileSummary {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    latestVersion: 1,
    versionCount: 1,
    updatedAt: p.updatedAt,
  };
}

function toProfileDetail(p: EvaluationProfile): ProfileDetail {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    versions: [
      {
        version: 1,
        createdAt: p.createdAt,
        evaluators: p.evaluators.map((e) => ({
          evaluatorId: e.evaluatorType,
          weight: e.weight,
          config: e.configuration,
        })),
        passThreshold: p.passThreshold / 100,
      },
    ],
  };
}

export const api: GatiQaApi = {
  ...base,
  listProfiles: async (): Promise<ProfileSummary[]> =>
    (await httpApi.listEvaluationProfiles()).map(toProfileSummary),
  getProfile: async (id: string): Promise<ProfileDetail> =>
    toProfileDetail(await httpApi.getEvaluationProfile(id)),
  generateTestDraft: httpApi.generateTestDraft,
  clarifyTestDraft: httpApi.clarifyTestDraft,
  createTestCase: httpApi.createTestCase,
  listTestCases: httpApi.listTestCases,
  getTestCase: httpApi.getTestCase,
  updateTestCase: httpApi.updateTestCase,
  deleteTestCase: httpApi.deleteTestCase,
  runTestCase: httpApi.runTestCase,
  listEvaluationProfiles: httpApi.listEvaluationProfiles,
  getEvaluationProfile: httpApi.getEvaluationProfile,
  listEvaluatorCatalog: httpApi.listEvaluatorCatalog,
  listEvaluators: async (): Promise<Evaluator[]> => {
    const catalog = await httpApi.listEvaluatorCatalog();
    return catalog.map((e) => ({
      id: e.evaluatorType,
      name: e.displayName,
      version: '1',
      description: e.description,
      configSchema: [],
    }));
  },
};

export { ApiError } from './client';
export * from './types';
