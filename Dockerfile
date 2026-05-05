# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

# Stage 2: Build application
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output + static assets + prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Prisma CLI for runtime `migrate deploy` — standalone output lacks CLI transitive deps.
# Pin to versions from the lockfile to avoid drift.
COPY --from=builder /app/node_modules/prisma/package.json /tmp/prisma-pkg.json
RUN PRISMA_VER=$(node -e "console.log(require('/tmp/prisma-pkg.json').version)") \
  && npm install --no-save --legacy-peer-deps "prisma@${PRISMA_VER}" dotenv \
  && rm /tmp/prisma-pkg.json

EXPOSE 3000
CMD ["node", "server.js"]
