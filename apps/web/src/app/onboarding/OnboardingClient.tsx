'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { api, setAuthToken } from '@/lib/api';
import { toast } from 'sonner';

interface OnboardingClientProps {
  username: string;
}

export function OnboardingClient({ username }: OnboardingClientProps) {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;

    setLoading(true);
    try {
      const result = await api.createOrg({ name: orgName.trim() });
      setAuthToken(result.token);
      toast.success('Organization created!');
      router.push('/dashboard/settings');
    } catch (err) {
      toast.error('Failed to create organization');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-white p-8 shadow-lg">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
          <Building2 className="h-6 w-6 text-brand-600" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Welcome, {username}!
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Create your organization to start tracking GitHub activity across your team.
        </p>

        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-slate-700">
              Organization name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Engineering"
              className="mt-1.5 w-full rounded-lg border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !orgName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Create organization
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
