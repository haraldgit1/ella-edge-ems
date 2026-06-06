FROM oven/bun:1.2-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000
CMD ["bun", "run", "src/main.ts"]
