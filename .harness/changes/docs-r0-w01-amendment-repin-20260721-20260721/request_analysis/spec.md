# 规格说明：docs-r0-w01-amendment-repin-20260721-20260721

## 背景

G0 已通过 Gitee Pull Request !5 合入，但 canonical R0 amendment 仍记录旧基线、待合并状态和未分配 Owner。W01 的第一步不是实现 v2，而是把修正案重钉到最新 EXT，并把用户指定的阶段性责任边界变成可验证契约。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | G0 已合入，最新 EXT 为 `ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150` | `git rev-parse origin/feature-chaotang-ext`，2026-07-21 | Codex 只读取证 | 否 |
| 已确认事实 | `dev` 无独有提交，已经被 EXT 完整吸收 | merge-base=`7d46de3107e8b055ad77af1389461aba3b172745`，left/right=`537/0` | Codex 只读取证 | 否 |
| 已确认事实 | authority v1 继续 `STOP / AMENDMENT_APPROVAL_REQUIRED` | `node scripts/execution-authority.mjs --authorize` | 自动验证 | 是，阻断 runtime |
| 未知问题 | 最终 exact H/tree/diff/amendment digest 尚未形成，也尚未获得独立复审和用户精确批准 | 本 change 后续证据 | Claude Code + lyt | 是，阻断 W01 v2 |

## 数据流与调用链

`origin/feature-chaotang-ext exact B` → amendment re-pin → manifest 结构化登记 → checker 交叉验证 canonical bytes/base/Owner → root doctor → exact-H 独立复审 → 用户精确批准。任何一步失败均保持 authority STOP。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| amendment canonical bytes | canonical `amendment.md` | checker、审查人、Product Owner | SHA-256 与 manifest candidate digest 一致 |
| effective base | root manifest | amendment checker、root doctor | 精确匹配 `origin/feature-chaotang-ext@ccc2d74...` |
| owner assignments | 用户指派，root manifest 结构化记录 | amendment checker、root doctor | 9 个 Accountable 角色均为 `lyt`；执行/复审分离 |
| professional reassignment gate | canonical amendment + root manifest | W08/W09/真实数据入口 | 缺专业安全/法律/发布负责人即不得进入 |

## 范围

- 重钉 amendment 状态和基线。
- 登记 R0 内部合成数据阶段的具名 Owner、Codex 执行与 Claude Code 独立复审。
- 增强 checker/test/doctor，使基线、Owner 和重新指定门 fail closed。
- 更新现状、任务和验证矩阵；保留 authority STOP。

## 非目标

- 不实现 execution-authority v2。
- 不修改前端或后端 runtime，不修复既有 17/9/3 个失败。
- 不合并 `dev` 或历史任务分支。
- 不批准 W02–W09，不接入真实客户数据，不发布上线。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| base 缺失、漂移或不是 40 位 Git SHA | checker STOP | Node 负例 |
| 任一具名 Owner 缺失、重复、`UNASSIGNED` 或与 manifest 不一致 | checker STOP | Node 负例 |
| candidate digest 不匹配 canonical bytes | checker STOP | CLI 负例 |
| approval evidence 为空 | authority v1 保持 STOP | authorize 回归 |
| 进入真实客户数据、W08 或 W09 前未换专业负责人 | 不得进入对应阶段 | amendment/manifest/doctor 结构门 |

## 风险与回滚边界

风险是同一作者可同时修改文档与检查器，因此本地绿色不等于可信批准。缓解方式是绑定 exact H/tree/diff/digest 的 Claude Code 只读复审、托管门禁和 lyt 最后精确批准。回滚仅 revert 本治理 change；无数据库、runtime 或客户数据变化。

## 计划确认记录

- 批准人：待最终 exact 候选形成后由 `lyt` 精确批准
- 批准日期：待定
- 批准范围：当前仅批准制作和复审 re-pin 候选
- 明确未批准：execution-authority v2、W02–W09 runtime、真实客户数据、发布上线

## 验收标准

- canonical amendment 精确绑定最新 EXT 和 G0 merge 事实。
- 9 个阶段性 Accountable 角色均绑定 `lyt`；Codex/Claude Code 职责分离。
- 客户数据、W08、W09 前重新指定专业安全/法律/发布负责人的门不可删除。
- checker/tests/root doctor 全绿，authority `--authorize` 仍以 exit 2 STOP。
- exact-H 只读复审完成后，向 `lyt` 提供一条不可含糊的批准语句。

## 验证计划

- TDD：`node --test scripts/r0-amendment-check.nodetest.mjs`，先 RED 后 GREEN。
- 专项：`node scripts/r0-amendment-check.mjs`。
- 回归：execution-authority Node tests 与 `--authorize` STOP。
- 架构：`node scripts/harness-doctor.mjs`。
- 静态：`git diff --check`，并核对 B/H/tree/diff/amendment digest。
- 独立：Claude Code 对同一 exact H 的 Authority、Security、Git/Evidence 三路只读复审。
