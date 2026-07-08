# 生产踩坑教训(吸收自 chaotang-web-ui 旧生产仓 next.config.ts 注释)

> 2026-06-16 大神会审从旧生产仓回吸。代码不直接移植(主仓是真 API handler,非 NestJS 代理),
> 但这些是真金白银在公网踩出来的知识,主线 lyt 上线前必须内化。配套 `DEPLOYMENT.md`。

## 🔴 最毒:rewrites 必须放 beforeFiles,否则生产展示假数据

2026-05-23 canary 在 prod 抓到 `/chaotang/api/v1/health` 返回 **404 + `x-nextjs-cache:HIT` + `x-nextjs-prerender:1` + stale-time:300**。

- **根因**:`afterFiles` 在 Next.js page 匹配**之后**才跑 → prerender 先把这些 path 吃成 404 page 缓存 5 分钟 → rewrites 永远拿不到请求 → **前端 silent fallback to mock → 客户在生产看到 mock data**。
- **修法**:`/api/v1/:path*` 这类必须放 `rewrites().beforeFiles`(在 page 匹配之前强制转发后端),绕开 prerender 拦截。
- **例外**:`jiqun/api/*` 保留 afterFiles fallback——让 app route handler(如 SSE pipe `/jiqun/api/runs/stream/[taskId]`)优先匹配动态路由,未匹配的才 fallback;放 beforeFiles 会抢走动态路由。
- **对照 PRD §11 真实性铁律**:这个 bug 正是"DEMO 伪装成 LIVE"在生产真实发生过一次——验证主线 lyt 的 rewrites 是否已正确前置。

## 🟡 server-only env:后端 URL 不能进 client bundle

`COURTOS_API_URL` 必须是 server-only env;`NEXT_PUBLIC_*` 注入会让 client bundle 带 NestJS 跨域 URL → **CORS 阻塞**。客户端 `swrFetcher` 一律走 same-origin `/chaotang/api/v1` + next rewrites,不直连后端。

## 🟡 Next 16 图片优化器:大图 unoptimized

Next 16 turbopack 下 RGB 1500+px 图(如 `/heroes/v5/*.png`)触发 `_next/image` 优化器 **400 "isn't a valid image"**,但直 URL 200。当前 config `images:{unoptimized:true}` 静态 serve 绕开;若将来要开优化,先查 sharp 边角。

## 🟡 standalone vs next start

`output:'standalone'` 跟 `next start` 不兼容(standalone 必须 `node .next/standalone/server.js`)。当前 systemd 用 `pnpm start → next start`,故禁用 standalone。若切 docker/镜像分发再开 standalone + 改 systemd ExecStart。
