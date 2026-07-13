# 单测计划

## 覆盖范围

- 正式上书房 API 路径与五值来源枚举；TypeScript 契约完整性。

## 命令

- `pnpm exec tsc --noEmit`
- `node --test src/features/shangshufang/api/contract-baseline.nodetest.ts`

## 未覆盖风险

- 未跑真实浏览器，不证明按钮展示与刷新恢复。
