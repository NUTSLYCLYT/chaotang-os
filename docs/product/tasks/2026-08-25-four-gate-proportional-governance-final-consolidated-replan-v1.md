# Four-Gate Proportional Governance — Final Consolidated Replan V1

> 状态：`DRAFT / NON_AUTHORIZING / CONSOLIDATED_REPLAN / PRODUCT_STOP`
>
> Task ID：`FOUR-GATE-PROPORTIONAL-GOVERNANCE-FINAL-CONSOLIDATED-REPLAN-V1-20260825`
>
> 稳定 lineage：`FOUR-GATE-PROPORTIONAL-GOVERNANCE-FINAL-CONSOLIDATED-REPLAN`
>
> 基线：`origin/ext-dev@dce861a42cf2fb9202415694001c5367cebf10c4`
>
> 基线 tree：`3e3bdcb9e6ebf06656a94644dc1eccd9e8d5e826`

## Status

Draft

Owner 已终止旧 lineage 与首轮 consolidated replan，完成单一写入者协调和 15 分钟冻结，并只授权基于冻结基线编制本 Task、
同名 Plan、Schema 和 Approval 四份 final consolidated replan 草案。当前机器 product authority 与 execution authority 仍须按本
基线重新只读核验；无论状态输出为何，本草案均不授权治理代码、产品代码、
候选、commit、push、merge、pilot、release、deploy 或外部动作。

## Predecessor Termination

旧 lineage `FOUR-GATE-PROPORTIONAL-GOVERNANCE` 已终止为 `STOP_REPLAN_REQUIRED`：

- 旧 Task：`FOUR-GATE-PROPORTIONAL-GOVERNANCE-V1-20260825`；
- 旧草案基线：`18dd90ae9152ee94cfab69dcb56700a6a1586db2` / `e16d837d39da95f462f416f108a05193750ff066`；
- 旧 lineage 已使用唯一一次 re-anchor；
- 第二次漂移：`18dd90ae` → `58b76922`；
- 漂移只新增两份 EXT V2 delta addendum，没有产品字节变化；
- 旧四文件 raw/bytes 已完整登记在同名 Approval 的 `predecessorTermination.draftFiles`，避免未提交草案消失后只剩不可解释的总摘要；
- 旧四文件 raw manifest：`sha256:a0a881757570948d6ce860bc564748b302a20198037c3bf291ce49df64cbb8cf`；
- 旧四文件 bundle：`sha256:911b50d00891b3ec9969b1a13d98f3ad4abf52334ca77373bc09b5b8c702bcc3`；
- 旧草案从未提交或推送，不携带任何执行权进入本 replan。

本 Task 是 Owner 明确批准的 consolidated replan，不是第二次 re-anchor，也不是用连续 successor 链规避上限。它只继承经复审的
安全语义，不继承旧 nonce、过期时间、消费状态、candidate identity 或机器授权。

## Prior Consolidated Replan Termination

首轮 `FOUR-GATE-PROPORTIONAL-GOVERNANCE-CONSOLIDATED-REPLAN-V1-20260825` 已终止为
`STOP_REPLAN_REQUIRED`：

- 基线：`58b769223794af752d3b36ffc83dfa6351b0e0c6` / `d746c28c13612693700d03fe11e1349b3a73cf5f`；
- 触发：实时远端首先移动到 `d1afa4c7b3c34c1f4cf71645d5311bb210f95d54`，随后收敛到本 Task 的冻结基线；
- 该首轮 replan 从未提交或推送，`machineConsumable=false`，不得继承 Authority、nonce、消费记录或 active gate；
- 四份终止草案的 raw/bytes 固定登记于本 Approval 的 `priorReplanTermination.draftFiles`，仅作审计证据；
- 本 final replan 来自 Owner 在识别并暂停唯一并行写入者后的新授权，不是 re-anchor，也不得再次 re-anchor。

## Intervening Baseline Review

`58b76922` 到冻结基线只包含 Packet 01 的三次治理推进：

