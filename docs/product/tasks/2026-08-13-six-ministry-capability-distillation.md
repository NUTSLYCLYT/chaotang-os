# 任务：EXT 六部能力全面蒸馏

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-08-13 通过附件明确授权在 `ext-dev` 执行 GOVERNED 级六部能力蒸馏。
- 问题：EXT 的六部精华散落于重复 Agent、旧 Flow、前端规则和 Prompt，直接迁移会形成第二 Runtime 权威并带入权限债务。
- 目标用户：DEV Runtime Skill、Harness 和六部能力维护者。
- 目标：固定 `origin/feature-chaotang-ext@939186f0331d9784bc8c4ceee393aeb197230ed0`，完成六部资产全覆盖清单、候选控制面、五个候选评测和无副作用离线 Shadow 基础。
- 非目标：不改生产 Runtime Registry、不进入 Canary/Stable、不迁旧 FlowEngine/OpenClaw/Hermes/前端 Runtime，不执行外部动作。

## Acceptance Criteria

- [ ] 固定 EXT commit 的六部相关资产均有来源 digest、真实 owner、消费链、DEV 映射和迁移 verdict。
- [ ] 未分类资产、重复案例凑数、未知 schema 关键字、类型混淆和空评测集均失败关闭。
- [ ] Capability Capsule 具备严格 schema、状态机、四哈希、provenance、lock、回滚与 kill-switch 元数据。
- [ ] 五个首批候选各有至少 30 个离线案例，其中至少 10 个为缺证、冲突、越权或攻击案例。
- [ ] Champion/Challenger Shadow 只离线回放、无副作用，不伪造真实流量或生产结果。
- [ ] 生产 Registry、ADR 0028、租户/权限/证据权威保持不变。
- [ ] 独立代码、安全和测试复审无 P0/P1，P2 已修复或明确记录。
- [ ] 同一最终版本连续十轮完整验收通过。

## Delivery Constraints

- 范围：`docs/contracts/`、`docs/migrations/`、`docs/product/tasks/`、`backend/harness/`、`scripts/` 及现有根 Harness 接线。
- 兼容性：DEV 39司、6部、军机处、Tool Policy、审计和 ADR 0028 不变。
- 风险与限制：候选控制面不授予权限；可信 owner/tenant/evidence/approval 只能由未来服务端 adapter 注入。
- 技能计划：`codex-engineering-workflow`、`test-driven-development`；独立 reviewer/security reviewer/test reviewer。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：EXT 六部候选能力控制面与离线评测。
- 允许路径：`docs/contracts/`、`docs/migrations/`、`docs/product/tasks/2026-08-13-six-ministry-capability-distillation.md`、`backend/harness/capability_candidates/`、`scripts/capability_*`、`scripts/fixtures/capability-*`、`scripts/check_harness.mjs`。
- 依赖模块：现有 Runtime Skill models/registry（只读映射）、根 Harness、资产盘点与决策质量门。

## Technical Plan

- 架构边界：候选控制面动态盘点和评测；生产执行面继续只认冻结的 DEV Runtime Registry。
- 接口与依赖：Node.js 标准库和 JSON；不新增生产依赖，不访问网络、密钥、运行库或私人文件。
- 实施顺序：P0 全覆盖清单 → P1 Capsule/lock → P2 五候选评测 → P3 离线 Shadow → Harness/复审 → 十轮验收。
- 验证计划：失败测试先行；契约/覆盖/攻击/Shadow 测试；根 Harness/self-test；相关后端只读映射测试；`git diff --check`；禁止路径检查。
- 技术风险：EXT 存在多套冲突 roster、重复 blob、误分类和旧权限说明；只能提炼行为不变量，不能恢复其运行权威。

## Implementation Report

- 改动摘要：完成固定 EXT 全量宇宙清单、五个内容寻址候选胶囊、独立 authority 投影、30×5 合成案例矩阵、诚实标注的离线评测脚手架和根 Harness/CI 接线；生产 Runtime Registry 未改。
- 自审：已修复生产状态 allowlist、权限自授、来源路径逃逸、超大对象、畸形 lock、清单筛选自证、合成评分冒充能力证明、Harness 精确候选集合与浅克隆来源缺失问题。
- 验证：Capsule 13/13、Eval/Shadow 7/7、固定 EXT 全树 Stocktake 4/4、Harness 98 个必需文件与 162 项 self-test 已通过；最终十轮在同一版本上执行。
- 实际使用的 skill：`codex-engineering-workflow`、`test-driven-development`。
- 验证命令与结果：相关 Node 套件、根 Harness/self-test、Stop hook self-test、后端 RuntimeSkill 映射测试与 `git diff --check`。
- 未运行项与原因：真实 Shadow、Canary、生产工具与外部动作不在授权范围。
- 剩余风险：当前 30×5 是确定性合成脚手架，只证明契约、案例覆盖和报告管道，不证明真实模型能力或生产安全；真实 blind eval、无副作用真实 Shadow、服务端签名 authority adapter、Canary/Stable 均须后续单独授权。

## Acceptance Review

- 验收结果：候选控制面实现完成；不构成 Runtime 晋级。
- 验收证据：独立 Capsule、全树盘点、代码和安全复审发现的问题已逐项修复；待最终同版本十轮记录。
- 未通过项：真实能力增益和生产 Shadow 未测量，按边界明确保留为后续阶段，不计作本阶段通过证据。
