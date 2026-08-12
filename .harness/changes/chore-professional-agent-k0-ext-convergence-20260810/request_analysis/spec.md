# 规格说明：chore-professional-agent-k0-ext-convergence-20260810

## 背景

旧 `codex/professional-agent-k0-20260803` 提供了机器可读资产台账，但其 39 个 bureau 与 20 个 capability 均指向旧 `backend/app`。当前 EXT 的运行事实源已迁移到 `backend/src`、`backend/web`、`backend/harness`，不能整包复制。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前 EXT 无专业 Agent 资产矩阵检查器 | `node scripts/professional-agent-matrix.mjs --check` 初始返回 MODULE_NOT_FOUND | Project Owner | 否 |
| 已确认事实 | 旧 K0 路径基于 `backend/app`，不适配当前 EXT | donor commits `a6c391cb`、`4c55ad78`、`675aa950` | Project Owner | 否 |
| 已确认事实 | 当前 EXT 有 35 个设计契约、71 个运行 Prompt | 递归文件计数，由新检查器复验 | Backend Owner | 否 |
| 未知问题 | 71 个 Prompt 与 35 个设计尚未逐个绑定运行入口、工具权限和黄金样例 | 矩阵 `PARTIAL` 条目 | 后续 Packet | 否 |

## 数据流与调用链

旧 K0 donor → 只提取字段与失败关闭规则 → 对照当前 EXT 路径 → 生成 current-EXT manifest → 只读检查器验证路径、计数、成熟度和测试覆盖。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 专业 Agent 资产矩阵 | `.harness/manifest/professional-agent-asset-matrix.v1.json` | 收敛计划、后续专业 Agent Packet | Draft 2020-12 schema + Node 测试 + 只读 CLI；根 doctor 登记待后续 authority Packet |
| 现行 Agent 事实 | `backend/src`、`backend/web`、`backend/harness` | 资产矩阵 | 只登记存在路径，不复制运行逻辑 |
| 设计与 Prompt 集合 | `backend/agent_design`、`backend/runtime_prompts` | 资产矩阵 | 递归计数；覆盖不足必须标 `PARTIAL` |

## 范围

仅根 `.harness`、`scripts` 与本 change 记录；不改运行时、API、前端、数据和旧 donor worktree。

## 非目标

- 不吸收 `backend/app`。
- 不实现专业 Agent runtime、Companion 或十样本工作产品。
- 不修改 99 个冻结 source ref，不删除 worktree。
- 不授予 push、merge、deploy 或生产权限。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 登记路径不存在 | 检查失败并列出路径 | Node 负向测试与 `--check` |
| 无测试却声明 VERIFIED | 校验拒绝 | Node 负向测试 |
| 设计/Prompt 数量漂移 | 检查失败并给出期望/实际数量 | inventory assertions |
| 旧 donor 路径混入 | 安全路径存在性检查失败 | `--check` |

## 风险与回滚边界

风险是把文档/Prompt 数量误当运行能力。矩阵通过 `coverageStatus` 与 `gapReason` 显式区分。回滚只需反向移除本 Packet 新增文件；根项目登记尚未发生，无数据迁移。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-08-10
- 批准范围：继续 EXT 单主线收敛，先吸收专业 Agent K0 资产矩阵并避免重复开发。
- 明确未批准：旧分支整包合并、删除 worktree、生产启用和外部副作用。

## 验收标准

1. 当前 EXT 矩阵能独立通过结构与路径检查。
2. 所有 VERIFIED 能力都有现行测试；无测试集合必须为 PARTIAL。
3. 35 个设计契约和 71 个运行 Prompt 数量由机器核对。
4. 根、后端 doctor 通过，工作树只含本 Packet 文件。
5. 根 manifest/doctor 登记由后续 exact-H authority Packet 完成；登记前不得称 K0 已集成或 CLOSED。

## 验证计划

- `node --test scripts/professional-agent-matrix.nodetest.mjs`
- `node scripts/professional-agent-matrix.mjs --check`
- `node scripts/ext-branch-convergence.mjs --check`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `node scripts/harness-doctor.mjs`
- `cd backend && python3 scripts/harness_doctor.py`