1. `d1afa4c7…`：新增 Packet 01 battery-safety M0 approval、Task、Plan；
2. `5004733b…`：修改 readiness 测试、Packet 01 Task 与 Root Harness 检查；
3. `dce861a4…`：仅修改 Packet 01 approval、Task、Plan，将范围重签为 exact9。

裁决：三次提交是 `BASELINE_FACT_ONLY / EXCLUDE_FROM_P14_SCOPE / AUTHORITY_NOT_INHERITED`。已暂停并保留的本地产品候选
`e67beabc50ccb338e851053577f963516b9834f7` / tree `9132d10dc83032eeef6ff197ec406fc6e5d6c361` 不在远端基线，不能作为
本 Task 的产品、证据或 Authority 输入，也不得由本 Task 提交或推送。

## EXT V2 Delta Addendum Review

基线 `58b76922` 新增：

1. `docs/migrations/2026-08-25-ext-full-value-convergence-v2-delta-addendum.v1.json`
   - raw：`sha256:ab4c9393c1ce41f813d966d98b102ed82800231be2b521dc91d47f0db9af8b34`
   - bytes：`1411885`
2. `docs/migrations/2026-08-25-ext-full-value-convergence-v2-delta-addendum.v1.md`
   - raw：`sha256:a849f63410e7dc652291658f3942e8c73ff4dac07a8f918c616b0616da2096b8`
   - bytes：`5461`

裁决：两文件只作为 `AUDIT_EVIDENCE_ONLY / EXCLUDE_PRODUCT / NON_AUTHORIZING` 的内容寻址证据。它们维持原 V2 Receipt、894 个新增
观察单元、用户资产 preserve、七组 P14 候选 audit-only、不可用工作树与漂移外部来源 keep-blocked；不能选择 donor、复用候选、
扩大 Packet、激活迁移或证明当前运行事实。

已知历史限制必须保留：Addendum 内部 observation baseline 是 `82ba658d`，并记录
`LOCAL_REMOTE_TRACKING_RECORD_ONLY / networkRemoteRead=NOT_RUN_NOT_AUTHORIZED`；其 rollback 文案仍描述“两份未提交文件”，但现实
提交 `58b76922` 已将两文件纳入历史。该差异不改写原文，不使内容证据失效，但禁止把它当成当前远端状态、实时 inventory 或 Authority。

## Product Definition

建立一个可机器实现、比例适当、不会让治理 parent 漂移反复重放产品字节的四门合同：

1. `G0_DIRECTION`：只确认方向、非目标、风险和停止条件，不授权写入。
2. `G1_CANDIDATE`：用 exact scope envelope 在干净隔离 worktree 形成 pre-commit candidate，不接受候选、不 commit。
3. G1 外一次性 materialization：Owner 精确绑定 pre-commit tree 后，只允许创建本地单亲等树 candidate commit。
4. `G2_PILOT`：冻结 exact candidate/evidence identity，只允许有白名单、预算、停止开关和到期的邀请制试点。
5. `G3_RELEASE`：绑定 G2 identity、candidate-external supervisor、runner pins、完整矩阵与回滚，才可请求后续 push/release/deploy。

四门逐级、deny-by-default。低门不能铸造高门结果；每次 Git、试点或外部动作仍需要各自独立精确授权。

为关闭旧草案的机器合同缺口，未来正式 consumer 还必须满足：

- G1 只接受 exact path、closed command/args/cwd、逐命令和总时限、证据义务与一次性消费状态；目录前缀不能替代精确路径；
- Draft 中未签发的 digest、nonce、时间和 candidate identity 必须为 null；READY/GO 状态必须拒绝 null、全零值和 placeholder；
- G2 identity 必须绑定 G1 approval/consumption digest、candidate commit/tree/parent、base commit/tree、exact paths、raw/bundle
  manifest、patch/evidence、lockfile/toolchain 与总 identity digest；
- G3 必须直接绑定完整 G2 candidate identity、G2 approval digest、supervisor authority result identity 和 release envelope；
- P0、安全、租户、不可逆动作、candidate drift 与事实源不诚实同时阻断 PILOT/RELEASE；offline wheel、external supervisor、
  cgroup watchdog 与正式发行矩阵只阻断 RELEASE。PILOT 只能在明确的非生产受控执行面运行，不得借“邀请制”绕过共同 STOP。

