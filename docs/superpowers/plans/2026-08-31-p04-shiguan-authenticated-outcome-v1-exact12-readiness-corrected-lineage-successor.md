# P04 Shiguan Authenticated Outcome V1 Exact12 Readiness-Corrected Lineage Successor Plan

## Status

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Baseline

- Commit：`293fe5d884152918686637cbb4bb6cd6b1fa29d7`
- Tree：`0fed6e1e2b14de33d3737fd87de482bb141b5eca`
- Candidate：史馆 API、runtime registry、db/maintenance/models/storage 与六份直接受影响测试，共 exact12。

## Source Of Truth

- Principal：现有 `AuthenticatedPrincipal` 与可撤销 session/membership join。
- Archive：现有 owner-scoped Shiguan `REPLY`。
- Decision：现有不可变 `archive_decisions`。
- Evidence：现有 archive evidence references，只引用摘要，不复制正文。
- Outcome：本包新增的唯一 append-only `OutcomeEvent`；ReviewStatus 继续是可变复盘视图。

## Forward-Only Lineage

旧 exact12 approval `121c1fa97939584306771094f3a4b5f0198c1f9c` 的 one-child authority 未被 candidate commit 消费，但已终止为 `ABANDONED_BY_OWNER_STANDING_AUTHORIZATION_UNCONSUMED / REISSUE_REQUIRED / NO_REANCHOR`。从该 approval 到新基线只有 `bcfe6f57...` 三治理文件和 `293fe5d88...` 两 validator 修改，均与 exact12 零重叠。

Corrected donor 的十二文件 bundle 为 `sha256:7ee08b8a336c9fa957bc39027324844e5a0534d4e63400ad4e51804eb08499a9`，full-index diff 为 `sha256:ed63cf5cac3de60f30f829ae0e3863b1684c3c0a0d4b8dc35959273a60c6a46f`。它只提供 starting raw/blob/bytes，不提供 candidate、验证、审查、通过或 authority 身份；独立 Python Review 已确认其 `VERIFIED` promotion 顺序与直接负测仍需纠偏。

## State And Projection

请求仅含 `outcome/occurred_at/idempotency_key/supersedes_event_id`。`OutcomeEvent` 由服务器绑定 tenant/owner/membership/actor、REPLY、ADOPTED decision、ordered evidence bundle 和唯一时间/digest。事件不可修改或删除；纠正只追加同 scope 当前 head。只读 DTO 只含 opaque ID、closed enum、时间、digest、evidence count 和 supersedes identity，不含任意文本或外部引用。Jiqun、CT-00 和浏览器本轮均不接线。

registry 冻结 current-v7 与 canonical v6 predecessor。操作者必须显式执行 v5→v6、再 v6→v7；两段各自生成并验证 backup。v7 迁移复用既有 typed-content digest，要求 source、backup 与 committed readback 历史内容等价；PENDING 状态、pathname/inode splice、row/type/schema 漂移全部拒绝运行。

## Rematerialization And Verification

1. 三文件治理包先通过 schema、manifest、Task/Harness 和 Governance/Python/Security 三审。
2. approval commit 普通快进后只运行一次 machine authority；STOP 即停止。
3. GO 后从 approval commit 创建唯一 clean candidate，将 corrected donor 十二文件 byte-for-byte 重物化，先补 direct negative tests，证明 premature `VERIFIED`、digest/idempotency splice、supersede/fork 与 trigger 双向缺口的真实 RED。
4. 只允许四条 review-corrective 路径改变 donor bytes；八条无关路径保持 donor identity。修复必须在 held PENDING inode 上完成全部可能失败检查，再以最后持久动作 promotion 为 VERIFIED。
5. 候选 verifier从 committed `HEAD:<path>` 复算十二文件 raw/blob/bytes/mode 与新 RFC 8785 bundle，要求工作树与 HEAD 一致且 clean；不继承 donor bundle/diff 为最终身份。
6. 运行安全 focused、Shiguan focused、backend-full、exact12 Ruff、Harness/self-test/doctor/doctor tests/hook、authority regression、V2、diff check。
7. 完成 Governance/Python/Security 三审；创建 candidate commit 后运行 machine `--verify-candidate`。只有 PASS 才普通快进，不部署。

## Rollback

未推送时保留隔离 candidate 和 donor；普通快进后只允许 forward-only revert/successor。测试只使用临时 SQLite，不迁移生产数据库。真实 v6 运行库迁移必须在未来 Pilot/Release 独立授权下先验证 backup/restore。

## Follow-up

exact12 落地后再签发 P04 浏览器 Outcome 闭环与 CT-00 Gate E × Jiqun read-only projection。只允许消费脱敏 authenticated Owner assertion，不允许执行、晋级、生产资格或商业成功推断。

## Stop Conditions

远端、base/tree、donor raw/blob/bytes、exact12 路径或模式漂移，machine STOP，第十三路径，新增事实源，验证失败或独立审查 P0–P2，立即停止。
