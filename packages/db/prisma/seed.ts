import { PrismaClient, EventType, UserRole } from '@prisma/client';
import { createCipheriv, createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function encryptToString(secret: string, key: string): string {
  const iv = randomBytes(12);
  const keyBuffer = Buffer.from(key.slice(0, 32), 'utf8');
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  });
}

async function main() {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'dev-encryption-key-min-32-chars!!';
  const webhookSecret = randomBytes(32).toString('hex');

  const owner = await prisma.user.upsert({
    where: { githubId: 'seed-owner' },
    create: {
      githubId: 'seed-owner',
      username: 'demo-owner',
      email: 'owner@devpulse.demo',
      avatarUrl: 'https://github.com/github.png',
    },
    update: {},
  });

  const member = await prisma.user.upsert({
    where: { githubId: 'seed-member' },
    create: {
      githubId: 'seed-member',
      username: 'demo-member',
      email: 'member@devpulse.demo',
      avatarUrl: 'https://github.com/github.png',
    },
    update: {},
  });

  const org = await prisma.organization.upsert({
    where: { githubOrgId: 'devpulse-demo' },
    create: {
      githubOrgId: 'devpulse-demo',
      name: 'DevPulse Demo',
      webhookSecret: encryptToString(webhookSecret, encryptionKey),
    },
    update: { name: 'DevPulse Demo' },
  });

  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: owner.id, orgId: org.id } },
    create: { userId: owner.id, orgId: org.id, role: UserRole.OWNER },
    update: { deletedAt: null, role: UserRole.OWNER },
  });

  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: member.id, orgId: org.id } },
    create: { userId: member.id, orgId: org.id, role: UserRole.MEMBER },
    update: { deletedAt: null, role: UserRole.MEMBER },
  });

  const repoNames = ['api-service', 'web-app', 'shared-libs'];
  const repos = [];
  for (let i = 0; i < repoNames.length; i++) {
    const repo = await prisma.repository.upsert({
      where: { githubRepoId_orgId: { githubRepoId: `seed-repo-${i}`, orgId: org.id } },
      create: {
        githubRepoId: `seed-repo-${i}`,
        name: repoNames[i],
        fullName: `devpulse/${repoNames[i]}`,
        orgId: org.id,
      },
      update: {},
    });
    repos.push(repo);
  }

  const eventTypes = [
    EventType.COMMIT,
    EventType.PR_OPENED,
    EventType.PR_MERGED,
    EventType.PR_REVIEWED,
    EventType.ISSUE_OPENED,
  ];

  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const occurredAt = new Date();
    occurredAt.setDate(occurredAt.getDate() - daysAgo);
    const type = eventTypes[i % eventTypes.length];
    const repo = repos[i % repos.length];
    const actor = i % 3 === 0 ? member : owner;
    const deliveryId = createHash('sha256').update(`seed-event-${i}`).digest('hex');

    await prisma.event.upsert({
      where: { githubDeliveryId: deliveryId },
      create: {
        type,
        githubId: `seed-gh-${i}`,
        githubDeliveryId: deliveryId,
        actorId: actor.id,
        repoId: repo.id,
        orgId: org.id,
        occurredAt,
        metadata: type === EventType.COMMIT ? { commitCount: 1 + (i % 3) } : { title: `Seed event ${i}` },
      },
      update: {},
    });
  }

  const now = new Date();
  const completedStart = new Date(now);
  completedStart.setDate(completedStart.getDate() - 45);
  const completedEnd = new Date(now);
  completedEnd.setDate(completedEnd.getDate() - 15);

  const activeStart = new Date(now);
  activeStart.setDate(activeStart.getDate() - 7);
  const activeEnd = new Date(now);
  activeEnd.setDate(activeEnd.getDate() + 7);

  await prisma.sprint.create({
    data: {
      orgId: org.id,
      name: 'Sprint 23 (Completed)',
      startDate: completedStart,
      endDate: completedEnd,
      goalPoints: 80,
    },
  });

  await prisma.sprint.create({
    data: {
      orgId: org.id,
      name: 'Sprint 24 (Active)',
      startDate: activeStart,
      endDate: activeEnd,
      goalPoints: 100,
    },
  });

  console.log('Seed complete: DevPulse Demo org with 2 users, 3 repos, ~50 events, 2 sprints');
  console.log(`Webhook secret (plaintext, for local testing): ${webhookSecret}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
