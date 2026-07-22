# CI 摘要：docs-r0-w02-closeout-reconcile-20260722-20260722

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W02` | 2 | `STOP/NO_ACTIVE_WORK_PACKAGE` | 已收口的包不再自动 GO | 2026-07-22 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W03` | 2 | `STOP/NO_ACTIVE_WORK_PACKAGE` | 未获批的下一包不会被误判成"排队中" | 同上 |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | 27 passed（含 2 项新增） | v2 全量回归 | 同上 |
| `node --test scripts/r0-amendment-check.nodetest.mjs` | 0 | 10 passed | governance 零回归 | 同上 |
| `node --test scripts/execution-authority.nodetest.mjs` | 0 | 9 passed | v1 零回归 | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors，静默收口断言输出确认 | 全仓 doctor | 同上 |

## 结果

工作区异常改动溯源到未合并分支 `docs/r0-w01-closeout-20260721`（Codex 生成，从未走完独立审查
和 hosted PR）；核实其试图阻止的状态（W02 未激活）已被现实推翻——W02 已合法 merge 进
`feature-chaotang-ext`。丢弃异常改动后，从正确基线推进到真实状态（W02 MERGED_AND_VERIFIED，
静默收口），同时吸收该分支的治理原则（收口≠下一包获批）并通用化实现，未来 W03 收口时
doctor/nodetest 不需要重写。

## 未验证项

- `docs/r0-w01-closeout-20260721` 分支本身是否要归档/删除——留给用户决定，本变更未处理
- R0-W03 的正式批准与开工——不在本次范围

## Diff 与回滚复核

- changed files：`.harness/manifest/execution-authority.v2.json`、`scripts/harness-doctor.mjs`、
  `scripts/execution-authority-v2.nodetest.mjs`、`.harness/wiki/execution-authority-v2.md`
- diff review：单人会话内自查；未改动 `scripts/lib/execution-authority-v2.mjs` 核心 resolver 逻辑，
  只改了消费方（doctor/test）如何解读同一套判定结果
- 回滚是否演练：未演练；`git revert` 即可恢复到 W02 ACTIVE 态，resolver fail-closed 边界不受影响

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 工作区异常改动来源 100% 确认 | blob hash 精确匹配 commit `38fe3068` | 已满足 |
| ledger 反映 W02 真实合并状态 | `--authorize` 命令表 | 已满足 |
| doctor/test 通用化，不再硬编码包名 | `harness-doctor.mjs`/`nodetest.mjs` diff | 已满足 |
| 27/27 nodetest + 46 项跨脚本回归全绿 | 命令表 | 已满足 |

## 声明状态

- `VERIFIED_COMPLETE`（工作区异常已处理，ledger 已对齐真实状态，doctor/test 已通用化）；
  closeout 分支归档、R0-W03 正式批准均为明确排除在外的后续事项。
