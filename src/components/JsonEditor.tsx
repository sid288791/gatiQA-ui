import { useEffect, useState } from 'react';

interface Props {
  value: unknown;
  onChange?: (parsed: unknown) => void;
  readOnly?: boolean;
  minRows?: number;
  'aria-label'?: string;
}

/**
 * Minimal JSON editor: a textarea with live parse validation and a
 * format helper. Emits parsed objects only when JSON is valid.
 */
export function JsonEditor({ value, onChange, readOnly, minRows = 14, ...rest }: Props) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);

  function handleChange(next: string) {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      setError(null);
      onChange?.(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  function format() {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setError(null);
    } catch {
      /* keep error shown */
    }
  }

  return (
    <div>
      <textarea
        aria-label={rest['aria-label'] ?? 'JSON editor'}
        className={`w-full rounded-md border bg-white p-3 font-mono text-xs leading-5 ${
          error ? 'border-red-400' : 'border-slate-300'
        } focus:outline-none focus:ring-2 focus:ring-brand-500`}
        rows={minRows}
        value={text}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(e) => handleChange(e.target.value)}
      />
      <div className="mt-1 flex items-center justify-between">
        {error ? (
          <p role="alert" className="text-xs text-red-600">
            Invalid JSON: {error}
          </p>
        ) : (
          <p className="text-xs text-slate-400">Valid JSON</p>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={format}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Format
          </button>
        )}
      </div>
    </div>
  );
}
