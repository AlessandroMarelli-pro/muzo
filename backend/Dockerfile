# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# npm install, not `npm ci` -- package-lock.json currently has drift from
# package.json (a transitive dep, magicast, missing from the lock) that
# npm ci's stricter integrity check rejects in a clean environment even
# though a locally-warm `npm install` resolves it without complaint.
RUN npm install

COPY . .
RUN npx prisma generate
# nest build's TypeScript type-checking pass runs out of Node's default V8
# heap inside Docker's constrained build environment (confirmed: the same
# build completes in ~11s locally on the host's full RAM, but OOMs here) --
# raise the heap ceiling for this one build step.
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
