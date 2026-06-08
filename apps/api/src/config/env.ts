import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load monorepo root .env (works from src/ and dist/ at runtime)
config({ path: resolve(__dirname, '../../../../.env') });
config({ path: resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  GITHUB_WEBHOOK_PATH: z.string().default('/webhooks/github'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  return result.data;
}
