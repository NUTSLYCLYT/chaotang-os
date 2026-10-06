# ADR 0046: 工部标准多 AI 开发模式（三层编排 + 红蓝互审）

- 日期：2026-10-07
- 关联：ADR 0045（跨平台并行开发模式）、`docs/gongbu-standard-dev-mode.md`（正本）、`docs/multi-ai-coordination-rules.md`、`docs/codex-orca-opencode-parallel-workflow.md`
- 注：本文件原以中文小标题（背景/决策/后果）书写，不满足 `check_harness` 对 ADR 固定章节的校验，已由 2026-10-07 治理修复改为标准章节名，**正文内容一字未改**（仅新增 Verification 判定方式）。

## Status

已接受（用户拍板，全项目强制）— 2026-10-07。

## Context

2026-10-07 凌晨完成多 AI 编排三层架构搭建并端到端实测验证：

- LiteLLM 网关（127.0.0.1:4000）聚合本地 Ollama（Qwen3）与远程 DeepSeek，13 模型，curl 实测 `GATEWAY-OK`。
- OpenCode v2.0.23 挂载网关四模型（deepseek-chat / deepseek-reasoner / local / cheap），`opencode run` 实测返回 `ONLINE`。
- Orca v1.4.216 常驻，orca-opencode-status 集成插件已就位，编排链路零配置即用。

## Decision

1. **确立三层架构为工部唯一准许的施工结构**：Orca（编排）→ Codex/OpenCode/Claude Code（执行）→ LiteLLM 网关（弹药/路由）。正本见 `docs/gongbu-standard-dev-mode.md`。
2. **红蓝互审升格为合并前置条件**：异构互审 + 审必留痕 + 结论三要素 + 禁伪造；在并行工作流第 5.5 步执行。
3. **弹药层统一走网关**：执行位不得直连模型 API 绕过网关（保花费统计与熔断降级链）。
4. **GLM Coding Plan 预留接入位**：订阅开通后一分钟接入，与 DeepSeek 互为限额备份。
5. **豁免需显式声明**：任务合同写 `dev-mode: exempt` 并附理由。

## Consequences

- 正面：模型可换、网关可切、订阅可断，体系无单点故障；红蓝互审以制度形式落地反幻觉纪律。
- 代价：每份候选多一轮异构 review（约 +10% 迭代时长）；沙箱环境调用需清代理变量。
- 风险与对策：Codex 订阅 2026-10-15 到期——到期前由 deepseek-reasoner 顶深度推理位，架构不断档。

## Verification

- **网关层**：`curl -s http://127.0.0.1:4000/health`（沙箱内需清代理变量）返回存活，模型清单含 Context 所列模型。
- **执行位绑定**：抽查各执行位配置，确认模型 base_url 指向网关而非直连上游（验证决策 3）。
- **合并前置**：并行工作流第 5.5 步的红蓝互审记录可在任务文件与 `.harness/approvals/` 中查到，且结论含三要素（验证决策 2）。
- **豁免合规**：`dev-mode: exempt` 的任务合同必须随附理由，缺失即门禁不通过（验证决策 5）。
- **执行方式**：随 `node scripts/check_harness.mjs` 常态化执行；任何一条不满足即记录至对应 `docs/product/tasks/*.md`。
