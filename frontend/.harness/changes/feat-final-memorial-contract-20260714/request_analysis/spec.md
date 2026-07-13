# 需求说明

## 背景

后端已建立 `FinalMemorial` 唯一正式奏折事实源；前端状态类型必须显式区分候选 `review.memorial` 与可裁决 `formal_memorial`，并保持正式五值来源词表。

## 范围

- 扩展 `ShangshufangTaskStatusResponse` 的正式奏折字段。
- 首页摘要可识别 `formal_memorial_id`。
- 不新增前端运行事实或本地质量判断。

## 非目标

- 不改页面布局，不做浏览器交互重设计，不部署。

## 验收标准

- TypeScript 通过；上书房路径/来源 contract baseline 通过；前端 doctor 通过。

## 风险

运行时内部 `LIVE_ENGINE` 不属于正式前端枚举，必须由后端读模型规范化为 `LIVE`。

## 验证计划

- `pnpm exec tsc --noEmit`
- `node --test src/features/shangshufang/api/contract-baseline.nodetest.ts`
- `pnpm harness:doctor`
