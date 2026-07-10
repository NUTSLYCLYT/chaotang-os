# 需求说明

## 背景

史馆页面把 `/api/chaotang/archive` 的标准响应信封 `data: { memorials, decisions }` 错当成 `ArchiveRecord[]`，导致运行时调用 `.filter()` 抛出 TypeError。

## 范围

在前端数据边界将当前后端归档契约归一化为史馆页面使用的扁平 `ArchiveRecord[]`，并兼容旧的扁平数组响应。

## 非目标

不修改史馆布局、视觉、交互或后端 API；不新增前端 BFF。

## 验收标准

当前标准信封、旧数组信封和异常对象均可转换为数组；史馆页面不再因 `.filter()` 报错；类型检查通过。

## 风险

记录字段映射可能影响史馆统计和分组，因此用聚焦单测验证奏折/裁决的分类、结果和标题关联。

## 验证计划

`pnpm exec tsx --test src/features/shiguan/lib/archive-adapter.nodetest.ts`、`pnpm exec tsc --noEmit`、`pnpm harness:doctor`。

