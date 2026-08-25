# Four-Gate Proportional Governance — Final Consolidated Replan V1 Plan

> 状态：`DRAFT / NON_AUTHORIZING / PRODUCT_STOP`
>
> Task：`FOUR-GATE-PROPORTIONAL-GOVERNANCE-FINAL-CONSOLIDATED-REPLAN-V1-20260825`
>
> 当前授权：基于冻结的 `dce861a4` 基线创建四份 final replan 草案、治理检查和独立复审。

## Phase 0 — Freeze And Terminate

1. 只读确认 `origin/ext-dev@dce861a42cf2fb9202415694001c5367cebf10c4` / `3e3bdcb9e6ebf06656a94644dc1eccd9e8d5e826`。
2. 将旧 `FOUR-GATE-PROPORTIONAL-GOVERNANCE` lineage 固定为 `STOP_REPLAN_REQUIRED`，记录其已用一次 re-anchor、旧四文件
   manifest `a0a881…`、bundle `911b50…`，不得再修改或提交旧草案。
3. 固定第二次 drift 只有两份 committed Addendum，无产品字节变化；本 replan 不继承旧授权。
4. 固定首轮 consolidated replan 因远端移动到 `d1afa4c7` 而终止，四份未提交草案只作审计。
5. 固定 `d1afa4c7 → 5004733b → dce861a4` 为 Packet 01 intervening baseline facts，全部排除出 P14 scope。
6. 固定本地 `e67beabc` 候选为未推送、非基线、非 P14 输入；本 Task 不得消费或推送。
7. 本 final replan 不允许 re-anchor；远端再次移动即停止。

## Phase 1 — Addendum Audit

1. 验证 JSON raw `ab4c9393…`、Markdown raw `a849f634…`、大小和 commit/tree 路径。
2. 保留其 `DRAFT_NON_AUTHORIZING / STOP / EXCLUDE_PRODUCT`、894 units、七组 P14 audit-only、用户资产 preserve 与外部来源 keep-blocked。
3. 记录历史限制：内部观察基线 `82ba658d`、remote read 未运行、rollback 文案与当前 committed 现实不一致。
4. 禁止把 Addendum 用作当前远端、产品候选、donor selection、Packet scope 或 Authority 事实源。

## Phase 2 — Consolidated Draft Contract

1. 新建 Task、Plan、Schema、Approval 四份独立草案；不修改旧草案或 committed 文件。
2. Schema 只验证 `DRAFT_NON_AUTHORIZING` replan proposal，不能被正式 consumer 接受。
3. Approval 强制 `machineConsumable=false`、`authorityImplemented=false`、`activation=STOP`、active gate null。
4. 固定 no-reanchor base drift、两级 predecessor termination、Addendum audit classification、Packet 01 隔离、P14 exact
   binding 和四门 invariant。
5. 固定 RFC 8785 JCS、raw manifest、path-NUL-content-NUL bundle 与 grant/consumption digest 算法。
6. 固定 G1 exact-path/closed-command、Draft/Ready 分型、G2 完整 identity、G3 直接绑定、PILOT/RELEASE 共同 STOP 与独立 blocker。

## Phase 3 — Future Authority Work Package（未授权）

只有本四文件先获 Owner 精确摘要确认、独立本地治理提交授权并另行推送后，才可草拟最小 Authority/Harness 实现包。实现包必须：

- 使用独立 exact paths，不能修改产品代码；
- 新 consumer 先 shadow-only；
- legacy/new deny-overrides；
- 完成 draft rejection、gate order、nonce replay、scope escape、materialization reuse、second drift 与 cadence replay 负向测试；
- 获得适用机器 Governance GO 后才写治理代码。

## Phase 4 — Future P14 G1（未授权）

1. 读取已提交 P14 approval blob 并验证 raw/manifest/bundle。
2. 从 `/g1Proposal/scopeEnvelope` 获取 exact 26 paths、三条 ADD 与 524288-byte 上限，不复制第二范围源。
3. 在 future fresh formal schema 下重新签发 base、nonce、issued/expiry、command/cwd 和证据义务。
4. RED → 最小 GREEN → 测试/构建/浏览器/owner负例 → 冻结 preCommitTree；G1 不 commit。
5. 本地 candidate commit 只能由独立 one-shot materialization grant 物化；其他动作保持 STOP。

## Phase 5 — Future G2/G3（未授权）

- G2：冻结完整 candidate identity、来源诚实、owner isolation、四轴状态、史馆 REPLY、费用/停止/到期和回滚，再请求邀请制试点。
- G3：绑定同一 G2 identity、candidate-external supervisor、runner pins、完整 release matrix 与回滚演练，再请求独立 push/release/deploy 授权。
- `PACK_HERO_TASK` 不属于本 P14；未来必须独立 Task 与 G0–G2。

## Validation Plan

草案阶段：

1. JSON strict parse 与 duplicate-key rejection。
2. Draft Schema meta-validation 和 Approval self-validation。
3. 所有 object `additionalProperties=false`，required 与 properties 完整一致。
4. 负向测试：machineConsumable/activation、active gate、base drift、predecessor state、Addendum classification、P14 scope、grant self-binding、
   cross-Packet reuse、legacy override、cadence duplicate refresh。
5. 对四个未跟踪文件逐一运行 `git diff --no-index --check /dev/null <file>` 或等价检查。
6. Root Harness、Doctor、Product/Execution Authority 状态。
7. 独立架构/安全复审。
8. 远端仍为 `dce861a4` 后，计算四文件 raw、sorted manifest 与 path-NUL-content-NUL bundle。

实现阶段（未授权）：authority 单元/负向测试、Harness change record、shadow migration、P14 G1/G2 浏览器与真实后端链。

## Stop Conditions

- `origin/ext-dev` 离开 `dce861a4`；
- Packet 01 或任何其他任务恢复写入、提交、authority 消费或推送；
- 任何机器 Authority 为 STOP 时请求写代码；
- 新草案试图修改或重开旧 V2 Receipt/894 units；
- Addendum 被用来选择 donor 或 P14 候选；
- P14 scope 不再等于 26 paths/3 ADD/524288 bytes；
- 需要 commit、push、merge、pilot、release、deploy 或外部动作；
- 独立复审存在未关闭 P0–P2。

## Rollback

本阶段只放弃四个未提交 final replan 草案。保留两级 predecessor 审计摘要、committed Addendum、Packet 01、P14 Packet 和
用户工作树原状。
