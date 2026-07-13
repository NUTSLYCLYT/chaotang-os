# 预览 / 部署报告

结论：PACKAGE_VERIFIED_NOT_DEPLOYED

## URL

- 未部署；生产仍为当前 foreign 3050。

## 检查

- `pnpm package:release` exit 0；tar 顶层与 manifest.app 均为 `chaotang-os-frontend`。
- `prod:doctor` exit 2 / STOP，未错误提升生产状态。

## 剩余风险

- immutable builds、3050 接管和外部 trust anchor 未完成。
