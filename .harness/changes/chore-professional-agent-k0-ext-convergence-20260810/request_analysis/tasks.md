# 任务：chore-professional-agent-k0-ext-convergence-20260810

## 任务 1

- 目标：将旧 K0 的机器可读台账能力适配到当前 EXT，建立能力 + 契约 + 测试事实表。
- 前置条件：`R0-W08` V2 返回 GO；EXT 基线为 `4c543209333fa14f3a296ff1ff917642153ffc30`。
- 输入：K0 donor 三个候选提交、当前 `backend/src`/`backend/web`/`backend/harness`、35 个设计契约、71 个运行 Prompt。
- 输出：schema、manifest、Draft 2020-12 校验器、只读 CLI、Node 测试与候选说明；根 harness 登记留给后续 exact-H authority Packet。
- 涉及文件：仅本 change 记录、专业 Agent matrix 文件与 `scripts/professional-agent-*` / `scripts/professional_agent_*`。
- 状态 / 数据变化：无运行数据变化；新增 `BASELINED_CURRENT_EXT` 治理状态。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：单 Packet、无数据库迁移；反向移除新增登记即可。
- 完成定义：12 个 focused tests、矩阵检查、93 个引用能力测试、根/后端 doctor 通过；99 台账既存 ref 漂移和根登记转交后续 exact-H authority Packet，独立复核后才可集成。
