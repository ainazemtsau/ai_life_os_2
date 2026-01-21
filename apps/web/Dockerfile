# syntax=docker/dockerfile:1.4
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy only files needed for pnpm install (for better caching)
COPY package.json pnpm-workspace.yaml turbo.json ./
# Copy lockfile if it exists (optional)
COPY pnpm-lock.yam[l] ./

# Copy only package.json files from each package (not source code)
COPY apps/web/package.json ./apps/web/
COPY packages/ai/package.json ./packages/ai/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/ui/package.json ./packages/ui/
COPY tooling/typescript/package.json ./tooling/typescript/
COPY tooling/eslint/package.json ./tooling/eslint/

# Install dependencies with pnpm store cache
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install

# Copy source code (this layer changes often, but install is cached)
COPY apps ./apps
COPY packages ./packages
COPY tooling ./tooling

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["pnpm", "dev"]
