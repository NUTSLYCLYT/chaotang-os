# E2E 计划

## 覆盖范围

- 真实注册/登录 JWT。
- backend-owned read model。
- W06 PDF/DOCX/JSON delivery generation。
- 授权 JSON 下载、人工裁决、ArchiveReceipt、Shiguan exact readback。
- URL `archiveId` exact match 成功，tampered ID fail closed。
- seeded PARTIAL 刷新前后均无 delivered/resume/decision。

## 命令

- `pnpm exec playwright test --config=playwright.w07.config.ts`

## 浏览器证据

- 隔离 frontend `127.0.0.1:3002`、backend `127.0.0.1:8081`。
- 成功态截图由 Playwright 输出到 test-results，不纳入产品源码。
- 外部 listener 3050 只读观察，未操作。
