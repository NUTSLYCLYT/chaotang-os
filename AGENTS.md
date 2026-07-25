# 朝堂 OS 项目工作入口

本文件是整个 `chaotang-os` 工作区的根入口，用来统筹前端工程护栏、后端运行与评测护栏，以及项目级文档。

## 当前统一架构

当前工作区以 `chaotang-os` 为唯一项目根：

- `frontend/` 是朝堂 OS 前端体验线，当前入口以 `frontend/AGENTS.md` 与 `frontend/.harness/` 为准。
- `backend/` 是后端蜂群、flow、agent、provider 与运行/评测线，当前入口以 `backend/AGENTS.md` 与 `backend/harness/` 为准。
- `.harness/` 是根级协调层，只做项目级清单、边界、验证和跨线变更记录，不承接前端页面实现，也不承接后端蜂群运行逻辑。

## 启动顺序

1. 阅读 `.harness/agents/project-owner.md`。
2. 阅读 `.harness/rules/project-boundaries.md`。
3. 查看 `.harness/wiki/architecture.md` 与 `.harness/wiki/harness-inventory.md`。
4. 进入具体工作线：前端读 `frontend/AGENTS.md`，后端读 `backend/AGENTS.md`。
5. 领取产品实现任务前先运行 `node scripts/execution-authority.mjs --check`，它只验证 v1 失效关闭护栏完整性，**不授予施工权**；再运行 `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>`，这是唯一的范围化产品施工决定。v2 返回 `STOP` 时不得领取产品实现任务；只能编制获批 amendment，或执行用户另行明确批准的治理/事故/证据修复。
6. 跨前后端或项目级实质变更，需要在 `.harness/changes/` 下创建或更新根级变更记录。
7. 新建根级护栏变更时使用 `node scripts/new-change.mjs <type> <short-name>`。
8. 修改护栏架构前后运行 `node scripts/harness-doctor.mjs`。

## 护栏分层

| 层级 | 路径 | 职责 |
| --- | --- | --- |
| 根项目护栏 | `.harness/` | 全项目归属、边界、清单、跨线审计 |
| 前端工程护栏 | `frontend/.harness/` | 前端 agent 工作流、规则、技能、知识库、变更记录 |
| 后端运行/评测护栏 | `backend/harness/` | manifest、共享契约、黄金样例、运行器、门禁、可靠性检查 |
| 产品文档 | `docs/`、`frontend/docs/`、`backend/docs/` | 长期产品与运行文档 |

## 不可绕过

- 不要把 `frontend/.harness/` 当成整个项目的护栏系统。
- 不要把后端运行器、提示词、黄金样例或生产执行逻辑搬进前端 `.harness/`。
- 后端 dry-run 不能证明浏览器体验，前端 mock 也不能证明后端蜂群质量。
- 跨线变更必须记录：哪条线拥有事实源，以及哪条验证命令能证明它。
- 调查、计划、change 记录、Packet/review 结论或用户对方向的确认都不能单独激活 M0–M10；执行权威只由机器可读 manifest 与未来获批 amendment 共同决定。
- 所有 agent 工作入口必须落在 `frontend/`、`backend/` 和根 `.harness/` 三层结构内——这一条管的是**内容/所有权主线**（业务逻辑、运行时状态、需要独立事实源和 harness 验证的东西，如 `courtos-brain/` 差点变成的第四主线）。根级 `.claude/`（Claude Code 自身的 agent/skill/hook 配置）不算第四条主线，不在此约束范围内：它不持有业务逻辑或运行时状态，只是配置"怎么调用 agent"，agent 实际检查的对象仍落在三层结构内。精确定义、豁免前提和实例见 `.harness/rules/project-boundaries.md`。

## Claude Code specific rules

- 复杂任务必须先使用 Plan mode。
- 规划阶段不得修改文件。
- 审查任务只审查，不直接重写实现。
- 调研大型模块时使用子代理，主会话只保留结论。
- 发现任务范围外问题时记录，不顺便修复。
