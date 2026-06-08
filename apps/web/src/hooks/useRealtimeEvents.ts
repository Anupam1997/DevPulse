'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { EventType, RealtimeEvent } from '@devpulse/types';
import { API_URL, getAuthToken, getTokenOrgId } from '@/lib/api';

const SIGNIFICANT_EVENTS = new Set([
  EventType.PR_MERGED,
  EventType.PR_OPENED,
  EventType.ISSUE_CLOSED,
]);

export function useRealtimeEvents(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const token = getAuthToken();
    const tokenOrgId = getTokenOrgId();
    if (!token || !tokenOrgId) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('realtime', (event: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: ['metrics', orgId] });
      queryClient.invalidateQueries({ queryKey: ['events', orgId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard', orgId] });
      queryClient.invalidateQueries({ queryKey: ['repos', orgId] });

      if (SIGNIFICANT_EVENTS.has(event.payload.type)) {
        const label = event.payload.type.replace(/_/g, ' ').toLowerCase();
        toast.info(`${event.payload.actor.username} — ${label}`, {
          description: event.payload.repo.fullName,
        });
      }
    });

    socket.on('connect_error', (err) => {
      if (err.message.includes('No org selected')) {
        socket.disconnect();
        return;
      }
      console.warn('Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orgId, queryClient]);

  return socketRef;
}
