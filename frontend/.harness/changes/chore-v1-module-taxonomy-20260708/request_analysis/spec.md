# 规格说明：chore-v1-module-taxonomy-20260708

## 背景

朝堂 OS 需要一套明确的 V1 模块 taxonomy，用来固定一级产品面，并移除旧路由带来的语义歧义。

## 范围

- 定义可见的 V1 一级模块。
- 定义诸司与六部下属 office 的子模块暴露方式。
- 对齐导航与路由元数据到 V1 taxonomy。
- 移除与 V1 冲突的旧 active page 和旧路径 redirect。

## 非目标

- 不重新设计页面 UI。
- 不新增外部运行能力。
- 不修改鉴权、邀请或 外部 API 基础设施路由。

## 验收标准

- 一级模块为大殿、上书房、军机处、六部、诸司、史馆。
- 已记录锦衣卫与六部 office 的 V1 子模块暴露。
- 旧 active page 不再属于 V1 路由面。
- TypeScript 与聚焦路由/模块测试通过。

## 风险

- 旧链接可能需要临时 redirect 或面向用户的迁移文案。
- 路由清理过宽时，可能误删基础设施页面。

## 验证计划

- `pnpm exec tsc --noEmit`
- 针对 launch whitelist 和 department page-view builder 的聚焦 nodetest。

