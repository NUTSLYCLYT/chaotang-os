# 变更摘要：chore-ext-99-branch-convergence-k0-20260803

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | chore-ext-99-branch-convergence-k0-20260803 |
| 类型 | chore |
| 状态 | IMPLEMENTED_LOCAL / REMEDIATED_AFTER_ROUND3_NO_GO / REREVIEW_PENDING |
| Owner | Codex / Root Harness |
| 创建日期 | 20260803 |

## 范围

- 主线：在当前 `R0-W08` docs/governance authority 内，为审计得到的 99 个未合入本地分支建立只读、机器可验证的能力融合台账。
- 文件：新增 convergence schema、manifest、CLI、Node 测试和 wiki；登记到 project harness；更新资产清算总账、Harness 清单、验证矩阵和实施计划。
- 验证：专项 Node 测试、三种只读 CLI 模式、root Harness doctor、authority v1/v2、`git diff --check`。

## 权威边界

- 本变更不执行 merge、cherry-pick、ref 更新、分支删除、产品代码修改、Runtime、数据库、push 或 deploy。
- `ABSORB_ADAPT` 与 `REBUILD` 只是处置意图；对应功能仍必须取得独立 machine-readable work-package GO。
- 唯一 integration target 保持 `feature-chaotang-ext`；本候选位于隔离分支 `task/ext-99-branch-ledger-20260803`。
- 隔离 exact-H 按既有 W08 authority 必须返回 `active-packet EXT ref must equal pinned HEAD`；最小顺序修订已由用户批准并记录于 `request_analysis/scope-amendment-01.md`，但不授权集成。
