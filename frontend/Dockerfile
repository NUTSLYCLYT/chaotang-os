FROM --platform=linux/amd64 docker.io/library/node@sha256:2a49bdf71e9fd965a58c1703fd9ddd205b34e5782b692a72dd1d248abb0beb43 AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM --platform=linux/amd64 docker.io/library/node@sha256:2a49bdf71e9fd965a58c1703fd9ddd205b34e5782b692a72dd1d248abb0beb43 AS runner

ARG SOURCE_REVISION
ARG SOURCE_TREE
ARG SOURCE_CREATED
LABEL org.opencontainers.image.source="https://gitee.com/msxn/chaotang-os" \
      org.opencontainers.image.revision="${SOURCE_REVISION}" \
      io.chaotang.source.tree="${SOURCE_TREE}" \
      org.opencontainers.image.created="${SOURCE_CREATED}"

ENV HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN addgroup -g 10001 -S chaotang \
    && adduser -u 10001 -S -D -H -G chaotang chaotang

COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=builder --chown=10001:10001 /app/public ./public

USER 10001:10001
EXPOSE 3000
CMD ["node", "server.js"]
