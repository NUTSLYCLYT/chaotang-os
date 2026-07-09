---
name: unit-test-write
description: 为前端纯逻辑、adapter、契约和 guard 编写聚焦测试。
---

# 单测编写 Skill

## 适用场景

- 纯函数。
- adapter。
- source label 归一化。
- route/helper 逻辑。
- guard 或发布门禁脚本。

## 原则

- 测行为，不测实现细枝末节。
- 小表格 case 优先于大 fixture。
- 高风险 bug 应有“不会再发生”的回归断言。

## 输出

更新 `unit_test/test_plan.md`：

- 覆盖了什么行为。
- 为什么选择这类测试。
- 运行命令。
- 未覆盖风险。
