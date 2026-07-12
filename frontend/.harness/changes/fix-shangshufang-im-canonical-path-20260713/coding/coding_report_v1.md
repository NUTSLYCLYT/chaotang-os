# 实现报告 v1

## 改动

- 将 IM 常量从退役 court alias 改为 backend canonical path，同步五处 E2E route。

## 取舍

- 最小 diff；未改 transport、UI 或响应处理。

## 验证

- TDD RED/GREEN、类型、构建和真实 production 浏览器均验证。
