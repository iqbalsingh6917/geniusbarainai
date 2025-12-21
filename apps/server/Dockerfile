FROM node:20-alpine AS builder

WORKDIR /app
COPY ../../pnpm-lock.yaml ../../package.json ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @lms/server build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json .
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 9000
CMD ["node", "dist/index.js"]
