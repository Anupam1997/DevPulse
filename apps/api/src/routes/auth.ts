import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma, UserRole } from '@devpulse/db';
import { generateWebhookSecret } from '@devpulse/utils';
import { UserRole as UserRoleType } from '@devpulse/types';
import { AuthRequest, authMiddleware, signAccessToken, issueRefreshToken, setRefreshCookie, clearRefreshCookie, hashToken, REFRESH_COOKIE_NAME, assertUser } from '../middleware/auth';
import { paramId } from '../utils/params';
import { decryptFromString, encryptToString } from '../utils/encryption';
import { loadEnv } from '../config/env';
import { sendError } from '../lib/response';

export const authRouter = Router();
const env = loadEnv();

function getWebhookSecret(stored: string): string {
  return decryptFromString(stored, env.ENCRYPTION_KEY);
}

function storeWebhookSecret(secret: string): string {
  return encryptToString(secret, env.ENCRYPTION_KEY);
}

const loginSchema = z.object({
  githubId: z.string(),
  username: z.string(),
  avatarUrl: z.string().optional(),
  email: z.string().email().optional(),
  preferredOrgId: z.string().optional(),
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login or register via GitHub profile
 *     tags: [Auth]
 */
authRouter.post('/login', async (req, res: Response) => {
  const data = await loginSchema.parseAsync(req.body);

  const user = await prisma.user.upsert({
    where: { githubId: data.githubId },
    create: {
      githubId: data.githubId,
      username: data.username,
      avatarUrl: data.avatarUrl ?? null,
      email: data.email ?? null,
    },
    update: {
      username: data.username,
      avatarUrl: data.avatarUrl,
      email: data.email,
    },
    include: {
      memberships: {
        where: { deletedAt: null },
        include: { org: { select: { id: true, name: true } } },
      },
    },
  });

  const orgs = user.memberships.map((m) => ({ id: m.org.id, name: m.org.name, role: m.role }));

  if (user.memberships.length === 0) {
    const token = signAccessToken({
      userId: user.id,
      githubId: user.githubId,
      username: user.username,
    });
    const refreshToken = await issueRefreshToken(user.id, null);
    setRefreshCookie(res, refreshToken);

    res.json({
      token,
      refreshToken,
      user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
      needsOnboarding: true,
      needsOrgSelection: false,
      orgs: [],
    });
    return;
  }

  let selectedMembership = user.memberships[0];
  if (data.preferredOrgId) {
    const preferred = user.memberships.find((m) => m.orgId === data.preferredOrgId);
    if (preferred) selectedMembership = preferred;
  }

  if (user.memberships.length > 1 && !data.preferredOrgId) {
    const token = signAccessToken({
      userId: user.id,
      githubId: user.githubId,
      username: user.username,
    });
    const refreshToken = await issueRefreshToken(user.id, null);
    setRefreshCookie(res, refreshToken);

    res.json({
      token,
      refreshToken,
      user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
      needsOnboarding: false,
      needsOrgSelection: true,
      orgs,
    });
    return;
  }

  const token = signAccessToken({
    userId: user.id,
    orgId: selectedMembership.orgId,
    role: selectedMembership.role as UserRoleType,
    githubId: user.githubId,
    username: user.username,
  });
  const refreshToken = await issueRefreshToken(user.id, selectedMembership.orgId);
  setRefreshCookie(res, refreshToken);

  res.json({
    token,
    refreshToken,
    user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
    needsOnboarding: false,
    needsOrgSelection: false,
    orgs,
  });
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using httpOnly cookie
 *     tags: [Auth]
 */
authRouter.post('/refresh', async (req, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!rawToken) {
    sendError(res, 401, 'Unauthorized', 'Missing refresh token');
    return;
  }

  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    clearRefreshCookie(res);
    sendError(res, 401, 'Unauthorized', 'Invalid refresh token');
    return;
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: stored.userId },
  });

  let payload: {
    userId: string;
    orgId?: string;
    role?: UserRoleType;
    githubId: string;
    username: string;
  } = {
    userId: user.id,
    githubId: user.githubId,
    username: user.username,
  };

  if (stored.orgId) {
    const membership = await prisma.orgMembership.findFirst({
      where: { userId: user.id, orgId: stored.orgId, deletedAt: null },
    });
    if (membership) {
      payload = {
        userId: user.id,
        orgId: stored.orgId,
        role: membership.role as UserRoleType,
        githubId: user.githubId,
        username: user.username,
      };
    }
  }

  const accessToken = signAccessToken(payload);
  res.json({ token: accessToken });
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke refresh token and clear cookie
 *     tags: [Auth]
 */
authRouter.post('/logout', async (req, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(res);
  res.json({ success: true });
});

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  githubOrgId: z.string().optional(),
});

