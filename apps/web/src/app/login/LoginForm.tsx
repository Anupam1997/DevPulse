'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Github, Activity, AlertCircle } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  BackendUnavailable:
    'Could not connect to the DevPulse API. Make sure the backend is running on port 4000, then try again.',
  AccessDenied: 'Sign in was denied. Please try again.',
};

export default function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorMessage = error ? ERROR_MESSAGES[error] ?? 'Sign in failed. Please try again.' : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-surface-border bg-white p-8 shadow-xl shadow-slate-200/50">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/25">
              <Activity className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-5 text-2xl font-bold text-slate-900">Welcome to DevPulse</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in with GitHub to track your team&apos;s engineering activity
            </p>
          </div>

          {errorMessage && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </button>

          <p className="mt-6 text-center text-xs text-slate-400">
            By signing in, you agree to connect your GitHub account for activity tracking.
          </p>
        </div>
      </div>
    </div>
  );
}
