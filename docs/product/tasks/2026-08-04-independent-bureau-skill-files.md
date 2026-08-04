# 任务：39 司独立运行时 Skill 文件

## Status

Accepted

## Product Definition

- 用户确认：2026-08-04，确认采用“39 个 Python Skill 定义文件 + 共享类型 + 中央显式注册表”。
- 问题：39 个司逻辑上已有独立 Skill，但专业方法与 Tool Policy 集中在大文件中，无法形成独立源码所有权。
- 目标用户：维护司级 Agent、专业分析和 Tool Policy 的开发者与审查者。
- 目标：每个司拥有一个独立运行时 Skill 文件，同时保持当前生产行为完全不变。
- 非目标：不创建 Codex `SKILL.md`，不改变 Tool、Evidence、报告、上层 Agent 或 LangGraph 行为。

## Acceptance Criteria

- [ ] 39 个权威司各有且仅有一个 `skills/*.py` 文件和一个 `SKILL` 定义。
- [ ] 每个定义同文件包含身份、Skill ID、专业方法和完整 Tool Policy。
- [ ] Agent ID、Skill ID、Policy ID、版本、方法文本、权限和预算与迁移前快照完全一致。
- [ ] 中央注册表使用 39 条显式注册，不进行动态扫描、名称推导或 fallback。
- [ ] 旧 `professional.py` 与六个部门 ID 模块仅作为无重复正文的兼容门面。
- [ ] 39 司生产 Tool Use、Evidence、报告、上层隔离和四节点拓扑回归通过。
- [ ] 最终同一冻结版本连续完整通过至少 10 轮验收。

## Delivery Constraints

- 范围：`backend/app/agents/runtime_skills/roles/bureaus/`、相关 registry/tests/docs/harness。
- 兼容性：运行时公开接口、注册顺序和序列化结果不得变化。
- 风险与限制：禁止自动生成缺失定义；搬运过程必须由迁移前快照保护。
- 技能计划：brainstorming、record-decision、writing-plans、test-driven-development、subagent-driven-development、verification-before-completion。
- Codex-only：是。

## Affected Modules

- 模块：司级 Runtime Skill 独立定义、Tool Policy、中央注册表和兼容导入门面。
- 允许路径：`backend/app/agents/runtime_skills/roles/bureaus/**`、`backend/app/agents/runtime_skills/registry.py`、`backend/app/agents/runtime_skills/tool_registry.py`、`backend/tests/test_bureau_independent_skill_files.py`、现有司级 Runtime Skill/Tool Use/Evidence/上层隔离测试、`docs/superpowers/specs/2026-08-04-independent-bureau-skill-files-design.md`、`docs/superpowers/plans/2026-08-04-independent-bureau-skill-files.md`、`docs/decisions/0038-independent-bureau-runtime-skill-files.md`、本任务文件，以及仅在持久文件门禁需要时修改的 `scripts/check_harness.mjs`。
- 依赖模块：现有 39 司 `BUREAU_PROFILES`、Runtime Skill registry、Controlled Tool Use 和 ADR 0028 Evidence Protocol。

## Technical Plan

- 架构边界：单司单源文件，共享冻结类型，中央显式注册，旧模块派生兼容。
- 接口与依赖：新增 `BureauRuntimeSkillSpec` 和 `BUREAU_SKILL_SPECS`；现有 Runtime Skill 输出保持不变。
- 实施顺序：快照门槛→共享类型/注册表→六部门分批迁移→旧门面收敛→全量与 10 轮验收。
- 验证计划：逐字段快照、注册完整性、Tool/Policy fingerprint、全 backend、Harness 和连续 10 轮。
- 技术风险：手工迁移漂移、循环导入、兼容门面重复定义。

## Implementation Report

- 状态：`accepted`（Task 8 Candidate 的 SPEC、QUALITY 与 EVIDENCE 独立审查均已批准）。
- 实现证据：39 个司级模块各自导出且仅导出一个 `SKILL`；中央注册表包含 39 条显式、唯一、稳定顺序的导入与注册；旧 `professional.py` 和六部门 ID 模块仅保留由中央规格派生的兼容门面。
- 行为证据：Task 1 固定 SHA-256 `03338473501bdcc72a4eb22f8ccd7eb23534b2b81ad7422e9458182e36eb3246` 继续通过；Runtime Skill、Controlled Tool Use、Tool Loop、Evidence、部门、军机处、丞相及图边界矩阵共 `1162 passed`；完整 backend 为 `2843 passed, 1 skipped`；backend Ruff 与四条 Harness 均通过。
- 静态证据：独立探针确认 `39` 个模块、`39` 条唯一显式 import、每模块一个 `SKILL`，未发现动态发现、fallback、身份推断、builder、旧独立定义或上层隐藏 method/policy 来源；正反序 import probe 均通过。
- 工作树说明：本功能与同一脏树中的先行 Tool Use/Evidence 工作及无关前端任务已区分审查；未发现新增密钥或运行态验收证据进入跟踪范围。
- 详细命令、退出码、计数和警告见 `.superpowers/sdd/independent-bureau-skill-files-task-7-report.md`。

## Acceptance Review

- 验收结果：Passed（`10/10`）。Candidate 冻结验收的 SPEC、QUALITY 与 EVIDENCE 独立审查均已批准；产品任务更新后的 Final phase 使用新冻结 fingerprint 重新连续执行完整 10 轮。Final manifest、逐命令 stdout/stderr/exit、manifest 与 runner/probe 前后哈希及汇总均保存在被 Git 忽略的 `.superpowers/sdd/independent-bureau-skill-files-task-8-final-evidence/`，不写入 tracked 产品文件。
