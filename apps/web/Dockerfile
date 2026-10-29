# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app
COPY --link package.json package-lock.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci

FROM deps AS build
COPY --link . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
COPY --link package.json package-lock.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --omit=dev
COPY --link --from=build --chown=appuser:appgroup /app/.next ./.next
COPY --link --from=build --chown=appuser:appgroup /app/next.config.ts ./next.config.ts
USER appuser
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
