FROM node:20-alpine3.18 AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
RUN npm ci --workspace=@devpulse/api

FROM base AS builder
RUN apk add --no-cache openssl1.1-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@devpulse/types
RUN npm run build --workspace=@devpulse/utils
RUN npm run db:generate --workspace=@devpulse/db
RUN npm run build --workspace=@devpulse/db
RUN npm run build --workspace=@devpulse/api

FROM base AS runner
RUN apk add --no-cache openssl1.1-compat
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
