# 发布操作

本文件只记录前端发布与验证路径。根级运行评测记录归根目录 harness，服务端运行事实归对应 API 契约和运行证据。

## 端口

| 用途 | 端口 | 命令 |
| --- | ---: | --- |
| Dev HMR | 3002 | `pnpm dev` |
| Production | 3050 | `pnpm start` |
| 禁用 | 3001 | 不要绑定 |

## 常用门禁

```bash
pnpm harness:doctor
pnpm exec tsc --noEmit
pnpm build
pnpm test:e2e
pnpm harness:chaotang:gates
pnpm gate:prod-release
```

## 发布证据

发布相关 change 应记录：

- build 命令与结果。
- start / preview URL。
- 控制台错误情况。
- 浏览器截图或 Playwright 证据。
- 涉及外部运行事实时，记录对应 API 契约、环境变量和运行验证证据来源。

证据写入 `.harness/changes/{change-id}/deployment/preview_report.md`。
