# 单测计划

## 覆盖范围

- key id 格式、loopback allowlist、disabled/missing/mismatch/rejected/success、报告不含 token。

## 命令

- `node --test scripts/jwt-runtime-identity.nodetest.mjs`

## 未覆盖风险

- 真实 service manager 与生产 secret 轮换不在本闭环。