## First Product Packet Binding

首个产品 Packet 固定为已提交的 `P14-PILOT-OWNER-ARTIFACT-ROUNDTRIP-V1`：

- source commit：`18dd90ae9152ee94cfab69dcb56700a6a1586db2`；
- approval raw：`sha256:1dd14d782f609c13a797c7e3538ab590862ebc47a326b7e8b385ca1bc3d7ae82`；
- 三文件 manifest：`sha256:bc29969402562a0d343ef08e12b6a9872dfb5644ca6da3eb151b29a9f7816b2a`；
- 三文件 bundle：`sha256:81b61ded480feea9f6fcd7e12f673c01de4f1a2907f003d9cb2178f83a884caa`；
- scope：exact 26 paths、恰好三条允许 ADD、最多 524288 candidate blob bytes；
- 数据和网络：固定 `127.0.0.1:8000` / `127.0.0.1:3002` loopback，无 DNS、无公网、无生产数据或 secret；
- 用户结果：同 owner 展示/下载/确认/退回/刷新，cross-owner 统一拒绝，成果/确认/归档/现实执行四轴分离，史馆精确 REPLY 回写。

本 replan 只绑定该 Packet 的已提交非授权提案，不复制第二套范围源。未来 fresh G1 必须在当时规范基线重新签发 exact scope、可信时间、
nonce、closed command/cwd 和 evidence obligations；本草案不能原地晋升。`PACK_HERO_TASK` 仍是该 Packet 非目标，必须另立独立 Task 与
G0–G2，不能复用 P14 G2。

## Materialization Contract

G1 只冻结 `preCommitTree`、exact paths、patch 与 evidence。独立 one-shot grant 的 issuance inputs 必须包括：lineage、G1 approval/
consumption digest、base commit/tree、pre-commit tree、exact paths/patch/evidence digest、nonce、issuedAt 和 expiresAt。
`grantIdentityDigest` 是这些 inputs 的 RFC 8785 JCS + SHA-256 输出，排除输出字段自身。

消费记录单独绑定 grant identity、candidate commit/tree 与 consumedAt；`consumptionDigest` 同样使用 RFC 8785 JCS + SHA-256 并排除
自身。唯一允许动作是 `LOCAL_SINGLE_PARENT_COMMIT_EXACT_TREE_ONLY`，其他动作 deny-by-default。grant 不能跨 Packet 重用，也不授权
push、merge、pilot、release 或 deploy。

## Compatibility And Time

- 新 four-gate consumer 首先只能 `SHADOW_ONLY`。
- 有效决定固定为 `DENY_OVERRIDES(legacyAuthority, fourGateAuthority)`；`legacy STOP + new GO = STOP`。
- 切换 consumer 需要独立 signed migration manifest，绑定 legacy task/STOP reason、新 gate identity、Owner digest 与 exact switch point。
- 24 小时 evidence cadence 使用可信 authority UTC clock、单调 event sequence、evidence kind 与 digest；重复 digest 不刷新时钟。
- 本 final consolidated replan 不允许 re-anchor。若 `origin/ext-dev` 离开 `dce861a4`，立即
  `STOP / REPLAN_REQUIRED`，不得继续修改草案。

## Affected Modules

- 模块：根级四门比例治理 consolidated replan 合同、predecessor 终止记录、EXT V2 Addendum 审计边界与 P14 Packet 引用合同。
- 允许路径：严格限于下列 `## Allowed Paths` 中四条新草案路径；当前不授权修改其他文件。
- 依赖模块：只读依赖 committed EXT V2 Addendum、已提交 P14 Packet、旧 predecessor 四文件摘要、Root Harness 与机器 Authority。

本阶段不修改任何运行模块、Authority、Harness、前端、后端、部署、数据库或业务事实源。

## Allowed Paths

当前只允许新增以下四条草案路径：

