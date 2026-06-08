import NextAuth, { type NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import jwt from 'jsonwebtoken';
import env from '@/config/env';
import { api, setAuthToken } from './api';

type OrgOption = { id: string; name: string; role: string };

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: env.githubClientId,
      clientSecret: env.githubClientSecret,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github' && profile) {
        try {
          const ghProfile = profile as { id?: number; login?: string; avatar_url?: string; email?: string };
          const result = await api.login({
            githubId: String(ghProfile.id || user.id),
            username: ghProfile.login || user.name || 'unknown',
            avatarUrl: ghProfile.avatar_url || user.image || undefined,
            email: ghProfile.email || user.email || undefined,
          });

          if (!result.token) {
            console.error('[auth] Backend login succeeded but no token issued', {
              githubId: ghProfile.id,
              needsOnboarding: result.needsOnboarding,
            });
            return false;
          }

          if (result.needsOrgSelection) {
            const extended = user as typeof user & {
              apiToken?: string;
              refreshToken?: string;
              needsOrgSelection?: boolean;
              orgs?: OrgOption[];
            };
            extended.apiToken = result.token;
            extended.refreshToken = result.refreshToken;
            extended.needsOrgSelection = true;
            extended.orgs = result.orgs;
            return '/onboarding/select-org';
          }

          setAuthToken(result.token);
          const extended = user as typeof user & {
            apiToken?: string;
            refreshToken?: string;
            needsOnboarding?: boolean;
          };
          extended.apiToken = result.token;
          extended.refreshToken = result.refreshToken;
          extended.needsOnboarding = result.needsOnboarding;
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[auth] Backend login failed:', message, err);
          return false;
        }
      }
      return false;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.username = user.name ?? undefined;
        token.avatarUrl = user.image ?? undefined;
        token.needsOnboarding = (user as typeof user & { needsOnboarding?: boolean }).needsOnboarding;
        token.apiToken = (user as typeof user & { apiToken?: string }).apiToken;
        token.refreshToken = (user as typeof user & { refreshToken?: string }).refreshToken;
        token.needsOrgSelection = (user as typeof user & { needsOrgSelection?: boolean }).needsOrgSelection;
        token.orgs = (user as typeof user & { orgs?: OrgOption[] }).orgs;
      }
      if (account?.access_token) {
        token.githubAccessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.needsOnboarding = token.needsOnboarding as boolean;
        session.accessToken = token.apiToken as string;
        session.refreshToken = token.refreshToken as string | undefined;
        session.needsOrgSelection = token.needsOrgSelection as boolean | undefined;
        session.orgs = token.orgs as OrgOption[] | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.includes('/onboarding')) return `${baseUrl}${url.startsWith('/') ? url : '/onboarding'}`;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  secret: env.nextAuthSecret,
};

const handler = NextAuth(authOptions);
export { handler };

export function createApiJwt(payload: {
  userId: string;
  orgId: string;
  role: string;
  githubId: string;
  username: string;
}): string {
  return jwt.sign(payload, process.env.JWT_SECRET || env.nextAuthSecret, {
    expiresIn: '7d',
  });
}
