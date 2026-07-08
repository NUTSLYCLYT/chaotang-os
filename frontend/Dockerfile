FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 容器内:standalone 输出 + 根 basePath(让 BFF 相对 fetch('/api/court/...') 命中) + real 模式
ENV NEXT_STANDALONE=1
ENV NEXT_PUBLIC_API_MODE=real
RUN node_modules/.bin/next build --webpack

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# CourtOS is a Chinese-first interface. Alpine images do not ship CJK fonts,
# which makes the production UI render tofu boxes unless the host provides them.
RUN apk add --no-cache font-noto-cjk fontconfig
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
# JIQUN_API_URL 运行时由 compose 注入(standalone server 运行时读 process.env)
CMD ["node", "server.js"]
