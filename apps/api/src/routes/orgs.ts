import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma, EventType, UserRole } from '@devpulse/db';
import { formatDateUTC, startOfDay, endOfDay } from '@devpulse/utils';
import { AuthRequest, authMiddleware, requireOrgAccess } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { paramId } from '../utils/params';
import { sendError } from '../lib/response';
import { getMetrics } from '../services/metricsService';
import { getLeaderboard } from '../services/leaderboardService';
import { createSprint, listSprints, getSprintDetail } from '../services/sprintService';

export const orgRouter = Router({ mergeParams: true });

orgRouter.use(authMiddleware);
orgRouter.use(requireOrgAccess);

const memberRoutes = requireRole('MEMBER');
const ownerRoutes = requireRole('OWNER');

const metricsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * @openapi
 * /orgs/{orgId}/metrics:
 *   get:
 *     summary: Velocity and burndown metrics for an organization
 *     tags: [Organizations]
 */
orgRouter.get('/metrics', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const query = await metricsQuerySchema.parseAsync(req.query);
  const to = query.to ? endOfDay(new Date(query.to)) : endOfDay(new Date());
  const from = query.from
    ? startOfDay(new Date(query.from))
    : startOfDay(new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000));

  const metrics = await getMetrics(prisma, orgId, from, to);
  res.json(metrics);
});

const leaderboardQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).default('week'),
});

/**
 * @openapi
 * /orgs/{orgId}/leaderboard:
 *   get:
 *     summary: Contributor leaderboard for an organization
 *     tags: [Organizations]
 */
orgRouter.get('/leaderboard', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const { period } = await leaderboardQuerySchema.parseAsync(req.query);
  const result = await getLeaderboard(prisma, orgId, period);
  res.json(result);
});

/**
 * @openapi
 * /orgs/{orgId}/repos:
 *   get:
 *     summary: Repository activity for an organization
 *     tags: [Organizations]
 */
orgRouter.get('/repos', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);

  const repos = await prisma.repository.findMany({
    where: { orgId },
    include: {
      events: {
        orderBy: { occurredAt: 'desc' },
        take: 30,
        select: { type: true, occurredAt: true },
      },
    },
  });

  const result = repos.map((repo) => {
    const lastCommit = repo.events.find((e) => e.type === EventType.COMMIT);
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return formatDateUTC(d);
    });
    const activitySparkline = last7Days.map(
      (day) => repo.events.filter((e) => formatDateUTC(e.occurredAt) === day).length,
    );

    return {
      id: repo.id,
      githubRepoId: repo.githubRepoId,
      name: repo.name,
      fullName: repo.fullName,
      isActive: repo.isActive,
      lastCommitAt: lastCommit?.occurredAt.toISOString() ?? null,
      openPRs: Math.max(0, repo.openPRCount),
      activitySparkline,
    };
  });

  res.json(result);
});

const eventsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * @openapi
 * /orgs/{orgId}/events:
 *   get:
 *     summary: Paginated activity feed for an organization
 *     tags: [Organizations]
 */
orgRouter.get('/events', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const { page, limit } = await eventsQuerySchema.parseAsync(req.query);
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: { orgId },
      include: {
        actor: { select: { id: true, username: true, avatarUrl: true } },
        repo: { select: { id: true, name: true, fullName: true } },
      },
      orderBy: { occurredAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.event.count({ where: { orgId } }),
  ]);

  res.json({
    data: events.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      repo: e.repo,
      metadata: e.metadata as Record<string, unknown>,
      occurredAt: e.occurredAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

const createSprintSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  goalPoints: z.number().int().min(0).default(0),
});

orgRouter.post('/sprints', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const data = await createSprintSchema.parseAsync(req.body);
  const sprint = await createSprint(prisma, orgId, data);
  res.status(201).json(sprint);
});

/**
 * @openapi
 * /orgs/{orgId}/sprints:
 *   get:
 *     summary: List sprints for an organization
 *     tags: [Organizations]
 */
orgRouter.get('/sprints', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const sprints = await listSprints(prisma, orgId);
  res.json(sprints);
});

/**
 * @openapi
 * /orgs/{orgId}/sprints/{sprintId}:
 *   get:
 *     summary: Sprint detail with burndown metrics
 *     tags: [Organizations]
 */
orgRouter.get('/sprints/:sprintId', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const sprintId = paramId(req.params.sprintId);
  const sprint = await getSprintDetail(prisma, orgId, sprintId);

  if (!sprint) {
    sendError(res, 404, 'NotFound', 'Sprint not found');
    return;
  }

  res.json(sprint);
});

orgRouter.get('/webhook-status', memberRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const lastEvent = await prisma.event.findFirst({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  res.json({
    listening: true,
    lastEventAt: lastEvent?.createdAt.toISOString() ?? null,
  });
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  githubOrgId: z.string().nullable().optional(),
});

orgRouter.patch('/', ownerRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const data = await updateOrgSchema.parseAsync(req.body);
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { name: data.name, githubOrgId: data.githubOrgId },
  });
  res.json({ id: org.id, name: org.name, githubOrgId: org.githubOrgId });
});

orgRouter.delete('/', ownerRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  await prisma.organization.delete({ where: { id: orgId } });
  res.status(204).send();
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
});

orgRouter.post('/members', ownerRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const { email } = await inviteMemberSchema.parseAsync(req.body);

  const invitee = await prisma.user.findFirst({ where: { email } });
  if (!invitee) {
    sendError(res, 404, 'NotFound', 'User not found with that email');
    return;
  }

  const existing = await prisma.orgMembership.findFirst({
    where: { userId: invitee.id, orgId, deletedAt: null },
  });
  if (existing) {
    sendError(res, 409, 'Conflict', 'User is already a member');
    return;
  }

  const revived = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: invitee.id, orgId } },
  });

  const membership = revived
    ? await prisma.orgMembership.update({
        where: { id: revived.id },
        data: { deletedAt: null, role: UserRole.MEMBER },
      })
    : await prisma.orgMembership.create({
        data: { userId: invitee.id, orgId, role: UserRole.MEMBER },
      });

  res.status(201).json({
    id: membership.id,
    userId: membership.userId,
    orgId: membership.orgId,
    role: membership.role,
  });
});

orgRouter.delete('/members/:userId', ownerRoutes, async (req: AuthRequest, res: Response) => {
  const orgId = paramId(req.params.orgId);
  const userId = paramId(req.params.userId);

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, orgId, deletedAt: null },
  });

  if (!membership) {
    sendError(res, 404, 'NotFound', 'Membership not found');
    return;
  }

  if (membership.role === UserRole.OWNER) {
    sendError(res, 403, 'Forbidden', 'Cannot remove organization owner');
    return;
  }

  await prisma.orgMembership.update({
    where: { id: membership.id },
    data: { deletedAt: new Date() },
  });

  res.status(204).send();
});
