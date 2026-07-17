# E2E 计划

## 覆盖范围

- 当前六部页面真实 backend NO_DATA 响应与卡片 DOM 同轮对照。
- 确认其他三指标不显示、无 `0%`、回滚开关关闭时卡片消失。
- 复跑战役统一下旨闭环；按当前安全契约，成功分支必须停在人工授权裁决，缺证据分支必须阻断归档。

## 命令

- Playwright CLI 打开 `/chaotang/liubu`，snapshot、截图并捕获同轮 `/api/guoli/overview` response。
- `NEXT_PUBLIC_GUOLI_THIN_SLICE=false` 重启 dev 后 snapshot。
- 运行校准到当前 `/shangshufang` 与 canonical endpoint 的 finance UI smoke，保存两分支 trace。

## 浏览器证据

- `frontend/dev/artifacts/p8-guoli-thin-slice/p8-guoli-api-ui-match.png`（ignored artifact），SHA-256 `09fbe021...d44c`。
- API/UI 同轮证据记录在 `e2e_summary.md`。
- finance UI trace 保存在 ignored `frontend/test-results/**/trace.zip`，哈希记录在 `e2e_summary.md`。
