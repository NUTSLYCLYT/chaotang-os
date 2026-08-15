# 任务：ext Root Observation Kernel G1

> Task ID：`EXT-ROOT-OBSERVATION-KERNEL-G1-20260816`

## Status

Implemented

## Product Definition

- 问题：`ext-dev` 已有真实产品代码，但 root `AGENTS.md` 仍声明没有正式业务代码，且根 `.harness`
  和只读 doctor 缺失，导致 agent 入口与项目事实漂移。
- 目标：在 `origin/ext-dev@16e9cc38d5e9d003bae49d79f644954c12cba728` 的单亲子候选中，建立
  十路径 `BOOTSTRAP_OBSERVE` 根观察核；准确记录 root/frontend/backend 状态并保持产品 STOP。
- 用户价值：减少误路由、重复治理和错误开工，让后续 M0 与产品纵切拥有可信入口。
- 非目标：不恢复旧 25 路径 control plane、外部 HSM、模板、generator、change history；不修改
  frontend/backend 产品、CI、ADR 0028、ext authority、数据库、平台或产品权限。

## User Approval Boundary

用户于 2026-08-16 确认以 `16e9cc38d` / tree `a8cf0bed` 为基线，按已冻结十路径、RED→GREEN
与连续 10 轮实施；当前采用主会话自审、机器证据和 Owner 验收，结论必须标明
`NO INDEPENDENT REVIEW / CONDITIONAL PASS`。仅允许生成本地候选，commit/push 另行确认。

## Frozen Identity and Allowed Paths

- Base：`16e9cc38d5e9d003bae49d79f644954c12cba728`
- Base tree：`a8cf0bed1184518b42fc2461d5c2c930b8232c4a`
- Branch：`codex/ext-root-observation-kernel-g1-20260816`
- Exact paths：
  1. `AGENTS.md`
  2. `.harness/agents/project-owner.md`
  3. `.harness/rules/project-boundaries.md`
  4. `.harness/contracts/project-harness.schema.json`
  5. `.harness/manifest/project-harness.json`
  6. `scripts/harness-doctor.mjs`
  7. `scripts/harness-doctor.test.mjs`
  8. `scripts/check_harness.mjs`
  9. `docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1.md`
  10. `docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1.md`

## Acceptance Criteria

- [x] root `AGENTS.md` 不超过 80 行，删除无业务代码的错误事实并准确说明三层所有权。
- [x] schema 与所有对象边界 closed；manifest unknown/duplicate/path/status/READY 伪装失败关闭。
- [x] manifest 固定 root `READY_FOR_OBSERVE`、frontend `ABSENT`、backend `PARTIAL`、authority STOP、
  `canExecuteProductWork=false` 与 `EXTERNAL_NOT_CONSUMED`。
- [x] doctor `--check`/`--status` exit 0；`--ready` 固定 `NOT_READY`/exit 2；其他命令 exit 64。
- [x] doctor 不联网、不写文件、不调用授权命令，只观察 ext `--status` 且拒绝 product true。
- [x] `scripts/check_harness.mjs` 与 self-tests 同候选登记十路径并保持 ADR 0028 等既有门禁。
- [x] 精确十路径、无 secret/冲突/whitespace；冻结 fingerprint 后由最终交付记录连续 10 轮证据。
- [x] 主会话 code/security 自审关闭 Critical/Important；报告明确 `NO INDEPENDENT REVIEW`。

## Delivery Constraints

- 仅允许 Frozen Identity 的十路径；出现第 11 路径、base/remote 漂移或产品权限变化立即停止。
- 不读取 secret，不访问真实 provider/生产数据，不修改外部平台，不提交、不推送、不合并、不部署。
- G1 是治理观察层，不产生 M0 或产品 GO；后续阶段仍须独立 exact task。

## Affected Modules

- 模块：Root entry、project observation manifest、read-only doctor、Harness registration。
- 允许路径：仅 Frozen Identity and Allowed Paths 的十项。

## Technical Plan

- 先写 doctor RED tests，证明能力缺失；再最小实现 closed schema/manifest、disk/authority projection、
  CLI 和 root entry；最后运行专项、既有 Harness、scope、安全自审与连续 10 轮。
- 回滚：候选保持单一可 revert diff；未提交时可直接废弃隔离 worktree，不触碰 `ext-dev`。

## Implementation Report

- 改动摘要：建立精确四文件根 `.harness`、closed schema/manifest、只读 doctor 与专项测试；更新
  根入口及既有 Harness 登记，并将历史六部评审指纹与当前 checker 自绑定安全解耦。
- 验证：RED 已证明 doctor 缺失、非法 schema 语义、目录逃逸与符号链接读取风险；GREEN 为 8/8。
  预验收通过 Harness 141 文件/170 自测、hook 3 项、product-flow 25 项、ext authority 11/11。
- 未运行项：产品、浏览器、外部平台与真实 provider 不属于 G1。
- Review：`NO INDEPENDENT REVIEW`；主会话 code/security 自审无未关闭 Critical/Important。

## Acceptance Review

- 当前结论：`CANDIDATE / CONDITIONAL PASS / NO INDEPENDENT REVIEW`。
- 已有证据：doctor RED→GREEN、既有 Harness、hook、product-flow 与 ext authority 全绿；产品仍 STOP。
- 待完成：对本文件不再变更后的冻结 fingerprint 连续执行 10 轮，并在最终交付中报告候选身份。
