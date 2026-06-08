import env from '@/config/env';

const API_URL = env.apiUrl || 'http://localhost:4000';

let authToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

const PREFERRED_ORG_KEY = 'devpulse_preferred_org';

export function setPreferredOrgId(orgId: string | null) {
  if (typeof window !== 'undefined') {
    if (orgId) localStorage.setItem(PREFERRED_ORG_KEY, orgId);
    else localStorage.removeItem(PREFERRED_ORG_KEY);
  }
}

export function getPreferredOrgId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PREFERRED_ORG_KEY);
  }
  return null;
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('devpulse_token', token);
    } else {
      localStorage.removeItem('devpulse_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('devpulse_token');
  }
  return null;
}

/** Reads orgId claim from JWT without verification (client-side gating only). */
export function getTokenOrgId(): string | null {
  const token = getAuthToken();
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1])) as { orgId?: string };
    return typeof payload.orgId === 'string' ? payload.orgId : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { token: string };
      setAuthToken(body.token);
      return body.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, true);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.error || 'Error', body.message || res.statusText);
  }

  return res.json();
}

export const api = {
  login: (data: {
    githubId: string;
    username: string;
    avatarUrl?: string;
    email?: string;
    preferredOrgId?: string;
  }) => {
    const preferredOrgId = data.preferredOrgId ?? getPreferredOrgId() ?? undefined;
    return request<{
      token: string | null;
      refreshToken?: string;
      user: { id: string; username: string; avatarUrl: string | null };
      needsOnboarding: boolean;
      needsOrgSelection?: boolean;
      orgs: Array<{ id: string; name: string; role: string }>;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...data, preferredOrgId }),
    });
  },

  refresh: () => request<{ token: string }>('/auth/refresh', { method: 'POST' }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getMe: () =>
    request<{
      user: { id: string; username: string; avatarUrl: string | null; email: string | null };
      orgs: Array<{ id: string; name: string; role: string }>;
      currentOrgId: string | null;
    }>('/auth/me'),

  createOrg: (data: { name: string; githubOrgId?: string }) =>
    request<{ org: { id: string; name: string }; webhookSecret: string; token: string }>(
      '/auth/orgs',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  switchOrg: (orgId: string) => {
    setPreferredOrgId(orgId);
    return request<{ token: string; refreshToken?: string }>('/auth/switch-org', {
      method: 'POST',
      body: JSON.stringify({ orgId }),
    });
  },

  getMetrics: (orgId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<import('@devpulse/types').MetricsResponse>(
      `/orgs/${orgId}/metrics?${params}`,
    );
  },

  getLeaderboard: (orgId: string, period = 'week') =>
    request<import('@devpulse/types').LeaderboardResponse>(
      `/orgs/${orgId}/leaderboard?period=${period}`,
    ),

  getRepos: (orgId: string) =>
    request<import('@devpulse/types').RepoActivity[]>(`/orgs/${orgId}/repos`),

  getEvents: (orgId: string, page = 1, limit = 20) =>
    request<import('@devpulse/types').PaginatedResponse<import('@devpulse/types').EventFeedItem>>(
      `/orgs/${orgId}/events?page=${page}&limit=${limit}`,
    ),

  createSprint: (
    orgId: string,
    data: { name: string; startDate: string; endDate: string; goalPoints: number },
  ) => request(`/orgs/${orgId}/sprints`, { method: 'POST', body: JSON.stringify(data) }),

  getSprints: (orgId: string) =>
    request<import('@devpulse/types').SprintSummary[]>(`/orgs/${orgId}/sprints`),

  getSprint: (orgId: string, sprintId: string) =>
    request<import('@devpulse/types').SprintDetail>(`/orgs/${orgId}/sprints/${sprintId}`),

  getWebhookStatus: (orgId: string) =>
    request<{ listening: boolean; lastEventAt: string | null }>(
      `/orgs/${orgId}/webhook-status`,
    ),

  getWebhookSecret: (orgId: string) =>
    request<{ webhookSecret: string }>(`/auth/orgs/${orgId}/webhook-secret`),

  regenerateWebhookSecret: (orgId: string) =>
    request<{ webhookSecret: string }>(`/auth/orgs/${orgId}/regenerate-secret`, {
      method: 'POST',
    }),

  inviteMember: (orgId: string, email: string) =>
    request(`/orgs/${orgId}/members`, { method: 'POST', body: JSON.stringify({ email }) }),

  removeMember: (orgId: string, userId: string) =>
    request(`/orgs/${orgId}/members/${userId}`, { method: 'DELETE' }),
};

export { API_URL };
