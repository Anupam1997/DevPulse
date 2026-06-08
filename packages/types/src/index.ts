export enum EventType {
  COMMIT = 'COMMIT',
  PR_OPENED = 'PR_OPENED',
  PR_MERGED = 'PR_MERGED',
  PR_REVIEWED = 'PR_REVIEWED',
  ISSUE_OPENED = 'ISSUE_OPENED',
  ISSUE_CLOSED = 'ISSUE_CLOSED',
  BRANCH_CREATED = 'BRANCH_CREATED',
  TAG_CREATED = 'TAG_CREATED',
}

export enum UserRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export interface JwtPayload {
  userId: string;
  orgId?: string;
  role?: UserRole;
  githubId: string;
  username: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  db: boolean;
  redis: boolean;
  uptime: number;
}

export interface MetricsResponse {
  velocity: Array<{ date: string; commits: number; mergedPRs: number }>;
  burndown: Array<{ date: string; ideal: number; actual: number }>;
  summary: {
    totalCommits: number;
    totalMergedPRs: number;
    reviewCoverage: number;
    avgPRCycleTimeHours: number | null;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  commits: number;
  prsMerged: number;
  reviews: number;
  streak: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  period: string;
}

export interface RepoActivity {
  id: string;
  githubRepoId: string;
  name: string;
  fullName: string;
  isActive: boolean;
  lastCommitAt: string | null;
  openPRs: number;
  activitySparkline: number[];
}

export interface EventFeedItem {
  id: string;
  type: EventType;
  actor: { id: string; username: string; avatarUrl: string | null };
  repo: { id: string; name: string; fullName: string };
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SprintSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goalPoints: number;
}

export interface SprintDetail {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goalPoints: number;
  metrics: Array<{
    date: string;
    velocity: number;
    burndown: number;
    openPRs: number;
    mergedPRs: number;
    commits: number;
  }>;
  burndown: Array<{ date: string; ideal: number; actual: number }>;
}

export interface CreateSprintRequest {
  name: string;
  startDate: string;
  endDate: string;
  goalPoints: number;
}

export interface RealtimeEvent {
  type: 'event';
  payload: EventFeedItem;
}

export interface GitHubWebhookJob {
  eventType: string;
  deliveryId: string;
  payload: Record<string, unknown>;
  orgId?: string;
}
