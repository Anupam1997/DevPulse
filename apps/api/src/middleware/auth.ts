import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@devpulse/db';
import { JwtPayload } from '@devpulse/types';
import { loadEnv } from '../config/env';
import { paramId } from '../utils/params';

const env = loadEnv();

export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;
export const REFRESH_COOKIE_NAME = 'devpulse_refresh';

const membershipCache = new Map<string, { result: boolean; expiresAt: number }>();
const MEMBERSHIP_CACHE_TTL_MS = 60_000;

async function hasActiveMembership(userId: string, orgId: string): Promise<boolean> {
  const cacheKey = `${userId}:${orgId}`;
  const cached = membershipCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, orgId, deletedAt: null },
  });

  const result = membership !== null;
  membershipCache.set(cacheKey, { result, expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS });
  return result;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function assertUser(req: AuthRequest): NonNullable<AuthRequest['user']> {
  if (!req.user) {
    throw new Error('assertUser called without authenticated user');
  }
  return req.user;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signToken(payload: JwtPayload): string {
  return signAccessToken(payload);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshTokenValue(): string {
  return randomBytes(48).toString('base64url');
}

export async function issueRefreshToken(userId: string, orgId?: string | null): Promise<string> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = generateRefreshTokenValue();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      orgId: orgId ?? null,
      tokenHash,
      expiresAt,
    },
  });

  return token;
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/auth',
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token', statusCode: 401 });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token', statusCode: 401 });
  }
}

export function requireOrgAccess(req: AuthRequest, res: Response, next: NextFunction): void {
  void (async () => {
    const orgId = paramId(req.params.orgId);
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated', statusCode: 401 });
      return;
    }
    if (!req.user.orgId) {
      res.status(403).json({ error: 'Forbidden', message: 'Complete onboarding first', statusCode: 403 });
      return;
    }
    if (req.user.orgId !== orgId) {
      res.status(403).json({ error: 'Forbidden', message: 'Not a member of this organization', statusCode: 403 });
      return;
    }

    const active = await hasActiveMembership(req.user.userId, orgId);
    if (!active) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  })().catch(next);
}
