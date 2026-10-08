import { useMemo, useState } from 'react';
import type { Evaluator, ProfileEvaluator, ProfileVersion, ProfileVersionInput } from '../../api';
import { Button, Card, Field, Input, Select } from '../../components/ui';
import { round2, totalWeight, validateProfileVersion, WEIGHT_TOTAL } from './validation';

interface Props {
  registry: Evaluator[];
  /** Existing version to start from (for "edit as new version"), or null for a fresh profile. */
  baseVersion?: ProfileVersion | null;
  isNewProfile?: boolean;
  saving?: boolean;
  onSave: (input: ProfileVersionInput) => void;
  onCancel?: () => void;
}

interface RowState extends ProfileEvaluator {
  selected: boolean;
}

function toRows(registry: Evaluator[], base?: ProfileVersion | null): RowState[] {
  return registry.map((ev) => {
    const existing = base?.evaluators.find((e) => e.evaluatorId === ev.id);
    const defaults = Object.fromEntries(
      ev.configSchema.filter((f) => f.default !== undefined).map((f) => [f.key, f.default]),
    );
    return {
      evaluatorId: ev.id,
      selected: !!existing,
      weight: existing?.weight ?? 0,
      config: { ...defaults, ...(existing?.config ?? {}) },
    };
  });
}

export function ProfileVersionEditor({ registry, baseVersion, isNewProfile, saving, onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<RowState[]>(() => toRows(registry, baseVersion));
  const [passThreshold, setPassThreshold] = useState(baseVersion?.passThreshold ?? 0.8);
  const [inconclusiveThreshold, setInconclusiveThreshold] = useState<number | undefined>(
    baseVersion?.inconclusiveThreshold,
  );
  const [submitted, setSubmitted] = useState(false);

  const selected = rows.filter((r) => r.selected);
  const total = round2(totalWeight(selected));
  const totalOk = Math.abs(total - WEIGHT_TOTAL) <= 0.001;

  const input: ProfileVersionInput = useMemo(
    () => ({
      name: name || undefined,
      description: description || undefined,
      evaluators: selected.map(({ evaluatorId, weight, config }) => ({ evaluatorId, weight, config })),
      passThreshold,
      inconclusiveThreshold,
    }),
    [name, description, selected, passThreshold, inconclusiveThreshold],
  );

  const issues = useMemo(() => validateProfileVersion(input, registry), [input, registry]);
  const issueFor = (field: string) => issues.find((i) => i.field === field)?.message;
  const showIssues = submitted;

  function updateRow(evaluatorId: string, patch: Partial<RowState>) {
    setRows((rs) => rs.map((r) => (r.evaluatorId === evaluatorId ? { ...r, ...patch } : r)));
  }

  function updateConfig(evaluatorId: string, key: string, value: unknown) {
    setRows((rs) =>
      rs.map((r) =>
        r.evaluatorId === evaluatorId ? { ...r, config: { ...r.config, [key]: value } } : r,
      ),
    );
  }

  function handleSave() {
    setSubmitted(true);
    if (isNewProfile && !name.trim()) return;
    if (issues.length === 0) onSave(input);
  }

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">
        {isNewProfile ? 'New profile' : `Edit as new version${baseVersion ? ` (based on v${baseVersion.version})` : ''}`}
      </h2>

      {isNewProfile && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Field label="Profile name" error={submitted && !name.trim() ? 'Name is required.' : undefined}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Checkout Agent Quality" />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Registered evaluators</legend>
        {showIssues && issueFor('evaluators') && (
          <p role="alert" className="mb-2 text-xs text-red-600">{issueFor('evaluators')}</p>
        )}
        <div className="space-y-3">
          {rows.map((row) => {
            const ev = registry.find((e) => e.id === row.evaluatorId)!;
            const idx = selected.findIndex((s) => s.evaluatorId === row.evaluatorId);
            return (
              <div
                key={ev.id}
                className={`rounded-md border p-3 ${row.selected ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200'}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`sel-${ev.id}`}
                    checked={row.selected}
                    onChange={(e) => updateRow(ev.id, { selected: e.target.checked })}
                    aria-label={`Select ${ev.name}`}
                  />
                  <label htmlFor={`sel-${ev.id}`} className="flex-1">
                    <span className="text-sm font-medium">{ev.name}</span>
                    <span className="ml-2 text-xs text-slate-400">v{ev.version}</span>
                    <span className="block text-xs text-slate-500">{ev.description}</span>
                  </label>
                  {row.selected && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className="w-24"
                        aria-label={`Weight for ${ev.name}`}
                        value={row.weight}
                        onChange={(e) => updateRow(ev.id, { weight: Number(e.target.value) })}
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  )}
                </div>

                {row.selected && ev.configSchema.length > 0 && (
                  <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                    {ev.configSchema.map((f) => {
                      const err = showIssues ? issueFor(`evaluators.${idx}.config.${f.key}`) : undefined;
                      const val = row.config[f.key];
                      return (
                        <Field
                          key={f.key}
                          label={`${f.label}${f.required ? ' *' : ''}`}
                          hint={f.description}
                          error={err}
                        >
                          {f.type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={Boolean(val)}
                              onChange={(e) => updateConfig(ev.id, f.key, e.target.checked)}
                              aria-label={f.label}
                            />
                          ) : f.type === 'select' ? (
                            <Select
                              value={String(val ?? '')}
                              onChange={(e) => updateConfig(ev.id, f.key, e.target.value)}
                              aria-label={f.label}
                            >
                              <option value="">—</option>
                              {f.options?.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </Select>
                          ) : (
                            <Input
                              type={f.type === 'number' ? 'number' : 'text'}
                              value={val === undefined || val === null ? '' : String(val)}
                              onChange={(e) =>
                                updateConfig(
                                  ev.id,
                                  f.key,
                                  f.type === 'number' ? Number(e.target.value) : e.target.value,
                                )
                              }
                              aria-label={f.label}
                            />
                          )}
                        </Field>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div
        className={`mt-4 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
          totalOk ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
        }`}
        data-testid="weight-total"
      >
        <span>Total weight</span>
        <span>
          {total} / {WEIGHT_TOTAL}
          {!totalOk && ' — must equal 100'}
        </span>
      </div>
      {showIssues && issueFor('weights') && (
        <p role="alert" className="mt-1 text-xs text-red-600">{issueFor('weights')}</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Pass threshold (0–1)"
          hint="Weighted score at or above which a run passes."
          error={showIssues ? issueFor('passThreshold') : undefined}
        >
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={passThreshold}
            onChange={(e) => setPassThreshold(Number(e.target.value))}
          />
        </Field>
        <Field
          label="Inconclusive threshold (0–1, optional)"
          hint="Below this, runs are inconclusive rather than failed."
          error={showIssues ? issueFor('inconclusiveThreshold') : undefined}
        >
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={inconclusiveThreshold ?? ''}
            onChange={(e) =>
              setInconclusiveThreshold(e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </Field>
      </div>

      {showIssues && issues.length > 0 && (
        <ul role="alert" className="mt-4 list-disc space-y-1 rounded-md bg-red-50 p-3 pl-8 text-xs text-red-700">
          {issues.map((i) => (
            <li key={i.field}>{i.message}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isNewProfile ? 'Create profile' : 'Save as new version'}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
