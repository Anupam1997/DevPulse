# DevPulse

Engineering Activity Dashboard SaaS — aggregates GitHub activity into team velocity metrics, sprint burndown views, and contributor leaderboards with real-time webhook updates.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TanStack Query v5, Tailwind CSS, Recharts
- **Backend**: Express, PostgreSQL (Prisma), BullMQ (Redis), Socket.io
- **Auth**: NextAuth.js + GitHub OAuth, JWT
- **Infra**: Docker Compose, Turborepo monorepo

## Project Structure

```
devpulse/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Express backend (webhooks + REST API)
├── packages/
│   ├── db/           # Prisma schema + client
│   ├── types/        # Shared TypeScript types
│   └── utils/        # Shared utilities
├── docker-compose.yml
└── turbo.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- GitHub OAuth App ([create one](https://github.com/settings/developers))

### 1. Clone & Install

```bash
git clone <repo-url> devpulse
cd devpulse
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your GitHub OAuth credentials and secrets
```

### 3. Start Infrastructure

```bash
docker compose up postgres redis -d
```

### 4. Initialize Database

```bash
npm run db:generate
npm run db:migrate
```

This applies Prisma migrations from `packages/db/prisma/migrations/`. For production deployments, use `npm run db:migrate:prod`.

### 5. Seed Demo Data (optional)

```bash
npm run db:seed
```

### 6. Run Development Servers

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/health

### Full Docker Stack

```bash
docker compose up --build
```

## Local Development Gotchas

### Port 5433 (not 5432)

Docker Compose maps Postgres to host port **5433** because 5432 is often already in use locally. Your `DATABASE_URL` must use port 5433:

```
DATABASE_URL=postgresql://devpulse:devpulse@localhost:5433/devpulse?connection_limit=10&pool_timeout=20
DIRECT_URL=postgresql://devpulse:devpulse@localhost:5433/devpulse
```

### Sync `.env` to Next.js

Next.js reads `apps/web/.env.local`, which overrides the root `.env`. After changing GitHub OAuth credentials or API URLs in the root `.env`, copy them:

```bash
cp .env apps/web/.env.local
# Or sync specific keys manually
```

### ngrok for webhook testing

GitHub webhooks require a public HTTPS URL:

```bash
ngrok http 4000
```

Set the webhook Payload URL to `https://<your-ngrok-id>.ngrok-free.dev/webhooks/github` (must include the `/webhooks/github` path). Update `NEXT_PUBLIC_WEBHOOK_URL` in `.env` and `apps/web/.env.local`.

When ngrok restarts, the URL changes — re-register the webhook in GitHub Org Settings → Webhooks with the new URL and the same secret from Settings.

## GitHub Webhook Setup

1. Sign in via GitHub OAuth
2. Create an organization in onboarding
3. Go to **Settings** → follow the webhook wizard
4. Configure your GitHub org webhook with:
   - **Payload URL**: `http://localhost:4000/webhooks/github` (or production URL)
   - **Secret**: from Settings page
   - **Events**: Push, Pull requests, Pull request reviews, Issues

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/webhooks/github` | GitHub webhook receiver |
| POST | `/auth/login` | Backend login (called by NextAuth) |
| GET | `/orgs/:orgId/metrics` | Velocity + burndown data |
| GET | `/orgs/:orgId/leaderboard` | Contributor rankings |
| GET | `/orgs/:orgId/repos` | Repository activity |
| GET | `/orgs/:orgId/events` | Paginated activity feed |
| POST | `/orgs/:orgId/sprints` | Create sprint |
| GET | `/orgs/:orgId/sprints/:id` | Sprint detail |

## Deployment

- **Frontend**: Deploy `apps/web` to Vercel (see root `vercel.json`)
- **Backend**: Deploy `apps/api` to Railway (see `apps/api/railway.toml`) with Postgres + Redis add-ons. Set the Railway service **root directory to the monorepo root** (not `apps/api/`); `railway.toml` uses `dockerfilePath = "apps/api/Dockerfile"` relative to that root.

### Railway environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled Postgres URL (PgBouncer), with `?connection_limit=10&pool_timeout=20` |
| `DIRECT_URL` | Direct Postgres URL (for Prisma migrations only) |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Min 32 characters |
| `ENCRYPTION_KEY` | Min 32 characters (AES-256-GCM for webhook secrets) |
| `CORS_ORIGIN` | Frontend URL (e.g. `https://your-app.vercel.app`) |
| `NODE_ENV` | `production` |

Run migrations on deploy: `npm run db:migrate:prod`

- Set environment variables from `.env.example` in each service

## License

MIT
