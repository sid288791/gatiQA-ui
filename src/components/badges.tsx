const styles: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-blue-100 text-blue-800',
  succeeded: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
  pass: 'bg-emerald-100 text-emerald-800',
  fail: 'bg-red-100 text-red-800',
  inconclusive: 'bg-amber-100 text-amber-800',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  disabled: 'bg-slate-200 text-slate-500',
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[value] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {label ?? value}
    </span>
  );
}
