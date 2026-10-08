import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  api,
  type TestGenerationRequest,
  type TestGenerationResponse,
} from '../../api';
import { JsonEditor } from '../../components/JsonEditor';
import { ObservabilityPanel } from '../../components/ObservabilityPanel';
import { EmptyState, ErrorState, Loading } from '../../components/states';
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from '../../components/ui';

const DEFAULT_PROFILE = {
  profileId: 'search-basic',
  version: 1,
  enabledEvaluators: ['sku_match', 'top_k', 'pricing'],
};

const STATUS_STYLES: Record<string, string> = {
  READY_FOR_REVIEW: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  NEEDS_CLARIFICATION: 'bg-amber-100 text-amber-800',
};

export default function GenerateTestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [profileRef, setProfileRef] = useState('');
  const [enabledEvaluators, setEnabledEvaluators] = useState<string[]>([]);
  const [defaultsEntries, setDefaultsEntries] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' },
  ]);
  const [response, setResponse] = useState<TestGenerationResponse | null>(null);
  const [draftRequest, setDraftRequest] = useState<Record<string, unknown> | null>(null);
  const [draftExpectations, setDraftExpectations] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const profilesQ = useQuery({
    queryKey: ['evaluation-profiles'],
    queryFn: api.listEvaluationProfiles,
  });

  const profileOptions = useMemo(
    () => (profilesQ.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [profilesQ.data],
  );

  const profileDetailQ = useQuery({
    queryKey: ['evaluation-profiles', profileRef],
    queryFn: () => api.getEvaluationProfile(profileRef),
    enabled: !!profileRef,
  });

  const selectedProfile = profileDetailQ.data ?? null;

  useEffect(() => {
    if (selectedProfile) {
      setEnabledEvaluators(
        selectedProfile.evaluators.filter((e) => e.enabled).map((e) => e.evaluatorType),
      );
    }
  }, [selectedProfile]);

  const generateMut = useMutation({
    mutationFn: api.generateTestDraft,
    onSuccess: (resp) => {
      setResponse(resp);
      setDraftRequest(resp.draft?.request ?? null);
      setDraftExpectations(resp.draft?.expectations ?? null);
      setAnswers({});
      setApproved(false);
      setSavedId(null);
    },
  });

  const clarifyMut = useMutation({
    mutationFn: (args: { answers: { questionId: string; answer: string }[] }) =>
      api.clarifyTestDraft('current', {
        answers: args.answers,
        draft: response!.draft!,
        input,
        profile: profileRef
          ? { profileId: profileRef, version: 1, enabledEvaluators }
          : DEFAULT_PROFILE,
        approvedDefaults: Object.fromEntries(
          defaultsEntries.filter((d) => d.key.trim()).map((d) => [d.key, d.value]),
        ),
      }),
    onSuccess: (resp) => {
      setResponse(resp);
      setDraftRequest(resp.draft?.request ?? null);
      setDraftExpectations(resp.draft?.expectations ?? null);
      setAnswers({});
    },
  });

  const saveMut = useMutation({
    mutationFn: api.createTestCase,
    onSuccess: (t) => {
      setSavedId(t.id);
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });

  const canGenerate = input.trim().length > 0 && !generateMut.isPending;
  const clarifications = response?.clarifications ?? [];
  const missing = response?.missingExpectations ?? [];
  const allAnswered = clarifications.every((c) => (answers[c.id] ?? '').trim().length > 0);
  const readyToSave = !!response && !saveMut.isPending;

  function handleGenerate() {
    if (!canGenerate) return;
    const req: TestGenerationRequest = {
      input: input.trim(),
      profile: profileRef
        ? { profileId: profileRef, version: 1, enabledEvaluators }
        : DEFAULT_PROFILE,
      approvedDefaults: Object.fromEntries(
        defaultsEntries.filter((d) => d.key.trim()).map((d) => [d.key, d.value]),
      ),
    };
    generateMut.mutate(req);
  }

  function handleClarify() {
    if (!response) return;
    clarifyMut.mutate({
      answers: clarifications.map((c) => ({ questionId: c.id, answer: answers[c.id] ?? '' })),
    });
  }

  function handleSave() {
    if (!response) return;
    saveMut.mutate({
      name: input.slice(0, 60) || 'Generated test',
      description: input,
      test_spec: {
        request: draftRequest ?? response.draft?.request ?? {},
        expectations: draftExpectations ?? response.draft?.expectations ?? {},
      },
      evaluation_profile_id: profileRef || null,
      created_by: 'siddharth',
    });
  }

  function addMissingExpectation(hint: string) {
    if (!draftExpectations) return;
    const key = `expectation_${Date.now()}`;
    setDraftExpectations({ ...draftExpectations, [key]: hint });
  }

  return (
    <div>
      <PageHeader
        title="Generate Test"
        subtitle="Describe the behavior to verify. A draft spec is generated for review — nothing is saved without explicit approval."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: input + clarification */}
        <div className="space-y-4">
          <Card>
            <Field label="Natural-language description">
              <Textarea
                rows={5}
                placeholder="e.g. Search for cordless drill in store 123. SKU-100 should appear in the top 3 and cost USD 99.99."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Test description"
              />
            </Field>

            <div className="mt-4">
              <Field label="Evaluation profile version">
                {profilesQ.isLoading ? (
                  <Loading label="Loading profiles…" />
                ) : profileOptions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No profiles available — create one in Evaluation Profiles first.
                  </p>
                ) : (
                  <Select
                    value={profileRef}
                    onChange={(e) => setProfileRef(e.target.value)}
                    aria-label="Profile version"
                  >
                    <option value="">Select a profile…</option>
                    {profileOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            {selectedProfile && (
              <div className="mt-4">
                <span className="text-sm font-medium text-slate-700">Enabled evaluators</span>
                <div className="mt-2 space-y-1.5">
                  {selectedProfile.evaluators.map((e) => (
                    <label key={e.evaluatorType} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={enabledEvaluators.includes(e.evaluatorType)}
                        onChange={(ev) => {
                          if (ev.target.checked) setEnabledEvaluators([...enabledEvaluators, e.evaluatorType]);
                          else setEnabledEvaluators(enabledEvaluators.filter((id) => id !== e.evaluatorType));
                        }}
                      />
                      <span>{e.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <span className="text-sm font-medium text-slate-700">Approved defaults</span>
              <div className="mt-2 space-y-2">
                {defaultsEntries.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="key"
                      value={d.key}
                      onChange={(e) => {
                        const next = [...defaultsEntries];
                        next[i] = { ...d, key: e.target.value };
                        setDefaultsEntries(next);
                      }}
                      aria-label={`Default key ${i + 1}`}
                    />
                    <Input
                      placeholder="value"
                      value={d.value}
                      onChange={(e) => {
                        const next = [...defaultsEntries];
                        next[i] = { ...d, value: e.target.value };
                        setDefaultsEntries(next);
                      }}
                      aria-label={`Default value ${i + 1}`}
                    />
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setDefaultsEntries(defaultsEntries.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="text-sm text-brand-600 hover:underline"
                  onClick={() => setDefaultsEntries([...defaultsEntries, { key: '', value: '' }])}
                >
                  + Add default
                </button>
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                {generateMut.isPending ? 'Generating…' : 'Generate'}
              </Button>
            </div>
            {generateMut.isError && (
              <div className="mt-3">
                <ErrorState error={generateMut.error} />
              </div>
            )}
          </Card>

          {response && clarifications.length > 0 && (
            <Card>
              <h2 className="mb-3 text-base font-semibold">Clarifications needed</h2>
              <div className="space-y-4">
                {clarifications.map((c) => (
                  <Field key={c.id} label={c.question}>
                    {c.options?.length ? (
                      <Select
                        value={answers[c.id] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [c.id]: e.target.value }))}
                        aria-label={c.question}
                      >
                        <option value="">Select…</option>
                        {c.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={answers[c.id] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [c.id]: e.target.value }))}
                        aria-label={c.question}
                      />
                    )}
                  </Field>
                ))}
              </div>
              <div className="mt-4">
                <Button onClick={handleClarify} disabled={!allAnswered || clarifyMut.isPending}>
                  {clarifyMut.isPending ? 'Submitting…' : 'Submit answers'}
                </Button>
              </div>
              {clarifyMut.isError && (
                <div className="mt-3">
                  <ErrorState error={clarifyMut.error} />
                </div>
              )}
            </Card>
          )}

          {response && missing.length > 0 && (
            <Card>
              <h2 className="mb-1 text-base font-semibold">Missing expectations</h2>
              <p className="mb-3 text-sm text-slate-500">
                The generator flagged gaps. Add an expectation for each relevant hint.
              </p>
              <ul className="space-y-2">
                {missing.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3"
                  >
                    <span className="text-sm text-amber-900">{m.hint}</span>
                    <Button
                      variant="secondary"
                      onClick={() => addMissingExpectation(m.hint)}
                    >
                      Add expectation
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right: preview / editor / approval */}
        <div className="space-y-4">
          {!response && !generateMut.isPending && (
            <EmptyState title="No draft yet">
              Enter a description and choose a profile version, then Generate.
            </EmptyState>
          )}
          {generateMut.isPending && <Loading label="Generating draft…" />}

          {response && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Draft spec</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[response.status] ?? 'bg-slate-100 text-slate-700'}`}
                >
                  {response.status}
                </span>
              </div>

              <div className="mb-4">
                <ObservabilityPanel
                  traceId={response.traceId}
                  observationId={response.observationId}
                  generationId={response.generationId}
                  cached={response.cached}
                  similarity={response.similarity}
                  matchType={response.matchType}
                  matchedLabel="matchedTestCaseId"
                  matchedId={response.matchedTestCaseId}
                  ids={[{ label: 'testCaseId', value: response.testCaseId }]}
                />
              </div>

              <div className="mb-4">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Full response</span>
                <div className="mt-1">
                  <JsonEditor
                    value={response}
                    aria-label="Full response JSON"
                    onChange={() => {}}
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                    aria-label="Approve test spec"
                  />
                  <span>
                    I have reviewed this spec and approve it for execution against the selected
                    profile version.
                  </span>
                </label>
                <div className="mt-3 flex items-center gap-3">
                  <Button onClick={handleSave} disabled={!readyToSave}>
                    {saveMut.isPending ? 'Saving…' : 'Approve & save test'}
                  </Button>
                  {savedId && (
                    <span className="text-sm text-emerald-700" role="status">
                      Saved as {savedId}.{' '}
                      <button className="font-medium underline" onClick={() => navigate('/run')}>
                        Run it →
                      </button>
                    </span>
                  )}
                </div>
                {saveMut.isError && (
                  <div className="mt-3">
                    <ErrorState error={saveMut.error} />
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
