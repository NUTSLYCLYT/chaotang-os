# Codex 与 Claude Code 运行兼容基线

仓库的共享规则以 `AGENTS.md`、`.agents/` 和根级验证脚本为事实源;`.codex/` 与
`.claude/` 只保存各客户端需要的适配入口。

这里定义的是客户端兼容架构：Codex 默认承担产品管理，Claude Code 默认承担程序团队，
两者使用同一套 harness 语义，并通过 `docs/product/tasks/` 做顺序交接。它不定义两个
agent 同时运行、自动互相调用、并行写入或 worktree 隔离。

## 支持环境

- 仓库支持 **Windows 原生 与 WSL2 Linux 文件系统 双平台**开发，平台策略与契约见
  `docs/platform-strategy.md`；**Linux（CI）是唯一权威验证平台**，本地门禁结果仅供参考。
- 无论工作区位于何处，治理脚本必须跨平台等价：行尾由 `.gitattributes` 统一为 LF，
  路径差异由脚本自行归一（禁止在治理脚本中硬编码单一平台路径）。
- 客户端从仓库根目录启动,保证项目级相对 hook 路径稳定。
- 执行根级 harness 的客户端进程必须能从 `PATH` 找到 Node.js 22 或更新的兼容版本；CI
  当前使用 Node.js 24。
- Windows 侧 Codex 可以直接使用 Windows Node 访问 WSL 工作区;共享 hook 不再
  强制调用 Bash。Claude Code 如果运行在 WSL 内,必须在同一 WSL 发行版安装 Node。
- `.agents/skills/*` 保存 Codex 项目 skill 和共享 skill 事实源；只有需要在 Claude Code 中
  直接调用的共享 skill 才复制到 `.claude/skills/*`，并由检查器做字节级一致性校验。
  Codex 专用的 `product-flow` 不复制给 Claude。这里有意不使用 WSL 符号链接,因为
  Windows Node 通过 UNC 无法稳定读取它们。
- 项目级 hook 和 agent 配置只有在客户端信任该仓库配置后才会加载。

这里的 Node 版本只属于仓库治理工具,不代表前端或后端技术栈已经确定。

## 能力映射

| 能力 | 共享事实源 | Codex 入口 | Claude Code 入口 |
| --- | --- | --- | --- |
| 持久规则 | `AGENTS.md` | 原生读取 `AGENTS.md` | `CLAUDE.md` 导入 `@AGENTS.md` |
| 产品交接 | `docs/product/tasks/*.md` | 定义、置为 `Ready`、验收 | 实现、验证、报告 |
| 专业交付角色 | ADR 0004、ADR 0011 与任务契约 | `.codex/agents/*.toml`（仅 Claude 受限接力） | `.claude/agents/*.md` |
| 一键自动交付 | `.agents/skills/product-flow/` | 当前 Codex 任务编排、受限接力与验收 | 由 runner 非交互调用 |
| 项目 skill | `.agents/skills/*` | 原生扫描 | `.claude/skills/*` 等内容入口 |
| Stop 门禁 | `.agents/hooks/check-harness.mjs` | `.codex/hooks.json` | `.claude/settings.json` |
| Harness 审计 | 同一份语义指令 | `.codex/agents/*.toml` | `.claude/agents/*.md` |

两种客户端的容器格式可以不同,但职责、权限级别和验证结果必须等价。`harness-doctor` 在两端
都保持只读。

正常路径的产品角色仍有意不对称，任务文件是跨客户端事实源；Claude Code 默认承担程序团队，
只有 runner 明确检测到配额/速率限制时，当前 Codex 任务才用同名项目级 subagents 顺序接力。
两端角色配置格式不同，但架构、逐模块交付、测试和负责人汇总的语义边界保持等价。详细状态
流转和字段所有权见 `docs/product-collaboration.md`。

## Codex 工程工作流配置

`.agents/skills/codex-engineering-workflow/` 是 Codex 专用的项目路由规则，不复制到
`.claude/skills/`。它可以调用用户环境中已安装的 Superpowers 与 gstack skill，但仓库不复制
第三方源码、CI 不安装或依赖个人 skill；不可用时按 `docs/codex-engineering-workflow.md` 的
等价原生步骤降级。

Codex-only 是任务级交付约束，不改变本仓库默认的双客户端兼容基线。该约束存在时不得启动
Claude CLI、Claude runner 或 `gstack-claude`，改由 Codex 的 `solution-architect`、
`module-engineer`、`test-engineer` 顺序交付并保留同一任务证据。

## 本地检查

每次修改共享核心或客户端适配配置后,从仓库根目录运行:

```text
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
```

还需要进行客户端级人工冒烟检查:

- Codex:确认项目级 hook、项目 skill、`harness-doctor` 及三个交付专业角色可见。
- Claude Code:用 `/memory` 确认 `CLAUDE.md` 已导入 `AGENTS.md`,并确认两个 skill 与
  `harness-doctor` 可见；用 `/agents` 确认架构、模块交付和测试三个专业角色可见。
- 在一个临时分支制造可恢复的 harness 失败,确认 Stop hook 首次要求继续、再次失败
  不会无限循环。完成后撤销临时改动。

客户端功能快速变化,当前不猜测最低版本号。升级客户端后以以上能力冒烟检查作为
兼容依据;首次记录到稳定版本组合时再把准确版本写入本文件。
