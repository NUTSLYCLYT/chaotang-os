# 任务：司级 Agent 权限内动态工具发现

> 所有任务必须阅读并遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；本任务不得改变该主链。

## Status

Ready

## Product Definition

- 用户确认：2026-08-11，依据本任务对应设计文档及 ADR 0042 的逐段确认。
- 问题：当前司级 Tool Use 只有固定工具目录，会计数据又可能在 Agent 接手前因固定文件名、表头或行号校验失败，造成 Agent 无法根据内容选择工具，并把非模型故障误报为模型失败。
- 目标用户：通过下旨让六部各司分析系统数据并交付成果的已认证用户。
- 目标：所有 39 个司级 Agent 在当前旨意权限内动态发现并自动调用工具；会计司用非固定布局财务数据生成可下载 Excel；失败阶段真实可解释。
- 非目标：生产外部 MCP、任意 SQL/Shell/代码执行、生产写入、付费服务、部署，以及改变丞相—部—司—史馆主链。

## Acceptance Criteria

- [ ] 司级 Agent 只能发现角色、旨意、数据域、环境策略与工具健康状态交集中的工具。
- [ ] 已发现工具自动调用，但执行入口再次校验权限；模型不能扩大权限或选择凭证、URL、路径和执行器。
- [ ] 工具失败可在预算内换参数、换策略或换同能力工具，且不会重复相同规范化调用。
- [ ] 会计源不依赖固定文件名、工作表、表头或行号；多行表头、标题行、辅助明细和多工作表能够进入内容分析。
- [ ] Agent 自动采用最高置信度解释；中低置信度和确定性校验失败明确披露，低置信度或失败校验只能生成推定草稿。
- [ ] 工具、权限、来源、格式、歧义、校验、模型和产物错误分别持久化并显示，不再统一为模型失败。
- [ ] 目标 2025 年会计司旨意能够生成、下载并打开 owner 隔离的 Excel，且史馆最多一条最终 `REPLY`。
- [ ] 同一最终版本连续完整通过至少 10 轮端到端验收。

## Delivery Constraints

- 范围：`backend/app/agents/runtime_skills/`、`backend/app/agents/bureaus/`、`backend/app/accounting_reports/`、`backend/app/decree_jobs/`、`backend/app/api/`、相关 `backend/tests/`、`frontend/src/app/study/`、相关前端测试及本任务文档。
- 兼容性：保持 ADR 0028、现有四节点 LangGraph、39 个一司一 Skill、零工具路径、旧报告反序列化、owner 隔离、产物原子发布和史馆唯一 `REPLY`。
- 风险与限制：数据内容不可信；外网默认关闭；无真实凭证、生产数据或生产写入授权；保留用户已有工作区改动。
- 技能计划：实施时使用 `test-driven-development`、`executing-plans`、`systematic-debugging`（遇到异常时）和 `verification-before-completion`。
- Codex-only：否；但任何外部 runner、提交、推送、发布和部署仍需单独授权。

## Affected Modules

- 模块：司级 Runtime 动态目录、工具策略与执行；会计内容探测和语义映射；异步旨意错误契约；上书房状态展示。
- 允许路径：见 Delivery Constraints。
- 依赖模块：现有 Runtime Skill registry、Evidence Protocol、AccountingReportSession、DecreeJobStore、Next.js BFF 和史馆归档。

## Technical Plan

- 架构边界：按 `docs/decisions/0042-dynamic-bureau-tool-discovery.md` 实施，不创建模型到 MCP/文件/数据库的直连。
- 接口与依赖：任务级 `ToolDiscoveryContext` 生成安全 descriptor；现有 Policy Gate 在执行时重新授权；会计探测结果转换为受控数据引用后进入工具循环。
- 实施顺序：契约与目录 → 执行期重验和恢复 → 会计内容探测 → 置信度与产物 → 错误契约和前端 → 端到端验收。
- 验证计划：每个任务先写失败测试再最小实现；完成后运行后端、前端、harness 和连续 10 轮真实本地验收。
- 技术风险：动态目录泄露跨司工具、解析器把内容指令当系统指令、低置信度结果被误标正式、异步 job 吞掉真实错误；均需负向测试。

## Implementation Report

- 改动摘要：尚未实施。
- 自审：尚未实施。
- 验证：尚未实施。
- 实际使用的 skill：尚未实施。
- 验证命令与结果：尚未实施。
- 未运行项与原因：全部实施验证尚未运行。
- 剩余风险：见 Technical Plan。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待实施后逐条填写。
- 未通过项：尚未进入验收。
