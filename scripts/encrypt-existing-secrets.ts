#!/usr/bin/env tsx
/**
 * One-time migration: encrypt existing plaintext webhook secrets.
 * Run: npx tsx scripts/encrypt-existing-secrets.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { prisma } from '@devpulse/db';
import { encryptToString, decryptFromString } from '@devpulse/utils';

config({ path: resolve(__dirname, '../.env') });

const key = process.env.ENCRYPTION_KEY;
if (!key || key.length < 32) {
  console.error('ENCRYPTION_KEY must be set (min 32 chars)');
  process.exit(1);
}

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, webhookSecret: true } });
  let updated = 0;

  for (const org of orgs) {
    try {
      const parsed = JSON.parse(org.webhookSecret) as { iv?: string };
      if (parsed.iv) continue;
    } catch {
      // plaintext — encrypt it
    }

    const plain = decryptFromString(org.webhookSecret, key);
    const encrypted = encryptToString(plain, key);
    await prisma.organization.update({
      where: { id: org.id },
      data: { webhookSecret: encrypted },
    });
    updated += 1;
    console.log(`Encrypted secret for org: ${org.name}`);
  }

  console.log(`Done. Updated ${updated} organization(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
