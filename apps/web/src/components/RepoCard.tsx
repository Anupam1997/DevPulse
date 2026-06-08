'use client';

import { GitBranch, GitPullRequest } from 'lucide-react';
import { RepoActivity } from '@devpulse/types';
import { formatRelativeTime } from '@/lib/utils';

interface RepoCardProps {
  repo: RepoActivity;
}

export function RepoCard({ repo }: RepoCardProps) {
  const maxActivity = Math.max(...repo.activitySparkline, 1);

  return (
    <div className="rounded-xl border border-surface-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-100 p-2">
            <GitBranch className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{repo.name}</h4>
            <p className="text-xs text-slate-400">{repo.fullName}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            repo.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {repo.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-1 h-8">
        {repo.activitySparkline.map((count, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-brand-200 transition-all"
            style={{
              height: `${Math.max(4, (count / maxActivity) * 100)}%`,
              opacity: 0.4 + (count / maxActivity) * 0.6,
            }}
            title={`${count} events`}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <GitPullRequest className="h-3.5 w-3.5" />
          <span>{repo.openPRs} open PRs</span>
        </div>
        {repo.lastCommitAt && (
          <span>Last commit {formatRelativeTime(repo.lastCommitAt)}</span>
        )}
      </div>
    </div>
  );
}
