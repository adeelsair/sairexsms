FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/web/node_modules /app/web/node_modules
COPY . .
WORKDIR /app/web
RUN npm run build

FROM base AS app-runner
ENV NODE_ENV=production
WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/web/.next ./.next
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/next.config.ts ./next.config.ts
COPY --from=builder /app/web/lib/generated ./lib/generated
COPY --from=builder /app/prisma ../prisma

EXPOSE 3000
CMD ["npm", "start"]

FROM base AS worker-runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/web/node_modules /app/web/node_modules
COPY . .

WORKDIR /app/web
CMD ["npm", "run", "worker"]
