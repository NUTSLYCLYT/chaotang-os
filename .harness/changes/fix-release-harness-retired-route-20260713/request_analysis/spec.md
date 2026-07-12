# 规格说明：fix-release-harness-retired-route-20260713

## 背景

release harness 在已退役 `/court-briefing` 查找资源阁；同时全局顶栏未传 onOpenResources，真实入口断线。

## 范围

检查切到 `/shangshufang`，用页面事件接通顶栏与现有 ResourceGallery，允许显式注入真实测试 token。

## 非目标

不修改资源内容，不删除其他失败门禁。

## 验收标准

资源入口可点击，至少 20 图且 0 破图；旧路径不再用于这两项检查。

## 验证计划

TDD、tsc、build、final-release-harness。
