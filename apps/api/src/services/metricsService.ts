import { PrismaClient, EventType } from '@devpulse/db';
import {
  formatDate,
  formatDateUTC,
  getDateRange,
  calculateIdealBurndown,
} from '@devpulse/utils';

export interface MetricsResult {
  velocity: Array<{ date: string; commits: number; mergedPRs: number }>;
  burndown: Array<{ date: string; ideal: number; actual: number }>;
  summary: {
    totalCommits: number;
    totalMergedPRs: number;
    reviewCoverage: number;
    avgPRCycleTimeHours: number | null;
  };
}

async function computeAvgPRCycleTimeHours(
  prisma: PrismaClient,
  orgId: string,
  from: Date,
  to: Date,
): Promise<number | null> {
  const prEvents = await prisma.event.findMany({
    where: {
      orgId,
      type: { in: [EventType.PR_OPENED, EventType.PR_MERGED] },
      occurredAt: { gte: from, lte: to },
    },
    select: { type: true, githubId: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
    take: 500,
  });

  const openedAt = new Map<string, Date>();
  const cycleHours: number[] = [];

  for (const event of prEvents) {
    if (event.type === EventType.PR_OPENED) {
      openedAt.set(event.githubId, event.occurredAt);
    } else if (event.type === EventType.PR_MERGED) {
      const start = openedAt.get(event.githubId);
      if (start) {
        cycleHours.push((event.occurredAt.getTime() - start.getTime()) / (1000 * 60 * 60));
      }
    }
  }

  if (cycleHours.length === 0) return null;
  return Math.round(cycleHours.reduce((sum, h) => sum + h, 0) / cycleHours.length);
}

export async function getMetrics(
  prisma: PrismaClient,
  orgId: string,
  from: Date,
  to: Date,
): Promise<MetricsResult> {
  const [mergedEvents, reviewedPRs, totalMergedPRs, commitEvents, activeSprint] =
    await Promise.all([
      prisma.event.findMany({
        where: {
          orgId,
          type: EventType.PR_MERGED,
          occurredAt: { gte: from, lte: to },
        },
        select: { occurredAt: true },
        take: 500,
      }),
      prisma.event.count({
        where: {
          orgId,
          type: EventType.PR_REVIEWED,
          occurredAt: { gte: from, lte: to },
        },
      }),
      prisma.event.count({
        where: {
          orgId,
          type: EventType.PR_MERGED,
          occurredAt: { gte: from, lte: to },
        },
      }),
      prisma.event.findMany({
        where: {
          orgId,
          type: EventType.COMMIT,
          occurredAt: { gte: from, lte: to },
        },
        select: { occurredAt: true, metadata: true },
        take: 500,
      }),
      prisma.sprint.findFirst({
        where: { orgId, startDate: { lte: to }, endDate: { gte: from } },
        include: { metrics: { orderBy: { date: 'asc' } } },
      }),
    ]);

  const mergedByDay = new Map<string, number>();
  for (const row of mergedEvents) {
    const day = formatDateUTC(row.occurredAt);
    mergedByDay.set(day, (mergedByDay.get(day) ?? 0) + 1);
  }

  const commitsByDay = new Map<string, number>();
  let totalCommits = 0;
  for (const event of commitEvents) {
    const count = (event.metadata as Record<string, number>)?.commitCount || 1;
    totalCommits += count;
    const day = formatDateUTC(event.occurredAt);
    commitsByDay.set(day, (commitsByDay.get(day) ?? 0) + count);
  }

  const days = getDateRange(formatDateUTC(from), formatDateUTC(to));
  const velocity = days.map((day) => {
    const dayStr = formatDateUTC(day);
    return {
      date: dayStr,
      commits: commitsByDay.get(dayStr) ?? 0,
      mergedPRs: mergedByDay.get(dayStr) ?? 0,
    };
  });

  let burndown: Array<{ date: string; ideal: number; actual: number }> = [];
  if (activeSprint) {
    const ideal = calculateIdealBurndown(
      activeSprint.goalPoints,
      activeSprint.startDate,
      activeSprint.endDate,
    );
    burndown = ideal.map((item) => {
      const metric = activeSprint.metrics.find((m) => formatDate(m.date) === item.date);
      return {
        date: item.date,
        ideal: Math.round(item.ideal),
        actual: metric?.burndown ?? activeSprint.goalPoints,
      };
    });
  }

  const reviewCoverage =
    totalMergedPRs > 0 ? Math.round((reviewedPRs / totalMergedPRs) * 100) : 0;
  const avgPRCycleTimeHours = await computeAvgPRCycleTimeHours(prisma, orgId, from, to);

  return {
    velocity,
    burndown,
    summary: {
      totalCommits,
      totalMergedPRs,
      reviewCoverage,
      avgPRCycleTimeHours,
    },
  };
}
