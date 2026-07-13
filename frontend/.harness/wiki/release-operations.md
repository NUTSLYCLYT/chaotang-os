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

## JWT 运行身份门

`prod:doctor` 直接检查 loopback 后端，不读取 `FENGQUN_JWT_SECRET`，也不输出 token：

- 后端用 `FENGQUN_JWT_KEY_ID` 公开非秘密轮换标识；只允许 1–64 位字母、数字、点、下划线和短横线。
- 发布候选用 `CHAOTANG_EXPECTED_JWT_KEY_ID` 声明预期标识。
- 外部发布权限方临时注入 `CHAOTANG_RUNTIME_PROBE_TOKEN`；该值不得持久化到 env example、报告或 Git。
- `PROD_DOCTOR_BACKEND_URL` 默认 `http://127.0.0.1:8081`，身份探针只允许 HTTP(S) loopback，防止 Bearer token 外泄。
- 认证未启用、标识缺失/不匹配、token 缺失或 `/api/tasks` 拒绝 token，均判定 `STOP`。

证据写入 `.harness/changes/{change-id}/deployment/preview_report.md`。
