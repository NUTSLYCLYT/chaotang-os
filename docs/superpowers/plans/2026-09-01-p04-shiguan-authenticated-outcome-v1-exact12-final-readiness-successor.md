# P04 Shiguan Authenticated Outcome V1 Exact12 Final-Readiness Successor Plan

## Status

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Baseline

- Commit：`6c59da0c2fe67d028d025c32b626b6edec70386f`
- Tree：`f23ca4c311dbc15b1a8da3cec1bf3aa57d2d128f`
- Candidate：史馆 API、runtime registry、db/maintenance/models/storage 与六份直接受影响测试，共 exact12。

## Source Of Truth

- Principal：现有 `AuthenticatedPrincipal` 与可撤销 session/membership join。
- Archive：现有 owner-scoped Shiguan `REPLY`。
- Decision：现有不可变 `archive_decisions`。
- Evidence：现有 archive evidence references，只引用摘要，不复制正文。
- Outcome：本包新增的唯一 append-only `OutcomeEvent`；ReviewStatus 继续是可变复盘视图。

## Forward-Only Lineage

前序 exact12 approval `305837522d8711c4d0ea556def3d5319d36f1264` 的 one-child authority 未被 candidate commit 消费，但已终止为 `ABANDONED_BY_OWNER_STANDING_AUTHORIZATION_UNCONSUMED / APPROVAL_SCOPE_CONTRADICTION / REISSUE_REQUIRED / NO_REANCHOR`。从该 approval 到新基线只有 `4b3b2b294...` 三治理文件和 `6c59da0c2...` 两 validator 修改，均与 exact12 零重叠。

Final donor 的十二文件 bundle 为 `sha256:98afb3e6b387fa3ce80afe5d7b741883211056bd674ddbd1a867638a14baba3c`，full-index diff 为 `sha256:7b62a654bd4cc6f6668132568839b518dd7f74c57e21266210432820f1b36ad8`。它只提供 frozen raw/blob/bytes，不提供 candidate、验证、审查、通过或 authority 身份；前序最终审查纠偏及独立 Python/Security implementation review 已关闭 premature `VERIFIED`、coherent digest splice、scope/fork 与 trigger 缺口。

## State And Projection

请求仅含 `outcome/occurred_at/idempotency_key/supersedes_event_id`。`OutcomeEvent` 由服务器绑定 tenant/owner/membership/actor、REPLY、ADOPTED decision、ordered evidence bundle 和唯一时间/digest。事件不可修改或删除；纠正只追加同 scope 当前 head。只读 DTO 只含 opaque ID、closed enum、时间、digest、evidence count 和 supersedes identity，不含任意文本或外部引用。Jiqun、CT-00 和浏览器本轮均不接线。

registry 冻结 current-v7 与 canonical v6 predecessor。操作者必须显式执行 v5→v6、再 v6→v7；两段各自生成并验证 backup。v7 迁移复用既有 typed-content digest，要求 source、backup 与 committed readback 历史内容等价；PENDING 状态、pathname/inode splice、row/type/schema 漂移全部拒绝运行。

## Rematerialization And Verification

1. 三文件治理包先通过 schema、manifest、Task/Harness 和 Governance/Python/Security 三审。
2. approval commit 普通快进后，先在 `/tmp` 非仓库 cwd 以固定 Gitee URL、禁用 global/system Git config、固定 `/usr/bin/ssh -F /dev/null` 并拒绝 local include/includeif、`core.sshcommand`、`url.*.insteadof`，确认实时远端精确为 approval commit；只运行一次 machine authority 后立即重复相同检查。任一不一致或 STOP 均停止。
3. GO 后从 approval commit 创建唯一 clean candidate，将 final donor 十二文件 byte-for-byte 重物化；不允许在本 authority 下继续修改产品字节。
4. 重物化后直接创建唯一 exact12 candidate commit；任一路径、raw/blob/bytes/mode 或 full-index diff 漂移都立即停止并另立 successor。
5. 候选 verifier 从 committed `HEAD:<path>` 复算十二文件 raw/blob/bytes/mode、RFC 8785 bundle 与 full-index diff，要求工作树与 HEAD 一致且 clean；不继承 donor 的 candidate 或验证身份。
6. verification 矩阵首尾重复上述固定远端与 transport 检查，中间运行安全 focused、Shiguan focused、backend-full、exact12 Ruff、Harness/self-test/doctor/doctor tests/hook、authority regression、V2、diff check。
7. 完成 Governance/Python/Security 三审；创建 candidate commit 后运行 machine `--verify-candidate`。只有 PASS 才普通快进，不部署。

## Rollback

未推送时保留隔离 candidate 和 donor；普通快进后只允许 forward-only revert/successor。测试只使用临时 SQLite，不迁移生产数据库。真实 v6 运行库迁移必须在未来 Pilot/Release 独立授权下先验证 backup/restore。

## Follow-up

exact12 落地后再签发 P04 浏览器 Outcome 闭环与 CT-00 Gate E × Jiqun read-only projection。只允许消费脱敏 authenticated Owner assertion，不允许执行、晋级、生产资格或商业成功推断。

## Stop Conditions

远端、base/tree、donor raw/blob/bytes、exact12 路径或模式漂移，machine STOP，第十三路径，新增事实源，验证失败或独立审查 P0–P2，立即停止。
