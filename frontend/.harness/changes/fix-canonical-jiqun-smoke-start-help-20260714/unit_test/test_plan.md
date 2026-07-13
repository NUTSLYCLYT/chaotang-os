# 单测计划

## 覆盖范围

- DOWN branch 必须包含 canonical launcher；禁止旧仓库、绝对旧路径、direct uvicorn 和旧产品身份。

## 命令

- `node --experimental-strip-types --test scripts/jiqun-contract-smoke.nodetest.ts`

## 未覆盖风险

- 无统一入口调用 sink，不能证明 14 天零调用。
