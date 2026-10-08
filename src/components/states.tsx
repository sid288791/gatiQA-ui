import type { ReactNode } from 'react';
import { ApiError } from '../api';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isAuth = error instanceof ApiError && error.isAuth;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-800">
        {isAuth ? 'Not authorized' : 'Error'}
      </p>
      <p className="mt-1 text-sm text-red-700">
        {isAuth
          ? 'You are not authorized to perform this action. Check your credentials or permissions.'
          : message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200"
        >
          Retry
        </button>
      )}
    </div>
  );
}
