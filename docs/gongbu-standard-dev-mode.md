# 工部标准开发模式（全项目强制）

> 状态：**生效**（2026-10-07 定稿，用户拍板）
> 适用范围：朝堂 OS 及其衍生项目、battery-swarm-hub、以及所有经工部通道施工的项目。
> 决策记录：`docs/decisions/0046-gongbu-standard-multi-ai-dev-mode.md`
> 违反本模式产出的代码不得进入候选合并（按六部证据脊 工部 degraded/hold 规则处理）。

## 1. 三层架构（唯一准许的施工结构）

```
编排层  Orca (ADE)            —— 任务分发、worktree 隔离、diff 评审、并行舰队
执行层  Codex / OpenCode / Claude Code —— 架构位 / 实施位 / 兜底位
弹药层  LiteLLM 网关 (127.0.0.1:4000) —— 模型路由、限额互备、熔断降级
```

- Orca 不带模型，只调度已登记的执行位 CLI。
- 弹药层统一走 LiteLLM 网关（`E:\LiteLLM\config.yaml`，计划任务 `WB_LiteLLM_Relay` 保活），执行位不得直连模型 API 绕过网关（否则失去花费统计与降级链）。

## 2. 执行位与模型分工

| 执行位 | 模型（经网关） | 职责 | 禁止 |
| --- | --- | --- | --- |
| Codex | GPT-6.1-sol（直连） | 目标冻结、设计审查、验收 | 默认无 commit/push/merge 权 |
| OpenCode | `litellm/deepseek-chat` | 主力编码、日常迭代（默认模型） | 越出任务合同边界 |
| OpenCode | `litellm/deepseek-reasoner` | 深度推理、架构论证、红蓝审 | 同后端自审（不算数） |
| OpenCode | `litellm/local`（Qwen3） | 免费批量：日志分析、文档粗筛 | 冒充质量结论 |
| OpenCode | `litellm/cheap`（Qwen3-8B） | 免费轻量：格式转换 | 冒充质量结论 |
| Claude Code | Claude Pro | 通用兜底（订阅到位后启用） | — |

GLM Coding Plan 接入位预留：订阅开通后在 `D:\OpenCodeConfig\opencode\opencode.json` 的 provider 下追加 `zhipuai-coding-plan` 块（baseURL `https://open.bigmodel.cn/api/coding/paas/v4`），升级为与 DeepSeek 互为限额备份的主力编码位。

## 3. 红蓝互审铁律（合并前置条件）

1. **异构互审**：A 模型产出必须由不同后端模型 review 后才能进入候选（deepseek 产出 → reasoner 或 Codex 审；Codex 产出 → deepseek 审）。同后端自审不算数。
2. **审必留痕**：review 结论写入任务 diff 或 PR 描述，标注审查模型与时间。
3. **结论三要素**：每条审查意见必须含 owner / 期限 / 来源。
4. **禁伪造**：禁伪造测试完成率、禁不同测试集数量相加冒充、禁 AI 渲染图冒充尺寸依据。

## 4. 一次迭代的固定顺序

沿用 `docs/codex-orca-opencode-parallel-workflow.md` 六步：Codex 冻结目标 → 只读设计审查 → Orca 开隔离 worktree（一 worktree 一写角色一模块）→ OpenCode 先 RED 后最小 GREEN → Codex 干净候选复跑 Harness 与验收 → 用户明确授权后才 commit/push/merge。

本模式在其上追加：**第 5.5 步（红蓝审）**——Codex 复跑验收前，产出必须先经异构模型互审（见第 3 节），审痕随证据归档。

## 5. 环境注意（本机实测，2026-10-07）

- 沙箱内调 OpenCode 必须清代理变量（`env -u HTTP_PROXY -u HTTPS_PROXY -u https_proxy -u http_proxy`），否则本地网关请求被劫持挂死；用户终端直跑无此问题。
- 网关 master key 唯一真源：`E:\LiteLLM\.env`，不得硬编码进仓库或脚本。
- 网关挂 13 模型（qwen3 系本地免费 + DeepSeek 远程 + 朝堂兼容别名），健康端点 `GET /health`。

## 6. 变更与豁免

- 本模式的修改需用户拍板，并新增 ADR 记录。
- 特定项目豁免（如纯本地实验）需在任务合同中显式声明 `dev-mode: exempt` 并写明理由。