- `docs/product/tasks/2026-08-25-four-gate-proportional-governance-final-consolidated-replan-v1.md`
- `docs/superpowers/plans/2026-08-25-four-gate-proportional-governance-final-consolidated-replan-v1.md`
- `docs/migrations/2026-08-25-four-gate-proportional-governance-final-consolidated-replan-v1.schema.draft.json`
- `docs/migrations/2026-08-25-four-gate-proportional-governance-final-consolidated-replan-v1.approval.draft.json`

不得修改 predecessor 草案、两份 committed Addendum、P14 Packet、Authority、Harness 或产品代码。

## Delivery Constraints

- 只允许当前四份未提交草案、只读检查、治理验证和独立复审。
- 不得提交、推送、合并、试点、发布、部署或执行外部动作。
- 不得在机器 `STOP` 下修改治理代码或产品代码。
- 不得修改 predecessor、committed Addendum、P14 Packet 或用户 dirty worktree。
- 基线离开 `dce861a4` 时立即停止，不允许 re-anchor。

## Non-Goals

- 不实现或激活 four-gate consumer。
- 不执行 G1/G2/G3，不创建或接受候选。
- 不选择或复用 Addendum 内七组 P14 audit cluster。
- 不修改用户 dirty worktree、donor 或外部来源。
- 不激活 PACK、LangGraph、Jiqun 新控制面或新业务事实源。
- 不 commit、push、merge、pilot、release、deploy 或执行外部动作。

## Acceptance Criteria

- [ ] 四文件一致绑定 `dce861a4` / `3e3bdcb9`，且 base drift policy 为 no-reanchor fail-closed。
- [ ] predecessor 精确终止，旧 manifest/bundle 只作审计，不继承 Authority。
- [ ] 首轮 replan 终止、Addendum 两文件 raw/bytes、历史限制与 `AUDIT_EVIDENCE_ONLY` 裁决可机械验证。
- [ ] Packet 01 三次 intervening commit 与未推送 `e67beabc` 候选均被隔离，不能扩大 P14 或继承 Authority。
- [ ] P14 raw/manifest/bundle 与 exact 26/3 ADD/524288 scope 可从 Git blob 独立重算。
- [ ] Draft 强制 `machineConsumable=false / authorityImplemented=false / activation=STOP`，所有 active gate 与 fresh issuance 字段为空。
- [ ] G1 materialization、G2 candidate、G3 release、legacy deny-overrides 与 cadence 均为 closed contract。
- [ ] Schema/meta/self-validation、duplicate-key、closed-object 和关键负向测试通过。
- [ ] 每个未跟踪文件逐文件 whitespace check、Root Harness 与 Doctor 通过。
- [ ] 独立复审无未关闭 P0–P2。

## Technical Plan

1. 冻结 `dce861a4`、两级 predecessor 终止证据、Addendum raw bytes、Packet 01 intervening facts 与 P14 Packet 摘要。
2. 建立 closed draft Schema 与 non-authorizing Approval，自校验并运行关键负向测试。
3. 运行逐文件 whitespace、Root Harness、Doctor 与 Authority 状态检查。
4. 独立复审关闭 P0–P2；远端仍未移动后计算四文件 raw/manifest/bundle。
5. 只有 Owner 另行精确授权，才可创建本地治理提交；本 Task 不包含该动作。

## Implementation Report

已在绑定 `dce861a4` 的干净隔离 worktree 创建四份 final consolidated replan 草案。只读审查确认 Addendum 为历史审计证据，不能作为
产品、实时状态或 Authority；旧 lineage 保持终止。未修改任何代码、committed 文件或用户工作树，未提交或推送。

## Acceptance Review

Pending。必须在 Schema、负向测试、Harness、Authority 状态、独立复审和最终远端回读全部完成后，才可生成四文件精确摘要供
Owner 决定；此状态仍不授予任何执行权。

## Delivery And Rollback

当前只生成四份未提交草案和精确摘要。放弃时仅放弃这四份新草案；不得删除用户文件、旧 predecessor 证据或 committed Addendum。
