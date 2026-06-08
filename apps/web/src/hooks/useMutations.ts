'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export function useCreateSprintMutation(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      startDate: string;
      endDate: string;
      goalPoints: number;
    }) => {
      if (!orgId) throw new Error('useCreateSprintMutation called without orgId');
      return api.createSprint(orgId, data);
    },
    onSuccess: () => {
      toast.success('Sprint created!');
      queryClient.invalidateQueries({ queryKey: ['sprints', orgId] });
      queryClient.invalidateQueries({ queryKey: ['metrics', orgId] });
    },
    onError: () => toast.error('Failed to create sprint'),
  });
}

export function useRegenerateWebhookSecretMutation(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error('useRegenerateWebhookSecretMutation called without orgId');
      return api.regenerateWebhookSecret(orgId);
    },
    onSuccess: () => {
      toast.success('Webhook secret regenerated');
      queryClient.invalidateQueries({ queryKey: ['webhook-status', orgId] });
    },
    onError: () => toast.error('Failed to regenerate secret'),
  });
}

export function useLoadWebhookSecretMutation(orgId: string | null | undefined) {
  return useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error('useLoadWebhookSecretMutation called without orgId');
      return api.getWebhookSecret(orgId);
    },
    onError: () => toast.error('Failed to load webhook secret'),
  });
}
