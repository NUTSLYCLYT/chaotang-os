# 对抗评审：Agentic 工作内核模式采用

日期：2026-07-19

## 裁决

`GO_FOR_CONTROLLED_DECISION_DOC_AT_e69f279 / NO_GO_FOR_RUNTIME / AMENDMENT_REQUIRES_SEPARATE_CHANGE`

## 初审 MUST FIX 与处理

| MUST FIX | 处理 |
| --- | --- |
| 当前主工作树分叉且含未跟踪文档，禁止落稿 | 已改为从产品 PR 精确头 `3c05aae...` 创建独立 stacked worktree；主工作树未修改 |
| Claude Code 开发工具与产品运行时会混淆 | Decision §3 建立双泳道并禁止隐式转换 |
| 权威优先级未冻结 | Decision §0.1 明确产品宪法 > PRD > 获批 amendment > 本 Decision > change/CI |
| M9/M10 被随意扩张 | Decision §6 限定 M9 为 trace/KPI/投影，M10 保持 LangGraph 条件 PoC；WorkBuddy benchmark 独立且无施工权 |
| 六能力蓝图形成第二路线 | Decision §6/§9 将其后续处置限定为 M8/R3+ 输入；当前未修改 dirty 未跟踪资料 |
| amendment 缺 exact-HEAD 现状对账 | Decision §9.1–9.3 将基线交接与逐 M 状态设为正式 amendment 前置；产品 PR 合入后仍须在单独 change 生成 handoff 并逐 M 对账 |
| 模式未绑定 canonical owner | Decision §4–6 逐项映射 `DecisionTask`、route、outbox/events、FinalMemorial、史馆与候选协议 |
| 回滚只写“撤回 ADR” | Decision §5/§9/§10 和 `rollback.md` 增加停接、drain、查单、forward-fix、删除与审计义务 |
| 初稿 S1–S8 形成第二施工 DAG | 已删除 S 编号和执行依赖；Decision §9 只保留无开工权的 future amendment 编制协议，施工仍只使用原 M0–M10 |
| benchmark 依赖不足且可能提前 M10 | Decision §8/§9.6 要求 M1/M2/M4/M5/M6 最小实现；LangGraph 只由原 M10 在 M0–M9 后按原条件触发 |
| `PermissionEnvelope` 可被旧计划或其他 worker 重放 | Decision §5.1 增加计划/输入/执行主体/委托链/action/attempt/target/payload/金额/nonce/次数绑定和服务端原子 CAS 消费 |
| 合法 Provider 仍可能收到越权 payload | Decision §5.3 增加逐请求 payload-level egress envelope、最小化/DLP/digest 和精确 fallback 重新批准 |
| kill switch 无法截住已领取 worker 与迟到 callback | Decision §5.4 增加单调 kill generation/fencing，并在 claim、凭证、pre-action、egress、commit、callback 和完成门复核 |
| 删除会被 backup/restore/replay 复活或忽略 legal hold | Decision §5.2 增加传播状态、下游回执、tombstone/restore filter、备份淘汰、legal hold 和恢复负例 |

## 安全审查结论

- 当前只允许 `PATTERN_DECISION_DOC + SYNTHETIC_BENCHMARK_SPEC`；benchmark 执行仍属运行时 PoC，必须等待
  Decision §8.1 的 M1/M2/M4/M5/M6 前置、独立 change 和新的明确授权。
- Claude Code 不成为产品 runtime；腾讯 WorkBuddy 不得在条款冻结前处理真实数据；开源 `work-buddy` 只作 clean-room 参考。
- 权限、记忆、Provider/egress、canonical writer、六级 kill switch 与许可证任一硬门缺失即 No-Go。

## 原终审结果（历史基线 `3c05aae...`）

| 终审 | 裁决 | 核验重点 |
| --- | --- | --- |
| Security | `GO_AT_3c05aae / STALE_AFTER_BASELINE_CHANGE` | 原子授权消费、payload-level egress、kill generation fencing、删除/backup/legal hold |
| Authority | `GO_AT_3c05aae / STALE_AFTER_BASELINE_CHANGE` | 无第二 S/P/ABS DAG、benchmark/M10 不绕门、Owner 与 future blocker 状态诚实 |
| Blueprint | `GO_AT_3c05aae / STALE_AFTER_BASELINE_CHANGE` | baseline handoff 可机验、逐 M 模块卡自包含、并行/Exit/clean-lineage/回滚完整 |

## 首次 Post-merge 重绑定复审（历史基线 `ef9b597...`）

| 复审 | 裁决 | 核验重点 |
| --- | --- | --- |
| Authority / Blueprint | `ALLOW_AT_ef9b597 / STALE_AFTER_TARGET_DRIFT` | 新旧基线事实、Product R0 与 M0–M10 权威、唯一 DAG、§9.1 双层基线与祖先门 |
| Security | `ALLOW_AT_ef9b597 / STALE_AFTER_TARGET_DRIFT` | 权限、egress/fallback、kill fencing、记忆删除、legal hold、许可证和 canonical writer |
| Git / Evidence | `ALLOW_AT_ef9b597 / STALE_AFTER_TARGET_DRIFT` | `ef9b597...` 双亲/树/祖先、8 文件精确范围、真实 index 为空、dirty 主工作树隔离 |

以上裁决来自 `ef9b597...` 基线，因产品/PRD digest 随 `e69f279...` 漂移而转为历史证据，不能自动继承。

## 提交前目标漂移复审

| 复审 | 裁决 | 核验重点 |
| --- | --- | --- |
| Authority / Blueprint | `ALLOW` | e69 产品/PRD 语义、唯一 M0–M10、六能力 M8/R3+、双层 baseline handoff |
| Security | `ALLOW` | R0/R1 数据入口、PRD §8.2/OQ、动作风险 namespace、权限/egress/kill/记忆/许可证 |
| Git / Evidence | `ALLOW` | e69 直属 ancestry、8 文件范围与哈希、临时/真实 index、dirty 主工作树隔离 |

`ef9b597...` 的旧 GO 没有自动继承；以上裁决来自 `e69f279...` 基线的最新磁盘快照与重跑证据。

## 保留阻塞

产品合入 blocker 已解除：Gitee PR !3 以 `ef9b597...` 正式落到 `feature-chaotang-ext`，其第二父节点为审定来源头 `df632e4...`。目标随后增加产品一致性修复 `e69f279...`，本 Pattern 分支已再次无内容损失地重绑定；旧 `ef9b597...` review 已按协议失效。

当前仍保留：

1. WorkBuddy 准确目标产品与版本未由业主冻结。
2. M0–M10 状态对账和 Owner 批准的正式 amendment 尚未在单独 change 执行。
3. 六能力资料尚在另一个 dirty/diverged lineage，不能在本 change 中顺手吸收。

这些阻塞均已通过文档状态和后续阻塞项显式保留。`e69f279...` 复审已恢复
`ACCEPTED_PATTERN_PRINCIPLES`；该状态只接受模式原则，不授权 benchmark 执行或任何运行时。正式 amendment 只能从单独、干净、获批的 change 开始。
