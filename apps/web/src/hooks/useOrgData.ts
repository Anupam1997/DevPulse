'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useOrg() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
  });
}

/** Returns the active org id from /auth/me, or undefined while loading / unset. */
export function useRequiredOrgId(): string | undefined {
  const { data: me } = useOrg();
  return me?.currentOrgId ?? undefined;
}

export function useMetrics(orgId: string | null | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: ['metrics', orgId, from, to],
    queryFn: () => {
      if (!orgId) throw new Error('useMetrics called without orgId');
      return api.getMetrics(orgId, from, to);
    },
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
}

export function useLeaderboard(orgId: string | null | undefined, period = 'week') {
  return useQuery({
    queryKey: ['leaderboard', orgId, period],
    queryFn: () => {
      if (!orgId) throw new Error('useLeaderboard called without orgId');
      return api.getLeaderboard(orgId, period);
    },
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
}

export function useRepos(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['repos', orgId],
    queryFn: () => {
      if (!orgId) throw new Error('useRepos called without orgId');
      return api.getRepos(orgId);
    },
    enabled: !!orgId,
  });
}

export function useEvents(orgId: string | null | undefined, page = 1) {
  return useQuery({
    queryKey: ['events', orgId, page],
    queryFn: () => {
      if (!orgId) throw new Error('useEvents called without orgId');
      return api.getEvents(orgId, page);
    },
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
}

export function useWebhookStatus(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['webhook-status', orgId],
    queryFn: () => {
      if (!orgId) throw new Error('useWebhookStatus called without orgId');
      return api.getWebhookStatus(orgId);
    },
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
}

export function useSprintsQuery(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['sprints', orgId],
    queryFn: () => {
      if (!orgId) throw new Error('useSprintsQuery called without orgId');
      return api.getSprints(orgId);
    },
    enabled: !!orgId,
  });
}

export function useSprintDetail(orgId: string | null | undefined, sprintId: string | null | undefined) {
  return useQuery({
    queryKey: ['sprint', orgId, sprintId],
    queryFn: () => {
      if (!orgId || !sprintId) throw new Error('useSprintDetail called without orgId or sprintId');
      return api.getSprint(orgId, sprintId);
    },
    enabled: !!orgId && !!sprintId,
  });
}
