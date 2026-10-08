# gatiQA UI — Phase 1 MVP

React + TypeScript frontend for gatiQA: evaluation profiles, NL test generation,
asynchronous test runs, and run history.

## Stack

- **Vite + React 18 + TypeScript** (strict)
- **TanStack Query** — data fetching, caching, run polling
- **React Router v6** — four primary screens
- **Tailwind CSS** — styling
- **openapi-typescript** — API types generated from `openapi/openapi.yaml`
- **Vitest + Testing Library** — component tests
- **Playwright** — end-to-end test

## Backend contract

`openapi/openapi.yaml` is the source of truth for the backend API. Types are
generated into `src/api/types.gen.ts`:

```bash
npm run codegen
```

The UI talks to the backend exclusively through the `GatiQaApi` interface
(`src/api/types.ts`), implemented by:

- `src/api/client.ts` — real HTTP client (`fetch`, bearer token, normalized `ApiError`)
- `src/api/fixtures.ts` — synthetic in-memory backend, **only** active when
  `VITE_USE_FIXTURES=true` (explicit development setting; a banner is shown in the UI)

## Security

- The UI never holds LLM keys or target-system credentials. Test generation and
  run execution happen server-side; the contract carries no secrets.
- `VITE_API_TOKEN` is an optional UI→backend bearer token only.

## Screens

| Route       | Screen                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| `/profiles` | Profile list, version history, evaluator/weight/threshold editor       |
| `/generate` | NL prompt → draft spec → clarifications → approve & save               |
| `/run`      | Select saved tests + approved environment → start async run            |
| `/runs/:id` | Live progress, execution state vs verdict, evaluator evidence          |
| `/history`  | Paginated/filterable runs, verdict + execution-error counts, rerun     |

## Develop

```bash
npm install
npm run dev:fixtures   # synthetic backend, no real API needed
npm run dev            # real backend via /api proxy (VITE_API_PROXY_TARGET)
```

Copy `.env.example` to `.env.local` to configure.

## Test

```bash
npm run test           # component tests (vitest, fixture backend)
npm run e2e:install    # one-time: install Playwright chromium
npm run e2e            # full MVP workflow e2e (spins up dev server)
npm run typecheck
npm run build
```

## Validation rules (profiles)

- At least one evaluator selected
- Weights are 0–100 and must total exactly 100 (live indicator)
- All required evaluator config fields must be filled
- Thresholds in [0, 1]; inconclusive threshold must be below pass threshold
- Saving always creates a new immutable version
