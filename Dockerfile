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
RUN /app/web/node_modules/.bin/prisma generate --schema /app/prisma/schema.prisma --generator jsClient
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
COPY --from=builder /app/apps ../apps
RUN ln -s /app/web/node_modules /app/node_modules
RUN mkdir -p /app/web/.next/standalone/.next
RUN ln -sfn /app/web/.next/static /app/web/.next/standalone/.next/static
RUN ln -sfn /app/web/public /app/web/.next/standalone/public

EXPOSE 3000

# Use standalone server output for predictable runtime behavior.
CMD ["node", ".next/standalone/server.js", "-p", "3000", "-H", "0.0.0.0"]

# ---- App Runner (standalone) ----
FROM node:22-alpine AS app-runner
WORKDIR /app/web
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

EXPOSE 3000

CMD ["node", "server.js", "-p", "3000", "-H", "0.0.0.0"]
