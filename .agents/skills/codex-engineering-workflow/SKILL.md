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

<!-- adaptive-routing-contract:start -->
## 先盘问并自动分流

先检查仓库事实，只询问会改变目标、范围、验收、风险或授权的问题。信息足够立即停止盘问；关键歧义无法消除时返回 `Blocked`。

按需求明确度、影响范围、可逆性、失败后果、路径确定性和验证难度自动选择：

| 路线 | 条件 |
| --- | --- |
| 直接执行 | 明确、局部、可逆、低风险、不改变业务行为且容易验证 |
| Matt Skills | 局部行为修改且风险可控，但需要针对性澄清、实现或审查 |
| Superpowers | 跨模块、架构/契约变化、未知根因、难回滚、高风险或验证链较长 |

开始实现前输出：

```text
Task profile: summarize the current clarity, scope, reversibility, impact, path certainty, and verification difficulty
Selected route: state exactly one of direct execution, Matt Skills, or Superpowers
Reason: explain why the route is the smallest one sufficient for current evidence
Quality gates: list the applicable root-cause, test, fresh-verification, safety, and authorization outcomes
Escalation: list the observable evidence that will trigger a heavier route
```

允许按 `直接执行 → Matt Skills → Superpowers` 升级，不得静默降低 Quality gates。范围实质变化时重新盘问；连续验证失败时必须说明证据并升级到 Superpowers。已有明确授权的高风险事项使用 Superpowers；缺少授权或未解决业务歧义时进入 `Blocked`。Matt Skills 缺失时不自动安装，改用等价 Codex 原生步骤，无法满足门禁时升级到 Superpowers。
<!-- adaptive-routing-contract:end -->

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
完成声明继续使用 `verification-before-completion` 取得最终改动后的新鲜验证。

第三方 skill 每次升级后都要重新审查来源与行为；仓库规范继续优先。
