import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { config } from './config';
import ProfilesPage from './features/profiles/ProfilesPage';
import GenerateTestPage from './features/generate/GenerateTestPage';
import RunTestsPage from './features/runs/RunTestsPage';
import HistoryPage from './features/history/HistoryPage';
import ObservabilityDashboardPage from './features/observability/ObservabilityDashboardPage';

const nav = [
  { to: '/profiles', label: 'Evaluation Profiles' },
  { to: '/generate', label: 'Generate Test' },
  { to: '/run', label: 'Run Tests' },
  { to: '/history', label: 'History' },
  { to: '/observability', label: 'Observability' },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3">
          <span className="text-lg font-semibold text-brand-700">gatiQA</span>
          <nav className="flex gap-1" aria-label="Primary">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          {config.useFixtures && (
            <span
              data-testid="fixture-banner"
              className="ml-auto rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
            >
              DEV: synthetic fixtures
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/profiles" replace />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/generate" element={<GenerateTestPage />} />
          <Route path="/run" element={<RunTestsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/observability" element={<ObservabilityDashboardPage />} />
          <Route path="*" element={<Navigate to="/profiles" replace />} />
        </Routes>
      </main>
    </div>
  );
}
