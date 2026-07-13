# E2E 计划

## 覆盖范围

- 无 UI 改动；以真实 CLI doctor 对 loopback 8081 做只读部署验证。

## 命令

- `pnpm prod:doctor -- --json`（当前预期 STOP）。

## 浏览器证据

- 不需要浏览器；本变更是发布 CLI/API 契约，不改变用户可见页面。
