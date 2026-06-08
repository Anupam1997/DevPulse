import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      needsOnboarding?: boolean;
    } & DefaultSession['user'];
    accessToken?: string;
    refreshToken?: string;
    needsOrgSelection?: boolean;
    orgs?: Array<{ id: string; name: string; role: string }>;
  }

  interface User {
    needsOnboarding?: boolean;
    needsOrgSelection?: boolean;
    apiToken?: string;
    refreshToken?: string;
    orgs?: Array<{ id: string; name: string; role: string }>;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    username?: string;
    avatarUrl?: string;
    needsOnboarding?: boolean;
    needsOrgSelection?: boolean;
    apiToken?: string;
    refreshToken?: string;
    githubAccessToken?: string;
    orgs?: Array<{ id: string; name: string; role: string }>;
  }
}
