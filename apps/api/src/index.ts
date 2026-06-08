import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit, { type Options } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { createServer } from 'http';
import { prisma } from '@devpulse/db';
import { loadEnv } from './config/env';
import { errorHandler } from './middleware/error';
import { webhookRouter } from './routes/webhooks';
import { orgRouter } from './routes/orgs';
import { authRouter } from './routes/auth';
import { checkRedisHealth } from './queue';
import { initSocket } from './socket';
import { startWorker } from './workers/githubEventsWorker';

const env = loadEnv();
const app = express();
const httpServer = createServer(app);
const startTime = Date.now();

function rateLimitHandler(
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
  optionsUsed: Options,
): void {
  const windowMs = optionsUsed.windowMs ?? 60_000;
  const retryAfter = Math.max(1, Math.ceil(windowMs / 1000));
  res.set('Retry-After', String(retryAfter));
  res.status(optionsUsed.statusCode ?? 429).json({ error: 'Too many requests', retryAfter });
}

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.get('/health', (_req, res) => {
  // Liveness probe — respond immediately (Railway healthcheck must not wait on DB/Redis)
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

app.get('/health/ready', async (_req, res) => {
  let dbHealthy = false;
  let redisHealthy = false;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 3000)),
    ]);
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  try {
    redisHealthy = await Promise.race([
      checkRedisHealth(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);
  } catch {
    redisHealthy = false;
  }

  const status = dbHealthy && redisHealthy ? 'ok' : dbHealthy || redisHealthy ? 'degraded' : 'error';

  res.status(200).json({
    status,
    db: dbHealthy,
    redis: redisHealthy,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

app.use('/webhooks', webhookLimiter, webhookRouter);
app.post('/auth/login', authLimiter);
app.use('/auth', authRouter);

if (env.NODE_ENV === 'development') {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: { title: 'DevPulse API', version: '1.0.0' },
    },
    apis: ['./src/routes/*.ts'],
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs/openapi.json', (_req, res) => {
    res.json(swaggerSpec);
  });
}

app.use(generalApiLimiter);
app.use('/orgs/:orgId', orgRouter);

app.use(errorHandler);

initSocket(httpServer);
startWorker();

async function warnUnencryptedWebhookSecrets(): Promise<void> {
  const orgs = await prisma.organization.findMany({ select: { webhookSecret: true } });
  const hasPlaintext = orgs.some((org) => {
    try {
      const parsed = JSON.parse(org.webhookSecret) as {
        iv?: string;
        tag?: string;
        ciphertext?: string;
      };
      return !(parsed.iv && parsed.tag && parsed.ciphertext);
    } catch {
      return true;
    }
  });

  if (hasPlaintext) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message:
          'Unencrypted webhook secrets detected — run scripts/encrypt-existing-secrets.ts',
      }),
    );
  }
}

void warnUnencryptedWebhookSecrets().catch((err) => {
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'Startup webhook secret check failed',
      error: err instanceof Error ? err.message : String(err),
    }),
  );
});

const port = Number(process.env.PORT) || env.PORT;

httpServer.listen({ port, host: '0.0.0.0' }, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: `API server running on 0.0.0.0:${port}`,
      port,
      envPort: process.env.PORT ?? null,
    }),
  );
});

export default app;
