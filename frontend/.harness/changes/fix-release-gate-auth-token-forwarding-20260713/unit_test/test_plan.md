# 单测计划

## 覆盖范围

- 发布门标准 token 必须进入 jiqun 鉴权候选链。

## 命令

- `npx --yes tsx --test scripts/jiqun-contract-smoke.nodetest.ts`

## 未覆盖风险

- 静态单测不单独证明 token 有效；由完整真实契约门补足。
