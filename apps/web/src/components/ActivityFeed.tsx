'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { GitCommit, GitPullRequest, MessageSquare, CircleDot, GitBranch, Tag } from 'lucide-react';
import { EventFeedItem, EventType } from '@devpulse/types';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const EVENT_CONFIG: Record<
  EventType,
  { icon: typeof GitCommit; color: string; label: string }
> = {
  [EventType.COMMIT]: { icon: GitCommit, color: 'text-emerald-600 bg-emerald-50', label: 'committed' },
  [EventType.PR_OPENED]: { icon: GitPullRequest, color: 'text-blue-600 bg-blue-50', label: 'opened PR' },
  [EventType.PR_MERGED]: { icon: GitPullRequest, color: 'text-purple-600 bg-purple-50', label: 'merged PR' },
  [EventType.PR_REVIEWED]: { icon: MessageSquare, color: 'text-amber-600 bg-amber-50', label: 'reviewed PR' },
  [EventType.ISSUE_OPENED]: { icon: CircleDot, color: 'text-red-600 bg-red-50', label: 'opened issue' },
  [EventType.ISSUE_CLOSED]: { icon: CircleDot, color: 'text-slate-600 bg-slate-50', label: 'closed issue' },
  [EventType.BRANCH_CREATED]: { icon: GitBranch, color: 'text-teal-600 bg-teal-50', label: 'created branch' },
  [EventType.TAG_CREATED]: { icon: Tag, color: 'text-indigo-600 bg-indigo-50', label: 'created tag' },
};

interface ActivityFeedProps {
  events: EventFeedItem[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-white shadow-sm">
      <div className="border-b border-surface-border px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Activity Feed</h3>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No activity yet — connect your GitHub webhook to start tracking
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event) => {
              const config = EVENT_CONFIG[event.type];
              const Icon = config.icon;
              const title =
                (event.metadata.title as string) ||
                (event.metadata.commits as Array<{ message: string }>)?.[0]?.message?.slice(0, 60) ||
                event.repo.name;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3 border-b border-surface-border px-5 py-3.5 last:border-0"
                >
                  <div className={cn('rounded-lg p-2', config.color.split(' ')[1])}>
                    <Icon className={cn('h-4 w-4', config.color.split(' ')[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">{event.actor.username}</span>{' '}
                      {config.label}{' '}
                      <span className="font-medium">{title}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {event.repo.fullName} · {formatRelativeTime(event.occurredAt)}
                    </p>
                  </div>
                  {event.actor.avatarUrl && (
                    <Image
                      src={event.actor.avatarUrl}
                      alt={event.actor.username}
                      width={28}
                      height={28}
                      className="rounded-full shrink-0"
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
