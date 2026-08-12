ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner

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
