# 规格说明：docs-r0-w02-closeout-reconcile-20260722-20260722

## 背景

会话恢复后发现本地工作区 `.harness/manifest/execution-authority.v2.json` 有未提交改动，字节级
精确匹配另一条从未 merge 的分支 `docs/r0-w01-closeout-20260721`（commit `38fe3068`，Codex 生成）
的版本——该分支主张"W01 完成不能自动推导 W02 获批"，把 ledger 收回 `activeWorkPackage: null`。
但同期核实：R0-W02 已通过独立的具名批准（AskUserQuestion 三问确认）、实现、独立审查，并已真实
merge 进 `origin/feature-chaotang-ext`（W02 commit 是其祖先，且 ext 上还有 4 个后续 W02 相关
提交）。因此该分支试图阻止的状态已经发生且合法收口——分支本身是"被现实追过的旧提案"，但它
提出的治理原则（收口和下一包激活必须分开、各自独立批准）是对的，值得保留并通用化后采纳。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 工作区未提交改动字节级匹配 `38fe3068`（`docs/r0-w01-closeout-20260721`，未 merge、未走完独立审查） | `git hash-object` 对比 `git log --all` 遍历的历史 blob，2026-07-22 | 已验证 | 否 |
| 已确认事实 | R0-W02（`3caa0a51`）已是 `origin/feature-chaotang-ext` 祖先；ext 领先 4 个 W02 相关提交 | `git merge-base --is-ancestor` + `git log origin/feature-chaotang-ext -5`，2026-07-22 | 已验证 | 否 |
| 已确认事实 | 两条并行工作线（本线 + `fix-ui-runtime-incident-20260722`）均明确声明未改动/不拥有该文件的 null 状态 | `backend/harness/changes/fix-canonical-loop-evidence-20260722/summary.md` 原句 | 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | `docs/r0-w01-closeout-20260721` 分支本身尚未正式归档/关闭，仍悬空存在 | 不适用 | 待用户或后续处理 | 否（不阻塞本次，工作区已用正确基线覆盖） |

## 数据流与调用链

```
恢复会话 → 发现工作区未提交异常 → git hash-object 比对历史blob → 定位来源commit 38fe3068
  → 核实ext真实merge状态(W02已进ext) → 判定该分支已被现实追过
  → 丢弃工作区异常改动(git checkout HEAD --) → 从正确基线(W02 ACTIVE)前进到真实状态
    (W02 MERGED_AND_VERIFIED, activeWorkPackage=null) → 通用化doctor/test/wiki采纳该分支的治理原则
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `execution-authority.v2` 静默收口态 | 本变更 | resolver/CLI/doctor/未来 W03 批准流程 | 27 项 nodetest（含新增通用回归）+ doctor 动态断言 |
| "包完成≠下一包获批"原则 | `.harness/wiki/execution-authority-v2.md`（本变更新增段落） | 未来任何 packet 收口时的实现者 | 文字化记录，非机械强制（下一次仍需人工遵守） |

## 范围

`execution-authority.v2.json` 校正为反映 W02 真实合并状态；`harness-doctor.mjs`/nodetest 的
硬编码假设通用化为同时支持"有活跃包"和"静默收口"两种状态；wiki 记录治理原则。

## 非目标

不批准 R0-W03；不删除/强制关闭 `docs/r0-w01-closeout-20260721` 分支（留给用户决定）；不处理
`fix-ui-runtime-incident-20260722` 并行任务的任何文件。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 请求已收口的 R0-W02 | `STOP/NO_ACTIVE_WORK_PACKAGE`（不是 `GO`，即使它就是最后完成的包） | 真实命令 + nodetest |
| 请求尚未批准的 R0-W03 | `STOP/NO_ACTIVE_WORK_PACKAGE`（不是 `BLOCKED_DEPENDENCY`，因为它连"排队"资格都还没有） | 同上 |
| doctor 在静默收口态下运行 | 断言"每个探测请求都是 NO_ACTIVE_WORK_PACKAGE"，不再硬编码具体包名 | `node scripts/harness-doctor.mjs` 输出确认 |

## 风险与回滚边界

纯 harness 治理文件 + 脚本泛化，无业务逻辑变更。回滚：`git revert` 恢复到 W02 ACTIVE 状态
（相当于把静默收口态撤销，但不会退回到"无 guard"，也不会意外激活 W03——resolver 本身的
fail-closed 边界未被这次改动削弱）。

## 计划确认记录

- 批准人：lyt
- 批准日期：2026-07-22
- 批准范围：本变更全部内容（丢弃工作区异常 + ledger 更新为 W02 MERGED_AND_VERIFIED + doctor/test/wiki 通用化）
- 明确未批准：R0-W03 及以后；`docs/r0-w01-closeout-20260721` 分支的删除或归档动作

## 验收标准

`--authorize --work-package R0-W02`、`R0-W03` 均返回 `NO_ACTIVE_WORK_PACKAGE`；27/27 nodetest；
root/backend doctor 0 errors；v1 回归 9/9；amendment-check 回归 10/10。

## 验证计划

见 `ci_result/ci_summary.md`。
