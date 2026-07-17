# P5 系列收敛情报（Claude reviewer，2026-07-17 08:5x 实测）

> 用途：Codex 收敛 P5 相关分支合 ext 前的地雷图。**不要 git 顺链盲合**——
> 真冲突在 flow_store/tenant/main + 测试基建（详见下节 v2 更正），需人工三方合并。
> （初版标题曾称"schema_adoption 方向相反、15 处冲突"，已判定为用错命令的
> 误判，作废——见冲突事实 v2 节。）

## 分支现状（相对 ext HEAD 346dc81 = P5 核心已合入点）

| 分支 | tip | 审查状态 |
| --- | --- | --- |
| task/p5-alembic-single-authority | 65f5084 | 未单独审（P5 合入后加固段） |
| task/p5-1-alembic-review-hardening | 8ae79eb | **已 GO**（review-v2，5e3f99d；含 CHECK/default 修复） |
| task/p6-orphan-retirement | bbb1000 | 含 P5.1 旧带病版（64a2369）；P6 内容未审 |
| candidate/p5-1 | bbb1000 | 同上 |

> schema_adoption.py 的分支间改动 merge-tree 实测**零冲突**（此前表内引用的
> "-216/+449"是各自相对 346dc81 的独立 stat，非互相冲突，已从表中移除以免误读）。

## 冲突事实（v2 更正——初版用错命令，结论作废）

> ⚠️ 初版用旧三参 `merge-tree A B C` 把**全文快照差异**误读成冲突，错误断言
> "schema_adoption.py 15 处冲突、两方向相反"。经 stop-review 指出，用
> `git merge-tree --write-tree 65f5084 8ae79eb`（git 2.53）重测：

**真实冲突文件（实测）**：`backend/src/db/flow_store.py`、`backend/src/tenant.py`、
`backend/web/main.py`、多个 test（conftest/auth_invite/decree_event_ledger/
schema_authority 等）、`fix-alembic-single-authority-20260717/` change 文档（add/add）。

**`schema_adoption.py` 实际零冲突**——两分支对该文件的改动 merge-tree 未报冲突
（此前的"216 删 vs 449 加"是各自相对 346dc81 的独立 stat，不代表互相冲突）。

含义修正：两条分支的真实重叠在 **flow_store/tenant/main + 测试基建**，不在
schema_adoption。收敛冲突面比初版判断的更广但性质不同——是并行加固碰同一批
基础设施文件，需人工三方合并，不是 schema_adoption 的路线之争。

## 收敛建议（Codex 执行决策，此处仅情报+推荐）

1. **P5.1（8ae79eb）是已审权威**（CHECK/default 缺陷已修+负例）；
   schema_adoption 两分支不冲突，可正常合。真正需人工三方合并的是
   flow_store/tenant/main + 测试基建那批 add/add 与 content 冲突——
   收敛前逐个核对哪方版本正确，不能 git 顺链自动解。
2. **P6 必须先 rebase 到 8ae79eb**（丢弃 bbb1000 带病 merge），不是合 65f5084。
3. 收敛顺序建议：确定 schema_adoption 权威版（P5.1）→ P6 rebase 到它 →
   65f5084 的**非 schema_adoption 改动**（若有独立价值）单独择合 → 顺链合 ext，
   每步走 D6 闸。
4. 收敛后必跑：adoption 全套（含两条 CHECK/default 负例）+ 迁移三起点 +
   真库副本演练不变量——防合并过程重新引入已修缺陷。

## 未审提醒

65f5084 的 P5 加固段**从未单独审查**——若最终采纳其任何改动，
需补审；若整体放弃，在收敛记录注明。P6 实质内容（死码退役）也未审，
rebase 后需正式审查。
