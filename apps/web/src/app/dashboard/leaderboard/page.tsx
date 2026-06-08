'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ContributorLeaderboard } from '@/components/ContributorLeaderboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useOrg, useLeaderboard } from '@/hooks/useOrgData';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
] as const;

export default function LeaderboardPage() {
  const { data: me, isLoading } = useOrg();
  const orgId = me?.currentOrgId;
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const { data: leaderboard, isLoading: lbLoading, isError: lbError } = useLeaderboard(orgId, period);

  if (isLoading || !me || !orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardLayout orgs={me.orgs} currentOrgId={orgId}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Leaderboard</h1>
            <p className="text-sm text-slate-500">Top contributors by activity score</p>
          </div>
          <div className="flex rounded-lg border border-surface-border bg-white p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  period === p.value
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {lbError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load leaderboard data.
          </div>
        )}

        {lbLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        ) : (
        <ErrorBoundary>
          <ContributorLeaderboard
            entries={leaderboard?.entries ?? []}
            period={leaderboard?.period ?? period}
          />
        </ErrorBoundary>
        )}
      </div>
    </DashboardLayout>
  );
}
