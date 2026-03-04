# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/web/node_modules /app/web/node_modules
COPY . .
WORKDIR /app
RUN /app/web/node_modules/.bin/prisma generate --schema /app/prisma/schema.prisma
WORKDIR /app/web
ENV DOCKER_BUILD=1
RUN npx next build

# ---- Ops Runner (migrate + worker) ----
FROM node:22-alpine AS ops-runner
WORKDIR /app/web
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

COPY --from=builder /app/web ./
COPY --from=builder /app/prisma ../prisma

EXPOSE 3000

CMD ["npm", "start"]

# ---- App Runner (standalone) ----
FROM node:22-alpine AS app-runner
WORKDIR /app/web
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

EXPOSE 3000

CMD ["node", "web/server.js"]
