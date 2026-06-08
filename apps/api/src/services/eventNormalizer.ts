import { EventType } from '@devpulse/db';
import { formatDate, structuredLog } from '@devpulse/utils';

interface GitHubSender {
  id: number;
  login: string;
  avatar_url?: string;
  email?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
}

export function normalizeEventType(
  githubEvent: string,
  payload: Record<string, unknown>,
): EventType | null {
  switch (githubEvent) {
    case 'push': {
      const ref = payload.ref as string;
      if (ref?.startsWith('refs/heads/')) return EventType.COMMIT;
      return null;
    }
    case 'pull_request': {
      const action = payload.action as string;
      if (action === 'opened') return EventType.PR_OPENED;
      if (action === 'closed') {
        const pr = payload.pull_request as Record<string, unknown>;
        if (pr?.merged) return EventType.PR_MERGED;
      }
      return null;
    }
    case 'pull_request_review':
      return EventType.PR_REVIEWED;
    case 'issues': {
      const action = payload.action as string;
      if (action === 'opened') return EventType.ISSUE_OPENED;
      if (action === 'closed') return EventType.ISSUE_CLOSED;
      return null;
    }
    case 'create': {
      const refType = payload.ref_type as string;
      if (refType === 'branch') return EventType.BRANCH_CREATED;
      if (refType === 'tag') return EventType.TAG_CREATED;
      return null;
    }
    default:
      return null;
  }
}

export function extractGithubId(
  eventType: EventType,
  payload: Record<string, unknown>,
): string {
  switch (eventType) {
    case EventType.COMMIT: {
      const head = payload.after as string;
      return head || `push-${Date.now()}`;
    }
    case EventType.PR_OPENED:
    case EventType.PR_MERGED: {
      const pr = payload.pull_request as Record<string, unknown>;
      return String(pr?.id || '');
    }
    case EventType.PR_REVIEWED: {
      const review = payload.review as Record<string, unknown>;
      return String(review?.id || '');
    }
    case EventType.ISSUE_OPENED:
    case EventType.ISSUE_CLOSED: {
      const issue = payload.issue as Record<string, unknown>;
      return String(issue?.id || '');
    }
    case EventType.BRANCH_CREATED:
    case EventType.TAG_CREATED: {
      const ref = payload.ref as string;
      const repo = payload.repository as Record<string, unknown> | undefined;
      return `${repo?.id ?? 'repo'}-${payload.ref_type}-${ref}`;
    }
    default:
      return String(Date.now());
  }
}

export function extractMetadata(
  eventType: EventType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  switch (eventType) {
    case EventType.COMMIT: {
      const commits = payload.commits as Array<Record<string, unknown>> | undefined;
      return {
        ref: payload.ref,
        commitCount: commits?.length ?? 0,
        commits: commits?.slice(0, 5).map((c) => ({
          id: c.id,
          message: c.message,
          author: (c.author as Record<string, unknown>)?.username,
        })),
      };
    }
    case EventType.PR_OPENED:
    case EventType.PR_MERGED: {
      const pr = payload.pull_request as Record<string, unknown>;
      return {
        number: pr?.number,
        title: pr?.title,
        state: pr?.state,
        merged: pr?.merged,
        additions: pr?.additions,
        deletions: pr?.deletions,
      };
    }
    case EventType.PR_REVIEWED: {
      const review = payload.review as Record<string, unknown>;
      const pr = payload.pull_request as Record<string, unknown>;
      return {
        state: review?.state,
        prNumber: pr?.number,
        prTitle: pr?.title,
      };
    }
    case EventType.ISSUE_OPENED:
    case EventType.ISSUE_CLOSED: {
      const issue = payload.issue as Record<string, unknown>;
      return {
        number: issue?.number,
        title: issue?.title,
        state: issue?.state,
      };
    }
    case EventType.BRANCH_CREATED:
    case EventType.TAG_CREATED:
      return {
        ref: payload.ref,
        refType: payload.ref_type,
        masterBranch: payload.master_branch,
      };
    default:
      return {};
  }
}

export function extractSender(payload: Record<string, unknown>): GitHubSender | null {
  const sender = payload.sender as GitHubSender | undefined;
  if (sender?.id) return sender;

  if (payload.pusher) {
    const pusher = payload.pusher as { name: string; email?: string };
    return { id: 0, login: pusher.name, email: pusher.email };
  }

  const pr = payload.pull_request as Record<string, unknown> | undefined;
  if (pr?.user) return pr.user as GitHubSender;

  return null;
}

export function extractRepo(payload: Record<string, unknown>): GitHubRepo | null {
  const repo = payload.repository as GitHubRepo | undefined;
  return repo?.id ? repo : null;
}

export function extractOccurredAt(payload: Record<string, unknown>): Date {
  const pr = payload.pull_request as Record<string, unknown> | undefined;
  if (pr?.merged_at) return new Date(pr.merged_at as string);
  if (pr?.created_at) return new Date(pr.created_at as string);

  const issue = payload.issue as Record<string, unknown> | undefined;
  if (issue?.created_at) return new Date(issue.created_at as string);

  const review = payload.review as Record<string, unknown> | undefined;
  if (review?.submitted_at) return new Date(review.submitted_at as string);

  return new Date();
}

export function getCommitCount(eventType: EventType, metadata: Record<string, unknown>): number {
  if (eventType === EventType.COMMIT) {
    return (metadata.commitCount as number) || 1;
  }
  return 0;
}

export { formatDate, structuredLog };
