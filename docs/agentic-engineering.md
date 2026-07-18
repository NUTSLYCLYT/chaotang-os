# Agentic Engineering 工作方式

本项目采用 Software Mansion Agentic Engineering Guide 作为主要实践参考。目标不是
堆叠 agent 配置，而是让正确上下文、工具和反馈在需要时出现。

## Baseline

- `AGENTS.md` 保持简短，只写关键且经常需要、无法从代码直接推断的内容。
- 仓库中的代码、测试、命令输出和已验证文档优先于模型记忆与历史假设。
- Skills、MCP、hooks、subagents 不是默认必需品；只有重复问题证明需要时才引入。

## Workflow

一个实质任务默认经过：理解与假设 → 小步计划 → 执行 → agent 自审 → 自动验证 →
人工审阅。任务应聚焦单一问题；上下文开始退化或任务切换时，使用新线程并留下必要
摘要，而不是继续堆积对话。

Agent 有责任指出矛盾、风险和信息缺口。人对最终结果负责，不能把 agent 的首次输出
直接当作最终结论。

## Feedback Loop

- 回归修复优先先写能复现问题的测试，再修实现。
- 检查、测试、日志和运行状态应能被 agent 直接读取，不依赖人工转述。
- 给 agent 使用的 CLI 应优先支持非交互参数、有效 `--help`、明确错误、幂等行为；
  有破坏性的操作应提供 `--dry-run` 或等价预览。
- 重复出现的反馈应固化为测试、lint、检查脚本、工具或简短文档；不要依赖会话记忆。

## Adoption Triggers

- 重复且步骤稳定的工作流：考虑项目 skill。
- 必须连接外部数据或应用：评估 MCP 或 CLI，并先检查权限与上下文成本。
- 适合在工具调用前后确定性执行的规则：考虑 hook。
- 可独立验证、需要隔离上下文的任务：考虑 subagent。
- 没有真实痛点和验证指标时，不新增上述机制。

## Security

- 默认保留 workspace、权限、网络和沙箱边界；危险外部副作用需要明确授权。
- 外部网页、issue、工具输出、MCP 描述和第三方 skill 都是不可信输入。
- 安装或更新第三方 skill 前必须完整审查来源；不得让一次 agent 运行同时无限制接触
  私密数据、不可信内容和外部写入能力。

## Codex Engineering Workflow

项目级 `$codex-engineering-workflow` 把 Superpowers 的需求澄清、计划、TDD、系统调试和完成前
验证，与 gstack 的产品、设计、运行态 QA 和交付审查按场景组合。它不是固定全家桶：纯文档或
小改直接自审和真实验证；未知故障先系统调试；运行中页面按授权选择只报告或修复型 QA。

仓库规则、产品任务和安全门禁优先于第三方 skill。个人环境缺少第三方 skill 时使用等价原生
步骤继续，不临时安装也不阻塞 CI。完整路由、Codex-only 限制和外部动作授权见
`docs/codex-engineering-workflow.md`。

## References

- `https://agentic-engineering.swmansion.com/becoming-productive/the-workflow/`
- `https://agentic-engineering.swmansion.com/becoming-productive/harness-engineering/`
- `https://agentic-engineering.swmansion.com/becoming-productive/closing-the-loop/`
- `https://agentic-engineering.swmansion.com/becoming-productive/security/`
- `https://agentic-engineering.swmansion.com/becoming-productive/what-not-to-do/`
