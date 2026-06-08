import { Worker, Job } from 'bullmq';
import { prisma, EventType, Prisma } from '@devpulse/db';
import { GitHubWebhookJob } from '@devpulse/types';
import { formatDate, structuredLog, isPrismaError } from '@devpulse/utils';
import { bullConnection } from '../queue';
import {
  normalizeEventType,
  extractGithubId,
  extractMetadata,
  extractSender,
  extractRepo,
  extractOccurredAt,
  getCommitCount,
} from '../services/eventNormalizer';
import { emitToOrg } from '../socket';

async function findOrgFromPayload(payload: Record<string, unknown>): Promise<string | null> {
  const repo = payload.repository as Record<string, unknown> | undefined;
  if (!repo?.id) return null;

  const repository = await prisma.repository.findFirst({
    where: { githubRepoId: String(repo.id) },
    select: { orgId: true },
  });
  return repository?.orgId ?? null;
}

async function upsertActor(sender: { id: number; login: string; avatar_url?: string; email?: string }) {
  const githubId = sender.id ? String(sender.id) : `gh-${sender.login}`;
  return prisma.user.upsert({
    where: { githubId },
    create: {
      githubId,
      username: sender.login,
      avatarUrl: sender.avatar_url ?? null,
      email: sender.email ?? null,
    },
    update: {
      username: sender.login,
      avatarUrl: sender.avatar_url ?? null,
      email: sender.email ?? undefined,
    },
  });
}

async function upsertRepository(
  repo: { id: number; name: string; full_name: string },
  orgId: string,
) {
  return prisma.repository.upsert({
    where: {
      githubRepoId_orgId: {
        githubRepoId: String(repo.id),
        orgId,
      },
    },
    create: {
      githubRepoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      orgId,
    },
    update: {
      name: repo.name,
      fullName: repo.full_name,
    },
  });
}

async function adjustOpenPRCount(
  repoId: string,
  githubEvent: string,
  payload: Record<string, unknown>,
  eventType: EventType | null,
): Promise<void> {
  if (githubEvent !== 'pull_request') return;

  const action = payload.action as string | undefined;
  if (action === 'opened' || eventType === EventType.PR_OPENED) {
    await prisma.repository.update({
      where: { id: repoId },
      data: { openPRCount: { increment: 1 } },
    });
    return;
  }

  if (eventType === EventType.PR_MERGED) {
    await prisma.repository.update({
      where: { id: repoId },
      data: { openPRCount: { decrement: 1 } },
    });
    return;
  }

  if (action === 'closed') {
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (pr && !pr.merged) {
      const repo = await prisma.repository.findUnique({
        where: { id: repoId },
        select: { openPRCount: true },
      });
      if (repo && repo.openPRCount > 0) {
        await prisma.repository.update({
          where: { id: repoId },
          data: { openPRCount: { decrement: 1 } },
        });
      }
    }
  }
}

async function updateSprintMetrics(
  orgId: string,
  eventType: EventType,
  commitCount: number,
  occurredAt: Date,
): Promise<void> {
  const activeSprint = await prisma.sprint.findFirst({
    where: {
      orgId,
      startDate: { lte: occurredAt },
      endDate: { gte: occurredAt },
    },
  });

  if (!activeSprint) return;

  const date = new Date(formatDate(occurredAt));

  const existing = await prisma.sprintMetric.findUnique({
    where: { sprintId_date: { sprintId: activeSprint.id, date } },
  });

  const commitsDelta = eventType === EventType.COMMIT ? commitCount : 0;
  const mergedDelta = eventType === EventType.PR_MERGED ? 1 : 0;
  const openPRDelta = eventType === EventType.PR_OPENED ? 1 : eventType === EventType.PR_MERGED ? -1 : 0;

  if (existing) {
    await prisma.sprintMetric.update({
      where: { id: existing.id },
      data: {
        commits: { increment: commitsDelta },
        mergedPRs: { increment: mergedDelta },
        openPRs: { increment: openPRDelta },
        velocity: { increment: commitsDelta + mergedDelta },
        burndown: { decrement: commitsDelta + mergedDelta },
      },
    });
  } else {
    await prisma.sprintMetric.create({
      data: {
        sprintId: activeSprint.id,
        date,
        commits: commitsDelta,
        mergedPRs: mergedDelta,
        openPRs: Math.max(0, openPRDelta),
        velocity: commitsDelta + mergedDelta,
        burndown: activeSprint.goalPoints - commitsDelta - mergedDelta,
      },
    });
  }
}

async function processWebhookJob(job: Job<GitHubWebhookJob>): Promise<void> {
  const { eventType: githubEvent, payload } = job.data;

  structuredLog('info', 'Processing GitHub webhook', {
    jobId: job.id,
    eventType: githubEvent,
    deliveryId: job.data.deliveryId,
  });

  const eventType = normalizeEventType(githubEvent, payload);

  const orgId = job.data.orgId ?? (await findOrgFromPayload(payload));
  if (!orgId) {
    structuredLog('warn', 'No org found for webhook event', { githubEvent });
    return;
  }

  const sender = extractSender(payload);
  const repoData = extractRepo(payload);
  if (!sender || !repoData) {
    structuredLog('warn', 'Missing sender or repo in payload');
    return;
  }

  const [actor, repo] = await Promise.all([
    upsertActor(sender),
    upsertRepository(repoData, orgId),
  ]);

  await adjustOpenPRCount(repo.id, githubEvent, payload, eventType);

  if (!eventType) {
    structuredLog('info', 'Skipping unhandled event', { githubEvent });
    return;
  }

  const metadata = extractMetadata(eventType, payload);
  const occurredAt = extractOccurredAt(payload);
  const githubId = extractGithubId(eventType, payload);
  const deliveryId = job.data.deliveryId;

  let event;
  try {
    event = await prisma.event.create({
      data: {
        type: eventType,
        githubId,
        githubDeliveryId: deliveryId,
        actorId: actor.id,
        repoId: repo.id,
        orgId,
        metadata: metadata as Prisma.InputJsonValue,
        occurredAt,
      },
      include: {
        actor: { select: { id: true, username: true, avatarUrl: true } },
        repo: { select: { id: true, name: true, fullName: true } },
      },
    });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) {
      structuredLog('info', 'Duplicate delivery skipped', { deliveryId });
      return;
    }
    throw err;
  }

  const commitCount = getCommitCount(eventType, metadata);
  await updateSprintMetrics(orgId, eventType, commitCount, occurredAt);

  emitToOrg(orgId, {
    type: 'event',
    payload: {
      id: event.id,
      type: event.type as import('@devpulse/types').EventType,
      actor: event.actor,
      repo: event.repo,
      metadata: event.metadata as Record<string, unknown>,
      occurredAt: event.occurredAt.toISOString(),
    },
  });

  structuredLog('info', 'Event processed successfully', {
    eventId: event.id,
    type: eventType,
    orgId,
  });
}

export function startWorker(): Worker<GitHubWebhookJob> {
  const worker = new Worker<GitHubWebhookJob>('github-events', processWebhookJob, {
    connection: bullConnection,
    concurrency: 5,
  });

  worker.on('failed', (job, err) => {
    structuredLog('error', 'Job failed', {
      jobId: job?.id,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('completed', (job) => {
    structuredLog('info', 'Job completed', { jobId: job.id });
  });

  return worker;
}
