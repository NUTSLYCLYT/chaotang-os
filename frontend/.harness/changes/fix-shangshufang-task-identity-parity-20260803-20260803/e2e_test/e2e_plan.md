# E2E 计划

## 覆盖范围

- 真实路径：上书房下旨 → task_id URL → 合同面板同案 → 生成 PDF/DOCX/JSON → 人工归档 → 史馆精确回放。

## 命令

- RUN_REAL_LOOP=1 PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/shangshufang-real-loop.spec.ts

## 浏览器证据

- 断言 task_id URL、合同面板 data-task-id、READY/ARCHIVED、EXACT ARCHIVE 和三种下载。
