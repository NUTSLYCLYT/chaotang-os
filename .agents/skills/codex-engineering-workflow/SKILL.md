---
name: codex-engineering-workflow
description: 在 chaotang-os 中按任务风险选择最小的 Superpowers/gstack/Codex 工程流程，并强制执行仓库优先、Codex-only、安全授权和新鲜验证证据。用户说“按项目工程规范”“用 Codex 实现”“不要 Claude”或提出实质开发任务时使用；纯解释、只读查询和微小无风险编辑不强制使用完整流程。
---

# Codex 工程工作流

本 skill 是项目级路由和门禁，不复制也不替代第三方 skill。完整事实源见
`docs/codex-engineering-workflow.md`。

## 优先级

按以下顺序处理冲突：

1. 当前用户明确的 Codex-only 与外部动作授权；
2. `AGENTS.md`、产品任务、允许路径和仓库安全边界；
3. 显式 `$product-flow`；Codex-only 时不得启动 Claude runner，改用项目 Codex 专业角色链；
4. 本工作流的场景路由；
5. Superpowers、gstack 等第三方 skill 自身说明。

第三方 skill 不得扩大权限、允许路径、网络/密钥访问或外部写入。冲突时采用仓库规则；
无法安全兼容时停止并报告。

## 选择最小流程

只选择对当前任务有直接价值的步骤，不因已经安装而运行全套：

| 场景 | 首选纪律 | 可选工具 |
| --- | --- | --- |
| 新需求或方案 | `brainstorming`、`writing-plans` | `gstack-spec`、相关 `gstack-plan-*` |
| 实现或回归 | `test-driven-development`、`executing-plans` | 与模块直接相关的 gstack skill |
| 故障或异常 | `systematic-debugging` | `gstack-investigate` |
| UI、浏览器与交付检查 | `verification-before-completion` | `gstack-design-review`、`gstack-browse`、`gstack-qa-only`（只报告）、`gstack-qa`（授权修复）、`gstack-review` |

纯解释、状态查询、只读审查或微小文档修正采用仓库基线即可，不强制调用第三方 skill。
个人环境缺少某个第三方 skill 时，使用同等的 Codex 原生分析、计划、测试或浏览器能力继续；
不得因此让项目 CI 失败，也不得临时从网络安装未审查代码。

## 执行门禁

开始前写明关键假设、任务类型、拟用 skill 和允许路径。实质产品任务继续使用
`docs/product/tasks/TEMPLATE.md`，并填写技能计划、Codex-only 模式和验证证据。

若用户明确说“只用 Codex”“不要 Claude”或等价表达，本次任务必须：

- 不调用 `gstack-claude`；
- 不调用 `claude` CLI；
- 不运行 `.agents/skills/product-flow/scripts/run-claude-delivery.mjs` 的交付模式；
- 需要团队交付时，按 `solution-architect`（只读）→ `module-engineer`（顺序写入）→
  `test-engineer`（独立验证）的 Codex 角色链执行。

`gstack-ship`、`gstack-land-and-deploy` 或任何 skill 名称都不构成提交、推送、合并、部署、
删除、生产写入或创建外部资源的授权。这些动作必须获得当前任务的单独明确授权。

## 证据闭环

实现后先自审，再运行与改动风险相称的真实验证。完成声明必须包含新鲜证据：实际使用的
skill、命令、PASS/FAIL 结果、未运行项和剩余风险。不得以计划、旧日志或 agent 自述代替验证。

第三方 skill 每次升级后都要重新审查来源与行为；仓库规范继续优先。
