# syntax=docker/dockerfile:1
# Web toolchain image. Targets: deps, dev, test (AD-13).
# Build context is the repository root (tests read contract/fixtures).

FROM node:26.13.1-alpine3.24 AS deps
RUN mkdir -p /app/web && chown -R node:node /app
WORKDIR /app/web
USER node
COPY --chown=node:node web/package.json web/package-lock.json web/.npmrc ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 npm ci

FROM deps AS dev
COPY --chown=node:node web/ ./
COPY --chown=node:node contract/ /app/contract/
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM deps AS test
COPY --chown=node:node web/ ./
COPY --chown=node:node contract/ /app/contract/
CMD ["npm", "run", "check"]
