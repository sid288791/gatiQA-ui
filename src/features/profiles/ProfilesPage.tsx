import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type ProfileVersionInput } from '../../api';
import { Badge } from '../../components/badges';
import { EmptyState, ErrorState, Loading } from '../../components/states';
import { Button, Card, PageHeader } from '../../components/ui';
import { ProfileVersionEditor } from './ProfileVersionEditor';

export default function ProfilesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | 'version' | null>(null);

  const evaluatorsQ = useQuery({ queryKey: ['evaluators'], queryFn: api.listEvaluators });
  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: api.listProfiles });
  const profileQ = useQuery({
    queryKey: ['profiles', selectedId],
    queryFn: () => api.getProfile(selectedId!),
    enabled: !!selectedId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
  };

  const createMut = useMutation({
    mutationFn: (input: ProfileVersionInput) => api.createProfile(input),
    onSuccess: (p) => {
      invalidate();
      setSelectedId(p.id);
      setEditing(null);
    },
  });

  const versionMut = useMutation({
    mutationFn: (input: ProfileVersionInput) => api.createProfileVersion(selectedId!, input),
    onSuccess: () => {
      invalidate();
      profileQ.refetch();
      setEditing(null);
    },
  });

  const saveError = createMut.error ?? versionMut.error;

  return (
    <div>
      <PageHeader
        title="Evaluation Profiles"
        subtitle="Profiles bundle evaluators, weights, and thresholds into versioned quality gates."
        actions={
          <Button onClick={() => setEditing('new')} disabled={editing === 'new'}>
            New profile
          </Button>
        }
      />

      {profilesQ.isLoading && <Loading label="Loading profiles…" />}
      {profilesQ.isError && <ErrorState error={profilesQ.error} onRetry={() => profilesQ.refetch()} />}

      {profilesQ.data && profilesQ.data.length === 0 && editing !== 'new' && (
        <EmptyState title="No profiles yet">
          Create a profile to define how tests are evaluated.
        </EmptyState>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {profilesQ.data && profilesQ.data.length > 0 && (
          <div className="space-y-2" role="list" aria-label="Profiles">
            {profilesQ.data.map((p) => (
              <button
                key={p.id}
                role="listitem"
                aria-label={p.name}
                onClick={() => {
                  setSelectedId(p.id);
                  setEditing(null);
                }}
                className={`w-full rounded-lg border p-3 text-left ${
                  selectedId === p.id
                    ? 'border-brand-400 bg-brand-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.name}</span>
                  <Badge value="approved" label={`v${p.latestVersion}`} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {p.versionCount} version{p.versionCount === 1 ? '' : 's'} · updated{' '}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {editing === 'new' && evaluatorsQ.data && (
            <ProfileVersionEditor
              registry={evaluatorsQ.data}
              isNewProfile
              saving={createMut.isPending}
              onSave={(input) => createMut.mutate(input)}
              onCancel={() => setEditing(null)}
            />
          )}

          {selectedId && editing !== 'new' && (
            <>
              {profileQ.isLoading && <Loading label="Loading profile…" />}
              {profileQ.isError && <ErrorState error={profileQ.error} onRetry={() => profileQ.refetch()} />}
              {profileQ.data && (
                <>
                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-semibold">{profileQ.data.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">{profileQ.data.description}</p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setEditing('version')}
                        disabled={editing === 'version'}
                      >
                        Edit as new version
                      </Button>
                    </div>
                  </Card>

                  {editing === 'version' && evaluatorsQ.data ? (
                    <ProfileVersionEditor
                      registry={evaluatorsQ.data}
                      baseVersion={profileQ.data.versions[0]}
                      saving={versionMut.isPending}
                      onSave={(input) => versionMut.mutate(input)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <Card>
                      <h3 className="mb-3 text-sm font-semibold">Version history</h3>
                      <ol className="space-y-3">
                        {profileQ.data.versions.map((v) => (
                          <li key={v.version} className="rounded-md border border-slate-200 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">v{v.version}</span>
                              <span className="text-xs text-slate-400">
                                {new Date(v.createdAt).toLocaleString()}
                                {v.createdBy ? ` · ${v.createdBy}` : ''}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {v.evaluators.map((e) => (
                                <span
                                  key={e.evaluatorId}
                                  className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                                >
                                  {e.evaluatorId} · {e.weight}%
                                </span>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              pass ≥ {v.passThreshold}
                              {v.inconclusiveThreshold !== undefined &&
                                ` · inconclusive < ${v.inconclusiveThreshold}`}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </Card>
                  )}
                </>
              )}
            </>
          )}

          {!selectedId && editing !== 'new' && profilesQ.data && profilesQ.data.length > 0 && (
            <EmptyState title="Select a profile to view its versions" />
          )}
        </div>
      </div>

      {saveError && (
        <div className="mt-4">
          <ErrorState error={saveError instanceof ApiError ? saveError : saveError} />
        </div>
      )}
    </div>
  );
}
