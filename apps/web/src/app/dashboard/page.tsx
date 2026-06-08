'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { GitCommit, GitMerge, Eye, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { SignOutButton } from '@/components/SignOutButton';
import { ApiError } from '@/lib/api';
import { MetricCard } from '@/components/MetricCard';
import { VelocityChart } from '@/components/VelocityChart';
import { BurndownChart } from '@/components/BurndownChart';
import { ActivityFeed } from '@/components/ActivityFeed';
import { ContributorLeaderboard } from '@/components/ContributorLeaderboard';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useOrg, useMetrics, useEvents, useLeaderboard } from '@/hooks/useOrgData';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading, isError, error } = useOrg();
  const orgId = me?.currentOrgId;

  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: metrics } = useMetrics(orgId, from, to);
  const { data: eventsData } = useEvents(orgId);
  const { data: leaderboard } = useLeaderboard(orgId);

  useRealtimeEvents(orgId);

  useEffect(() => {
    if (me?.user && !me.currentOrgId && me.orgs.length === 0) {
      router.push('/onboarding');
    }
  }, [me, router]);

  if (meLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !me) {
    const isUnauthorized =
      error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
    const isOffline = error instanceof TypeError || (error instanceof ApiError && error.statusCode >= 500);

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-semibold text-slate-900">
          {isUnauthorized ? 'Session expired or not connected' : 'Cannot reach the API'}
        </p>
        <p className="max-w-md text-sm text-slate-500">
          {isUnauthorized
            ? 'Sign out and sign back in with GitHub to refresh your connection to the backend.'
            : isOffline
              ? 'Make sure the API is running on port 4000. From the project root, run npm run dev.'
              : 'Something went wrong loading your account. Try signing in again.'}
        </p>
        <SignOutButton
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          label="Sign out"
        />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const summary = metrics?.summary ?? {
    totalCommits: 0,
    totalMergedPRs: 0,
    reviewCoverage: 0,
    avgPRCycleTimeHours: null as number | null,
  };

  return (
    <DashboardLayout orgs={me.orgs} currentOrgId={orgId}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">Team engineering activity overview</p>
          </div>
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total Commits" value={summary.totalCommits} icon={GitCommit} />
          <MetricCard title="PRs Merged" value={summary.totalMergedPRs} icon={GitMerge} />
          <MetricCard
            title="Review Coverage"
            value={`${summary.reviewCoverage}%`}
            icon={Eye}
          />
          <MetricCard
            title="Avg PR Cycle Time"
            value={
              summary.avgPRCycleTimeHours != null ? `${summary.avgPRCycleTimeHours}h` : '—'
            }
            icon={Clock}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ErrorBoundary>
            <VelocityChart data={metrics?.velocity ?? []} />
          </ErrorBoundary>
          <ErrorBoundary>
            <BurndownChart data={metrics?.burndown ?? []} />
          </ErrorBoundary>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ErrorBoundary>
            <ContributorLeaderboard
              entries={leaderboard?.entries ?? []}
              period={leaderboard?.period ?? 'week'}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <ActivityFeed events={eventsData?.data ?? []} />
          </ErrorBoundary>
        </div>
      </div>
    </DashboardLayout>
  );
}
