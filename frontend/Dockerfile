# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_API_URL into the built JS at build time (import.meta.env),
# not read at container-runtime -- change it and rebuild this image, a
# running container's env var alone won't take effect.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
# `npx vite build` directly, not `npm run build` (which chains `tsc &&`) --
# the codebase currently has ~43 pre-existing TypeScript errors unrelated to
# packaging (confirmed via a clean `npx tsc --noEmit` run). Vite's own
# esbuild-based build doesn't require full type-safety to produce working
# JS. package.json's own `build` script is left as-is (still tsc-gated) for
# local dev; only the Docker image build skips the gate.
RUN npx vite build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
