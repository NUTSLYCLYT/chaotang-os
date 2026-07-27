# CI 摘要：docs-r0-w07-a0-contract-bridge-20260727

## Authority Phases

| 阶段 | v2 结果 | 含义 |
| --- | --- | --- |
| 编辑前 exact EXT base `b8f7b27b...` | exit 0，`GO / APPROVED_WORK_PACKAGE` | W07 是唯一 active package |
| isolated candidate | exit 1，`STOP / active-packet EXT ref must equal pinned HEAD` | 预期 `PRE_INTEGRATION_W07`，候选无产品执行权 |

不得为了使 isolated candidate 返回 GO 而移动 `feature-chaotang-ext` ref。只有未来获批
受控整合后，才能在 exact integrated HEAD 上重新取得 canonical authority 证据。

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 |
| --- | ---: | --- | --- |
| base: `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD` | v1 inactive integrity guard |
| base: `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07` | 0 | `GO / APPROVED_WORK_PACKAGE` | 编辑前 exact EXT authority |
| base: `node scripts/harness-doctor.mjs` | 0 | `0 errors / 0 warnings` | 编辑未提交、HEAD 仍等于 EXT ref |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | `0 errors / 0 warnings` | backend harness inventory |
| candidate: v1 `--check` | 0 | `VALID_INACTIVE_GUARD` | candidate v1 integrity |
| candidate: v2 W07 `--authorize` | 1 | expected PRE_INTEGRATION STOP | ref 未移动的 fail-closed proof |
| candidate: root doctor | 1 | 仅 1 个预期 EXT-ref error；delegated doctors PASS | exact candidate 不冒充 integrated |
| `git diff --check b8f7b27b..HEAD` | 0 | PASS | base-to-candidate diff |
| `git diff --name-status b8f7b27b..HEAD` | 0 | 7 个新增文档文件 | 无产品、authority 或 schema 文件 |

时间：`2026-07-27`，isolated worktree
`r0-w07-a0-contract-bridge-20260727`。

## 结果

root doctor 首次在 base phase 发现 `summary.md` 的 Change ID 使用反引号，不符合纯文本
精确比较。经只修改该格式后 base phase fresh 复跑为 0/0。

提交候选后，v2 和 root doctor 按仓库 threat model 转为预期 PRE_INTEGRATION STOP；
该结果证明 EXT ref 没有被候选擅自移动，不是产品或设计验证通过。

本候选完成 W07-A0 scope amendment proposal、两阶段设计和 TDD 计划。Checkpoint A
先建立 `RUNNABLE_MINIMUM`，Checkpoint B 在 W08 前完成 hardening。

## 未验证项

- 未修改或运行 backend/frontend 产品代码。
- 未运行 W07 implementation tests、browser flow 或 build。
- 未创建或执行 mission migration。
- 未验证 Checkpoint A/B 产品行为；这些属于后续获批 implementation Packet。
- 未做 EXT integration、push、部署、持久数据库或 listener 3050 操作。

## Diff 与回滚复核

- changed files：7 个新增治理/设计文件。
- diff review：仅本 root change、一个 design 和一个 plan。
- rollback：当前候选可通过丢弃 isolated branch 回滚；未演练 destructive rollback。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 单一 W07 sub-slice，无第二 authority | scope amendment + authority phase evidence | PASS |
| 先跑通再完善的两个强制 checkpoint | design + implementation plan | PASS |
| 无产品代码和后继范围越界 | exact name-status + scope review | PASS |
| isolated candidate 保持 fail closed | exact candidate v2/root doctor expected STOP | PASS |
| 产品行为已经跑通 | 本 Packet 明确不实施 | NOT_TESTED |

## 声明状态

- `VERIFIED_COMPLETE`：仅指 non-authorizing governance/design Packet。
- authority state：`PRE_INTEGRATION_W07 / STOP`。
- 产品状态：`UNCHANGED / NOT_TESTED / NOT_DEPLOYED`。