authRouter.post('/orgs', authMiddleware, async (req: AuthRequest, res: Response) => {
  const data = await createOrgSchema.parseAsync(req.body);
  const userId = assertUser(req).userId;
  const plainSecret = generateWebhookSecret();

  const org = await prisma.organization.create({
    data: {
      name: data.name,
      githubOrgId: data.githubOrgId ?? null,
      webhookSecret: storeWebhookSecret(plainSecret),
      members: {
        create: { userId, role: UserRole.OWNER },
      },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const token = signAccessToken({
    userId,
    orgId: org.id,
    role: UserRoleType.OWNER,
    githubId: user.githubId,
    username: user.username,
  });

  res.status(201).json({
    org: { id: org.id, name: org.name },
    webhookSecret: plainSecret,
    token,
  });
});

authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = assertUser(req);
  const record = await prisma.user.findUnique({
    where: { id: user.userId },
    include: {
      memberships: {
        where: { deletedAt: null },
        include: { org: { select: { id: true, name: true } } },
      },
    },
  });

  if (!record) {
    sendError(res, 404, 'NotFound', 'User not found');
    return;
  }

  res.json({
    user: { id: record.id, username: record.username, avatarUrl: record.avatarUrl, email: record.email },
    orgs: record.memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      role: m.role,
    })),
    currentOrgId: user.orgId ?? null,
  });
});

const switchOrgSchema = z.object({
  orgId: z.string(),
});

authRouter.post('/switch-org', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orgId } = await switchOrgSchema.parseAsync(req.body);
  const userId = assertUser(req).userId;

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, orgId, deletedAt: null },
  });

  if (!membership) {
    sendError(res, 403, 'Forbidden', 'Not a member of this org');
    return;
  }

  const userRecord = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const token = signAccessToken({
    userId,
    orgId,
    role: membership.role as UserRoleType,
    githubId: userRecord.githubId,
    username: userRecord.username,
  });

  const refreshToken = await issueRefreshToken(userId, orgId);
  setRefreshCookie(res, refreshToken);

  res.json({ token, refreshToken });
});

authRouter.get('/orgs/:orgId/webhook-secret', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const userId = assertUser(req).userId;

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, orgId, deletedAt: null },
  });

  if (!membership || membership.role !== UserRole.OWNER) {
    sendError(res, 403, 'Forbidden', 'Owner access required');
    return;
  }

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  res.json({ webhookSecret: getWebhookSecret(org.webhookSecret) });
});

authRouter.post('/orgs/:orgId/regenerate-secret', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const userId = assertUser(req).userId;

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, orgId, deletedAt: null },
  });

  if (!membership || membership.role !== UserRole.OWNER) {
    sendError(res, 403, 'Forbidden', 'Owner access required');
    return;
  }

  const newSecret = generateWebhookSecret();
  await prisma.organization.update({
    where: { id: orgId },
    data: { webhookSecret: storeWebhookSecret(newSecret) },
  });

  res.json({ webhookSecret: newSecret });
});
