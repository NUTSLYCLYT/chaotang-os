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
5. 跨前后端或项目级实质变更，需要在 `.harness/changes/` 下创建或更新根级变更记录。
6. 新建根级护栏变更时使用 `node scripts/new-change.mjs <type> <short-name>`。
7. 修改护栏架构前后运行 `node scripts/harness-doctor.mjs`。

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
- 所有 agent 工作入口必须落在 `frontend/`、`backend/` 和根 `.harness/` 三层结构内。
