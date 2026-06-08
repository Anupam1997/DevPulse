'use client';

import Image from 'next/image';
import { Trophy, Flame } from 'lucide-react';
import { LeaderboardEntry } from '@devpulse/types';
import { cn } from '@/lib/utils';

interface ContributorLeaderboardProps {
  entries: LeaderboardEntry[];
  period: string;
}

export function ContributorLeaderboard({ entries, period }: ContributorLeaderboardProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Contributor Leaderboard</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 capitalize">
          {period}
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">No activity yet this period</div>
      ) : (
        <div className="divide-y divide-surface-border">
          {entries.map((entry) => (
            <div key={entry.userId} className="flex items-center gap-4 px-5 py-3.5">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  entry.rank === 1 && 'bg-amber-100 text-amber-700',
                  entry.rank === 2 && 'bg-slate-200 text-slate-600',
                  entry.rank === 3 && 'bg-orange-100 text-orange-700',
                  entry.rank > 3 && 'bg-slate-50 text-slate-400',
                )}
              >
                {entry.rank <= 3 ? <Trophy className="h-3.5 w-3.5" /> : entry.rank}
              </div>
              {entry.avatarUrl ? (
                <Image
                  src={entry.avatarUrl}
                  alt={entry.username}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {entry.username[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{entry.username}</span>
                  {entry.streak >= 3 && (
                    <span className="flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                      <Flame className="h-3 w-3" />
                      {entry.streak}d streak
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex gap-3 text-xs text-slate-500">
                  <span>{entry.commits} commits</span>
                  <span>{entry.prsMerged} PRs merged</span>
                  <span>{entry.reviews} reviews</span>
                </div>
              </div>
              <div className="text-sm font-semibold text-brand-600">
                {entry.commits + entry.prsMerged * 3 + entry.reviews * 2} pts
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
