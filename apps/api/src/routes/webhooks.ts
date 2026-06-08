import { Router, Request, Response } from 'express';
import { prisma } from '@devpulse/db';
import { verifyGitHubSignature, structuredLog } from '@devpulse/utils';
import { githubEventsQueue } from '../queue';
import { decryptFromString } from '../utils/encryption';
import { loadEnv } from '../config/env';
import { sendError } from '../lib/response';

export const webhookRouter = Router();
const env = loadEnv();

function resolveWebhookSecret(stored: string): string {
  return decryptFromString(stored, env.ENCRYPTION_KEY);
}

function getRequestedOrgId(req: Request): string | undefined {
  const queryOrgId = req.query.orgId;
  if (typeof queryOrgId === 'string' && queryOrgId.length > 0) {
    return queryOrgId;
  }
  if (Array.isArray(queryOrgId) && typeof queryOrgId[0] === 'string' && queryOrgId[0].length > 0) {
    return queryOrgId[0];
  }
  const headerOrgId = req.headers['x-devpulse-org-id'];
  if (typeof headerOrgId === 'string' && headerOrgId.length > 0) {
    return headerOrgId;
  }
  return undefined;
}

async function verifyOrgSecret(
  orgId: string,
  rawBody: Buffer,
  signature: string,
): Promise<{ verified: boolean; orgId?: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, webhookSecret: true },
  });

  if (!org) {
    return { verified: false };
  }

  const secret = resolveWebhookSecret(org.webhookSecret);
  if (verifyGitHubSignature(rawBody, signature, secret)) {
    return { verified: true, orgId: org.id };
  }

  return { verified: false };
}

async function verifyViaLegacyScan(
  rawBody: Buffer,
  signature: string,
): Promise<{ verified: boolean; orgId?: string }> {
  const orgs = await prisma.organization.findMany({ select: { id: true, webhookSecret: true } });
  for (const org of orgs) {
    const secret = resolveWebhookSecret(org.webhookSecret);
    if (verifyGitHubSignature(rawBody, signature, secret)) {
      structuredLog('warn', 'Webhook verified via legacy org scan — add ?orgId= to webhook URL', {
        orgId: org.id,
      });
      return { verified: true, orgId: org.id };
    }
  }
  return { verified: false };
}

/**
 * @openapi
 * /webhooks/github:
 *   post:
 *     summary: Receive GitHub webhook event
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: orgId
 *         schema:
 *           type: string
 *         description: DevPulse organization ID (required for production webhooks)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event queued
 *       400:
 *         description: Invalid payload or missing delivery ID
 *       401:
 *         description: Invalid webhook signature
 *       429:
 *         description: Rate limit exceeded
 */
webhookRouter.post('/github', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const eventType = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;

  if (!eventType) {
    sendError(res, 400, 'BadRequest', 'Missing x-github-event header');
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    sendError(res, 400, 'BadRequest', 'Missing request body');
    return;
  }

  const payload = req.body as Record<string, unknown>;
  const repo = payload.repository as Record<string, unknown> | undefined;
  const requestedOrgId = getRequestedOrgId(req);

  let orgId: string | undefined;
  let verified = false;

  if (requestedOrgId) {
    const result = await verifyOrgSecret(requestedOrgId, rawBody, signature);
    verified = result.verified;
    orgId = result.orgId;
    if (!verified) {
      structuredLog('warn', 'Invalid webhook signature for orgId param', {
        deliveryId,
        eventType,
        requestedOrgId,
      });
      sendError(res, 401, 'Unauthorized', 'Invalid signature');
      return;
    }
  } else if (repo?.id) {
    const repository = await prisma.repository.findFirst({
      where: { githubRepoId: String(repo.id) },
      include: { org: { select: { id: true, webhookSecret: true } } },
    });
    if (repository) {
      const secret = resolveWebhookSecret(repository.org.webhookSecret);
      if (verifyGitHubSignature(rawBody, signature, secret)) {
        verified = true;
        orgId = repository.org.id;
      }
    }
  }

  if (!verified && !requestedOrgId) {
    const legacy = await verifyViaLegacyScan(rawBody, signature);
    verified = legacy.verified;
    orgId = legacy.orgId;
  }

  if (!verified) {
    structuredLog('warn', 'Invalid webhook signature', { deliveryId, eventType });
    sendError(res, 401, 'Unauthorized', 'Invalid signature');
    return;
  }

  if (!deliveryId) {
    structuredLog('warn', 'Missing x-github-delivery header', { eventType });
    sendError(res, 400, 'BadRequest', 'Missing x-github-delivery header');
    return;
  }

  await githubEventsQueue.add('process-event', {
    eventType,
    deliveryId,
    payload,
    orgId,
  });

  structuredLog('info', 'Webhook queued', { eventType, deliveryId, orgId, usedOrgIdParam: !!requestedOrgId });
  res.status(200).json({ received: true });
});
