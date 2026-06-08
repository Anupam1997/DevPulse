import { PrismaClient } from '@devpulse/db';
import { formatDate, calculateIdealBurndown } from '@devpulse/utils';

export async function createSprint(
  prisma: PrismaClient,
  orgId: string,
  data: { name: string; startDate: string; endDate: string; goalPoints: number },
) {
  return prisma.sprint.create({
    data: {
      orgId,
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      goalPoints: data.goalPoints,
    },
  });
}

export async function listSprints(prisma: PrismaClient, orgId: string) {
  const sprints = await prisma.sprint.findMany({
    where: { orgId },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      goalPoints: true,
    },
  });

  return sprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.startDate.toISOString(),
    endDate: sprint.endDate.toISOString(),
    goalPoints: sprint.goalPoints,
  }));
}

export async function getSprintDetail(
  prisma: PrismaClient,
  orgId: string,
  sprintId: string,
) {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, orgId },
    include: { metrics: { orderBy: { date: 'asc' } } },
  });

  if (!sprint) return null;

  const ideal = calculateIdealBurndown(sprint.goalPoints, sprint.startDate, sprint.endDate);
  const burndown = ideal.map((item) => {
    const metric = sprint.metrics.find((m) => formatDate(m.date) === item.date);
    return {
      date: item.date,
      ideal: Math.round(item.ideal),
      actual: metric?.burndown ?? sprint.goalPoints,
    };
  });

  return {
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.startDate.toISOString(),
    endDate: sprint.endDate.toISOString(),
    goalPoints: sprint.goalPoints,
    metrics: sprint.metrics.map((m) => ({
      date: formatDate(m.date),
      velocity: m.velocity,
      burndown: m.burndown,
      openPRs: m.openPRs,
      mergedPRs: m.mergedPRs,
      commits: m.commits,
    })),
    burndown,
  };
}
