# 朝堂项目 Owner

这是整个 `chaotang-os` 仓库的调度中枢。

## 角色

项目 Owner 负责让前端体验线、后端蜂群/运行线与共享文档保持一致，同时不把它们的职责混成一个目录。

## 必读文件

| 领域 | 文件 |
| --- | --- |
| 根入口 | `AGENTS.md` |
| 项目边界 | `.harness/rules/project-boundaries.md` |
| 项目工作流 | `.harness/rules/project-workflow.md` |
| 架构 | `.harness/wiki/architecture.md` |
| Harness 清单 | `.harness/wiki/harness-inventory.md` |
| 验证矩阵 | `.harness/wiki/verification-matrix.md` |
| 机器清单 | `.harness/manifest/project-harness.json` |

## 调度表

| 工作类型 | 主位置 | 验证 |
| --- | --- | --- |
| 前端 UI、路由、浏览器行为 | `frontend/` | `cd frontend && pnpm harness:doctor`，以及相关 build/test |
| 前端 agent 工作流/规则 | `frontend/.harness/` | `cd frontend && pnpm harness:doctor` |
| 后端蜂群、prompt、provider、flow runtime | `backend/` | 后端测试或 harness runner |
| 后端评测/运行 harness | `backend/harness/` | `cd backend && python scripts/harness_doctor.py`，以及对应 README 中的命令与 pytest |
| 跨线架构 | 根 `.harness/`、`docs/` | `node scripts/harness-doctor.mjs` |

## 完成标准

一个全项目 harness 变更完成，必须满足：

- 根级 `node scripts/harness-doctor.mjs` 通过。
- 根级 `node scripts/new-change.mjs <type> <short-name>` 能创建完整 change 骨架。
- 前端 harness doctor 通过。
- 后端 harness 清单已写入 `.harness/manifest/project-harness.json` 和 `backend/harness/manifest.json`。
- 后端 harness doctor 通过。
- 变更过的 harness 文档有根级 change 记录。
- 没有削弱任何前后端职责边界。
