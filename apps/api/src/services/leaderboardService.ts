import { PrismaClient, EventType } from '@devpulse/db';
import { formatDateUTC, getPeriodStart } from '@devpulse/utils';
import { subDays } from 'date-fns';

export interface LeaderboardEntryResult {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  commits: number;
  prsMerged: number;
  reviews: number;
  streak: number;
}

export function computeScore(entry: {
  commits: number;
  prsMerged: number;
  reviews: number;
}): number {
  return entry.commits + entry.prsMerged * 3 + entry.reviews * 2;
}

function computeCommitStreak(
  actorId: string,
  commitEvents: Array<{ actorId: string; occurredAt: Date }>,
): number {
  const commitDays = new Set<string>();
  for (const event of commitEvents) {
    if (event.actorId === actorId) {
      commitDays.add(formatDateUTC(event.occurredAt));
    }
  }

  if (commitDays.size === 0) return 0;

  const todayKey = formatDateUTC(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateUTC(yesterday);

  if (!commitDays.has(todayKey) && !commitDays.has(yesterdayKey)) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date();
  if (!commitDays.has(formatDateUTC(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (commitDays.has(formatDateUTC(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export async function getLeaderboard(
  prisma: PrismaClient,
  orgId: string,
  period: 'week' | 'month' | 'quarter',
): Promise<{ entries: LeaderboardEntryResult[]; period: string }> {
  const since = getPeriodStart(period);

  const [groups, streakCommitEvents] = await Promise.all([
    prisma.event.groupBy({
      by: ['actorId', 'type'],
      where: { orgId, occurredAt: { gte: since } },
      _count: { id: true },
    }),
    prisma.event.findMany({
      where: { orgId, type: EventType.COMMIT, occurredAt: { gte: subDays(new Date(), 60) } },
      select: { actorId: true, occurredAt: true },
      take: 500,
    }),
  ]);

  const actorIds = [...new Set(groups.map((g) => g.actorId))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, username: true, avatarUrl: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const statsMap = new Map<
    string,
    {
      userId: string;
      username: string;
      avatarUrl: string | null;
      commits: number;
      prsMerged: number;
      reviews: number;
    }
  >();

  for (const group of groups) {
    const actor = actorMap.get(group.actorId);
    if (!actor) continue;

    const existing = statsMap.get(group.actorId) ?? {
      userId: actor.id,
      username: actor.username,
      avatarUrl: actor.avatarUrl,
      commits: 0,
      prsMerged: 0,
      reviews: 0,
    };

    if (group.type === EventType.COMMIT) {
      existing.commits += group._count.id;
    } else if (group.type === EventType.PR_MERGED) {
      existing.prsMerged += group._count.id;
    } else if (group.type === EventType.PR_REVIEWED) {
      existing.reviews += group._count.id;
    }

    statsMap.set(group.actorId, existing);
  }

  const entries = Array.from(statsMap.values())
    .sort(
      (a, b) => computeScore(b) - computeScore(a) || a.username.localeCompare(b.username),
    )
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
      streak: computeCommitStreak(entry.userId, streakCommitEvents),
    }));

  return { entries, period };
}
