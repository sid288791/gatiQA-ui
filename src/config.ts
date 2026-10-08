/**
 * Runtime configuration sourced from Vite env vars.
 *
 * Security notes:
 * - `useFixtures` is an explicit development-only switch. Synthetic fixtures
 *   are served only when VITE_USE_FIXTURES=true.
 * - The UI never holds LLM keys or target-system credentials. `apiToken` is
 *   an optional UI→backend bearer token only.
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  /**
   * gatiQA-perf-api base URL (performance testing service).
   * In dev, /perf-api is proxied to the perf backend (see vite.config.ts).
   */
  perfApiBaseUrl: import.meta.env.VITE_PERF_API_BASE_URL ?? '/perf-api',
  /**
   * Base URL of the search API under test — mirrors `search.api.base-url`
   * in gatiQA-test-api. Used to prefill the performance-test target.
   */
  searchApiBaseUrl: import.meta.env.VITE_SEARCH_API_BASE_URL ?? 'https://shop.advanceautoparts.com',
  useFixtures: import.meta.env.VITE_USE_FIXTURES === 'true',
  apiToken: import.meta.env.VITE_API_TOKEN ?? '',
  /**
   * Public Langfuse UI base URL for "View in Langfuse" links.
   * Never ship LANGFUSE_SECRET_KEY here — trace fetches must go through the backend.
   */
  langfuseBaseUrl: import.meta.env.VITE_LANGFUSE_BASE_URL ?? 'https://us.cloud.langfuse.com',
} as const;
