'use client';

import { DashboardLayout } from '@/components/DashboardLayout';
import { RepoCard } from '@/components/RepoCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useOrg, useRepos } from '@/hooks/useOrgData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';

export default function ReposPage() {
  const { data: me, isLoading } = useOrg();
  const orgId = me?.currentOrgId;
  const { data: repos, isLoading: reposLoading, isError: reposError } = useRepos(orgId);
  useRealtimeEvents(orgId);

  if (isLoading || !me || !orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardLayout orgs={me.orgs} currentOrgId={orgId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Repositories</h1>
          <p className="text-sm text-slate-500">Activity across connected repositories</p>
        </div>

        {reposError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load repositories. Check that the API is running.
          </div>
        )}

        {reposLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : repos && repos.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((repo) => (
              <ErrorBoundary key={repo.id}>
                <RepoCard repo={repo} />
              </ErrorBoundary>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-surface-border bg-white p-12 text-center">
            <p className="text-sm text-slate-500">
              No repositories yet. Connect your GitHub webhook to start tracking activity.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
