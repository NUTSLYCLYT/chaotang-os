# 单测计划

## 覆盖范围

- backend direct adapter 与 `/api/court` adapter 各四条正式路径。
- sourceLabel 五个当前值；engineTier 当前缺失。

## 命令

- `npx --yes tsx --test src/features/shangshufang/api/contract-baseline.nodetest.ts`

## 未覆盖风险

- 不证明真实浏览器、后端蜂群或生产运行。
