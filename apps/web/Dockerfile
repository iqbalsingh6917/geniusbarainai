FROM node:20-alpine AS builder
WORKDIR /app
COPY ../../pnpm-lock.yaml ../../package.json ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @lms/web build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g http-server
COPY --from=builder /app/apps/web/dist ./dist
EXPOSE 4173
CMD ["http-server", "dist", "-p", "4173"]
