# 首个真实流程 P2 编排修复

## Status

Implemented

## Product Definition

在既有首链路编排契约上提供 owner/task/attempt 绑定的单部门流程适配器，确保流程输入、执行尝试、结果和失败原因可以被确定性地核验。该任务不宣称已完成真实供应商模型调用或客户发布验收。

## Acceptance Criteria

- [x] `first_loop` 契约包含 owner、task、attempt 绑定和确定性结果结构。
- [x] 失败保留稳定原因，并可回退到基线状态。
- [x] 编译、聚焦测试和 Ruff 检查可独立运行。
- [ ] 真实外部模型、多 Agent 用户流程和 G3 发布候选仍需后续验收。

## Delivery Constraints

不修改 UI、权限/ADR、预算账本、任务账本、部署、模型开关或发布配置；不伪造模型调用，不把 fixture 结果当作真实执行证据。

## Affected Modules

- 模块：首链路 orchestration contracts 与对应测试。
- 允许路径：`backend/app/orchestration/__init__.py`、`backend/app/orchestration/first_loop.py`、`backend/tests/test_first_loop.py`。

## Technical Plan

先冻结 owner/task/attempt 和结果契约，再以确定性适配器连接单部门流程；保持幂等、失败回退和预算边界；最后运行 compileall、pytest 和 Ruff。真实模型接线、外部网络和发布另立任务。

## Implementation Report

实现已经随首链路相关提交进入当前 `ext-dev` 远端历史。本文件只补齐任务结构，不能替代当前候选的独立 M0 验证或真实用户流程验收。

## Acceptance Review

Pending。已记录实现存在；真实多 Agent 流程、运行时预算/取消/恢复、翰林验收和史馆归档仍由 G3 后续验收门决定。
