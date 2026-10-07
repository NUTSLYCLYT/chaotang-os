# Codex → Orca/OpenCode 并行开发工作流

本项目的唯一产品主线是 `ext-dev`。Codex 负责目标冻结、设计审查、产品 authority 检查和最终验收；Orca 负责隔离 worktree、终端和任务编排；OpenCode 负责已批准模块的实施和独立测试。

## 三个角色

| 角色 | 允许做什么 | 明确禁止 |
| --- | --- | --- |
| Codex | 读取证据、冻结任务合同、审查设计、运行验收、决定是否继续 | 未经单独授权提交、推送、合并、部署 |
| Orca | 为每个模块创建独立 worktree、启动终端、记录状态和交接证据 | 让多个写角色修改同一个工作区 |
| OpenCode | 在被分配的 worktree 内实施或测试一个模块 | 绕过 Harness、修改 authority、提交或推送 |

## 一次迭代的固定顺序

1. Codex 读取 `AGENTS.md`、Harness 边界、ADR 和任务合同，冻结目标、允许路径、非目标、验收命令。
2. Codex 只读设计审查，确认任务可以拆成互不重叠的模块。
3. Orca 从 `ext-dev` 创建独立 worktree；每个 worktree 只绑定一个写角色和一个模块。
4. OpenCode 在该 worktree 中先建立 RED，再做最小 GREEN，运行模块测试并记录证据。
5. Codex 在干净候选上重新运行 Harness、任务测试和验收命令，检查 diff 是否越界。
6. 只有用户再次明确授权，才进行 commit、push、merge 或 deploy；这些动作不属于默认施工权限。

## 当前工作区归类

- **产品运行时**：`frontend/`、`backend/`、`deploy/`。
- **项目治理**：`.harness/`、`scripts/`、根 `AGENTS.md`、`ARCHITECTURE.md`、`docs/decisions/`、`docs/product/tasks/`。
- **客户端和技能配置**：`.agents/`、`.codex/`、`.claude/`、`.superpowers/`、`opencode.json`、`.opencode/`。
- **证据和历史材料**：`docs/reviews/`、`docs/failures/`、`docs/evidence/`、`docs/migrations/`、`.harness/changes/`。
- **生成物和本地缓存**：`frontend/node_modules/`、`frontend/.next/`、`backend/.venv/`、缓存目录和运行期数据；它们不属于产品源代码，不能被当作候选提交。

## 当前并行队列

1. `G3-harness-windows-portability`：修复 Harness 对 Windows Git 的硬编码，当前已形成最小 diff并通过 authority 测试；等待独立治理提交。
2. `G3-capability-capsule-digest`：批准基线上的六个胶囊已无待修复 digest；capsule 测试 13/13、组合评测测试 21/21、Python 评测 38/38；保持 Node 矩阵的 `unmeasured/not-authorized` 安全结论，不伪造指标。
3. `G3-windows-storage`：继续使用现有 `g3-windows-storage-sim-20261006` 隔离 worktree，不把实验结果直接带入主线。
4. `product-acceptance`：等前两项有新鲜证据后，再做真实流程和 UI 验收。

旧快照、发布集成目录和历史 worktree 保留为只读 donor；没有逐项任务合同和字节级证据，不批量吸收、删除或合并。
