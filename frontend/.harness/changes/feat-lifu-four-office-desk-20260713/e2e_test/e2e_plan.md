# E2E 计划

## 覆盖范围

- 礼部编制诚实标识、关系台账、渠道 ROI、报价与防失真、危机响应、匿名降级。

## 命令

- `pnpm exec playwright test e2e/lifu-office.spec.ts --project=chromium --workers=1`

## 浏览器证据

- Chromium 6/6 PASS；使用真实后端注册/登录 token。
