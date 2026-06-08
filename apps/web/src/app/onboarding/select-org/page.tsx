'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { api, setAuthToken, setPreferredOrgId } from '@/lib/api';

export default function SelectOrgPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orgs = session?.orgs ?? [];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  async function handleSelect(orgId: string) {
    setSelecting(orgId);
    setError(null);
    try {
      const { token, refreshToken } = await api.switchOrg(orgId);
      setAuthToken(token);
      setPreferredOrgId(orgId);

      if (refreshToken) {
        await fetch('/api/auth/set-refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refreshToken }),
        });
      }

      await update({ apiToken: token, needsOrgSelection: false });
      router.push('/dashboard');
    } catch {
      setError('Failed to select organization. Please try again.');
    } finally {
      setSelecting(null);
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!session || orgs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-500">No organizations available.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold text-slate-900">Choose an organization</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account belongs to multiple organizations. Select one to continue.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ul className="mt-6 space-y-2">
          {orgs.map((org) => (
            <li key={org.id}>
              <button
                type="button"
                onClick={() => handleSelect(org.id)}
                disabled={selecting !== null}
                className="flex w-full items-center gap-3 rounded-xl border border-surface-border px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
              >
                <Building2 className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{org.name}</p>
                  <p className="text-xs capitalize text-slate-500">{org.role.toLowerCase()}</p>
                </div>
                {selecting === org.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
