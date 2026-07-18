# 任务：集成 Superpowers 与 gstack 工程规范

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-18 明确要求把前述 Superpowers 与 gstack 规范集成到项目，并要求今天只用 Codex、不使用 Claude Code。
- 问题：两套用户级技能已经安装，但项目尚无场景化选择、Codex-only、安全授权与证据闭环规则。
- 目标用户：维护 chaotang-os 的产品、工程与测试协作者。
- 目标：形成项目级 Codex 路由 skill、规范文档、任务记录字段和可自动检查的门禁。
- 非目标：不修改业务代码，不复制第三方技能源码，不永久移除 Claude Code，不提交、推送或部署。

## Acceptance Criteria

- [x] AC-01：规范明确何时使用 Superpowers、何时使用 gstack、何时使用最小仓库流程。
- [x] AC-02：Codex-only 模式明确禁止 `gstack-claude`、Claude CLI 和 product-flow Claude runner。
- [x] AC-03：`ship`、`land-and-deploy` 等名称不构成提交、推送、合并或部署授权。
- [x] AC-04：任务模板记录技能计划、Codex-only 模式、实际技能与验证证据，现有任务仍可解析。
- [x] AC-05：基础检查不依赖用户级 Superpowers/gstack 安装，也不 vendoring 第三方源码。
- [x] AC-06：三项 harness 验证通过，且保留现有 ADR 0015 检查登记。
- [x] AC-07：本任务不修改 `frontend/`、`backend/`、现有史馆任务或 ADR 0015，不调用 Claude Code。

## Delivery Constraints

- 范围：仅允许修改根级 Agent 规范、Codex 项目 skill、协作文档、任务模板、ADR 0016 和 harness 检查器。
- 兼容性：保留现有双客户端默认架构；Codex-only 仅按任务激活。
- 风险与限制：当前工作区有用户未提交业务改动；必须保留 `scripts/check_harness.mjs` 中已有的 ADR 0015 登记。
- 技能计划：`product-delivery-team`（产品契约、架构、独立 QA）+ `record-decision`（ADR）；Superpowers/gstack 仅作为被集成的语义，不调用 Claude 能力。
- Codex-only：是；禁止 `gstack-claude`、`claude` CLI 与真实 Claude runner。

## Affected Modules

- 模块：项目级 Codex 工程工作流与 harness 治理。
- 允许路径：`AGENTS.md`、`.agents/skills/codex-engineering-workflow/**`、`.agents/skills/product-flow/SKILL.md`、`docs/codex-engineering-workflow.md`、`docs/agentic-engineering.md`、`docs/tooling-compatibility.md`、`docs/product-collaboration.md`、`docs/product/tasks/TEMPLATE.md`、本任务文件、`docs/decisions/0016-codex-engineering-workflow-profile.md`、`scripts/check_harness.mjs`。
- 依赖模块：现有 Codex 专业角色、产品任务契约与 CI validate job。

## Technical Plan

- 架构边界：仓库只保存路由和门禁；第三方 skill 保持用户级可选能力。
- 接口与依赖：项目 skill 引用稳定阶段语义；harness 只检查仓库文件和禁止项，不读取用户目录。
- 实施顺序：新增事实源与 ADR → 更新高频规则和模板 → 增加静态门禁与自测 → 独立 QA。
- 验证计划：运行 harness、checker self-test、Stop hook self-test、差异隔离检查和两个只读路由演练。
- 技术风险：自然语言门禁不能证明运行时行为；以允许路径、外部动作审批和独立 QA 降低风险。

## Implementation Report

- 改动摘要：新增项目级 Codex 路由 skill、主规范和 ADR 0016；更新根规则、协作协议、兼容文档、任务模板与 harness 静态门禁/自测。
- 实际使用的 skill：`product-delivery-team`（产品契约、只读架构、独立 QA）、`record-decision`（ADR 0016）；未调用 Claude 能力。
- 自审：确认 AGENTS.md 为 58 行；CI 无 gstack/Superpowers 安装依赖；第三方源码未复制；ADR 0015 登记保留；业务脏改未覆盖。
- 验证命令与结果：`node scripts/check_harness.mjs` PASS（53 个基线文件）；`node scripts/check_harness.mjs --self-test` PASS（22 项）；`node .agents/hooks/check-harness.mjs --self-test` PASS（3 项）；`git diff --check` PASS（仅换行风格提示）；小文档与 UI QA 两条只读路由演练 PASS。
- 未运行项与原因：未运行 Claude runner 的真实模式及 `--self-test`，遵守用户“今天不要用 Claude Code”的 Codex-only 限制；本任务不需要前后端测试。
- 剩余风险：静态门禁不能证明所有运行时行为；第三方 skill 升级后仍需重新审查。

## Acceptance Review

- 验收结果：Accepted — 2026-07-18；独立 QA 结论 GO。
- 验收证据：AC-01 至 AC-07 全部通过；三项 harness 与 `git diff --check` 使用最新工作区复跑通过；QA 确认 Codex-only、权限门禁、CI 独立性及改动隔离。
- 未通过项：无。
