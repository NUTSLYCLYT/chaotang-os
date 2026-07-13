# 需求说明

## 背景

S1 需要先冻结上书房正式 adapter 的路径和 sourceLabel 词汇，防止后续契约改造继续漂移。

## 范围

新增一个纯静态 Node characterization test，核对 backend adapter、court adapter 路径和当前 sourceLabel 词汇。

## 非目标

不修改 adapter、页面、sourceLabel 行为或运行配置；不把缺失 engineTier 修成伪字段。

## 验收标准

专项 Node test、TypeScript 和 frontend harness doctor 通过；无浏览器行为变化。

## 风险

静态测试可能因有意契约变更失败；届时必须同步后端事实源和基线，不得绕过。

## 验证计划

`npx --yes tsx --test src/features/shangshufang/api/contract-baseline.nodetest.ts`、`pnpm exec tsc --noEmit`、`pnpm harness:doctor`。
