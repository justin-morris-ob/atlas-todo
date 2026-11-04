ARG NODE_BUILD_IMAGE=nexus.int.onebrief.tools/cgr.dev/onebrief.com/node-fips:v26.12.1-r2-dev@sha256:fd3008aafbe758e36cbe68a752bc9736be33b2a1a947ed9e43d583283f83a106
ARG NODE_RUNTIME_IMAGE=nexus.int.onebrief.tools/cgr.dev/onebrief.com/node-fips:v26.12.1-r2@sha256:c189f5d7aaf465781b5cd2a2d25857dcfad0bcd9c30be451b8755c950dee4c2a
FROM ${NODE_BUILD_IMAGE} AS build
USER root
WORKDIR /app
RUN npm install --global pnpm@11.23.0 --no-audit --no-fund
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=npmrc,required=true \
    --mount=type=secret,id=nexus_npm_auth,env=NEXUS_NPM_AUTH \
    --mount=type=secret,id=ca_bundle,required=true \
    NPM_CONFIG_USERCONFIG=/run/secrets/npmrc NODE_EXTRA_CA_CERTS=/run/secrets/ca_bundle pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts ./
COPY src ./src
RUN pnpm build && pnpm prune --prod
FROM ${NODE_RUNTIME_IMAGE}
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build --chmod=a+rX /app/node_modules ./node_modules
COPY --from=build --chmod=a+rX /app/dist ./dist
COPY --chmod=a+rX bff ./bff
COPY --chmod=a+rX scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chmod=a+rX migrations ./migrations
USER 65532:65532
EXPOSE 8080
ENTRYPOINT []
CMD ["node", "bff/server.mjs"]
