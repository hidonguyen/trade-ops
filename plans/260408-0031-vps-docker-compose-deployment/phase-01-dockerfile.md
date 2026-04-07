---
phase: 1
status: planned
priority: high
---

# Phase 1: Dockerfile + Config

## Dockerfile (multi-stage)

Three stages for minimal image size:

### Stage 1: `deps` — Install dependencies
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
```

### Stage 2: `builder` — Build app
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
```

### Stage 3: `runner` — Production image
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

## next.config.ts
Enable standalone output for Docker:
```ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```

## .dockerignore
```
node_modules
.next
.git
*.md
plans/
docs/
.env*
```

## Todo
- [ ] Create `Dockerfile`
- [ ] Update `next.config.ts` with `output: "standalone"`
- [ ] Create `.dockerignore`
- [ ] Test local build: `docker build -t trade-ops .`
