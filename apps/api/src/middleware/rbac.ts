import { Response, NextFunction } from 'express';
import { prisma, UserRole } from '@devpulse/db';
import { AuthRequest } from './auth';
import { paramId } from '../utils/params';

const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();
const ROLE_CACHE_TTL_MS = 60_000;

async function getMembershipRole(userId: string, orgId: string): Promise<UserRole | null> {
  const cacheKey = `${userId}:${orgId}:role`;
  const cached = roleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, orgId, deletedAt: null },
    select: { role: true },
  });

  if (!membership) return null;

  roleCache.set(cacheKey, { role: membership.role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
  return membership.role;
}

export function requireRole(requiredRole: 'OWNER' | 'MEMBER') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    void (async () => {
      const orgId = paramId(req.params.orgId);
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated', statusCode: 401 });
        return;
      }

      const role = await getMembershipRole(req.user.userId, orgId);
      if (!role) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (requiredRole === 'OWNER' && role !== UserRole.OWNER) {
        res.status(403).json({ error: 'Forbidden', message: 'Owner access required', statusCode: 403 });
        return;
      }

      next();
    })().catch(next);
  };
}
