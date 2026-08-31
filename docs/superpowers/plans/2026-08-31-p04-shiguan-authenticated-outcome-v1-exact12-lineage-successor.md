# P04 Shiguan Authenticated Outcome V1 Exact12 Lineage Successor Plan

## Status

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Baseline

- Commit：`7021bf71019dec57c95aa58bb5a389a66bd0ffdf`
- Tree：`b53c6323f48f1a37aaac09e132e0b9881654ee11`
- Candidate：现有史馆 API、runtime registry、db/maintenance/models/storage 与六份直接受影响测试，共 exact12。

## Source Of Truth

- Principal：现有 `AuthenticatedPrincipal` 与可撤销 session/membership join。
- Archive：现有 owner-scoped Shiguan `REPLY`。
- Decision：现有不可变 `archive_decisions`。
- Evidence：现有 archive evidence references，只引用摘要，不复制正文。
- Outcome：本包新增的唯一 append-only `OutcomeEvent`；ReviewStatus 继续是可变复盘视图。

## Forward-Only Lineage

旧 approval `a8d631210372924cbe96a348050d20c10a756584` 到新基线只有 `13eca839...` 与 `7021bf710...` 两个直接单亲提交，changed paths 仅为三份 readiness 治理文件和两个 validators，与 exact12 零重叠。旧 approval/authority/candidate/verification 全部终止；旧工作树只作为 raw/blob/bytes 起点 donor。Donor exact12 bundle 固定为 `sha256:fffb8a4734a0c879fc9ca42bfad52abf6127793a9b332ddadf1b097407dd8d8a`，历史 full-index diff 固定为 `sha256:80c750a5b0e592840f38bd6e0b882fee48a016614bad4405bb64c97763de47a4`，但安全审查已证明最终 candidate 必须改变六条 corrective 路径，因此旧摘要不得成为最终身份。

## State And Projection

请求仅含 `outcome/occurred_at/idempotency_key/supersedes_event_id`。`OutcomeEvent` 由服务器绑定 tenant/owner/membership/actor、REPLY、ADOPTED decision、ordered evidence bundle 和唯一时间/digest。事件不可修改或删除；纠正只追加同 scope 当前 head。只读 DTO 只含 opaque ID、closed enum、时间、digest、evidence count 和 supersedes identity，不含任意文本或外部引用。Jiqun、CT-00 和浏览器本轮均不接线。

registry 冻结 current-v7 与 canonical v6 predecessor。操作者必须显式执行 v5→v6、再 v6→v7；两段各自生成并验证 backup。v7 迁移复用既有 typed-content digest，要求 source、backup 与 committed readback 历史内容等价；PENDING 状态、pathname/inode splice、row/type/schema 漂移全部拒绝运行。

## RED To GREEN

1. 在 fresh 基线先运行新增 exact12 测试形成真实 RED；不得继承 donor 测试结果。
2. RED 覆盖可变 ReviewStatus 冒充 Outcome、身份夹带、membership race、非 REPLY/ADOPTED/evidence、同形 404、时间/key/cursor 越界、幂等与 snapshot splice、head correction、SQL mutation、projection 泄漏和迁移/backup/readback splice。
3. 机器 GO 后先重物化 donor，再在 exact12 内形成 session revocation 写读事务复核与 v7 final-inspection pathname replacement 的真实 RED→GREEN。
4. 六条 corrective 路径必须不同于 donor blob；runtime registry、db、models、daily scheduler、readiness、adopted-evidence 六条无关路径必须保持 donor blob。
5. GREEN 后运行 focused、backend-full、Ruff、Harness/Doctor/Doctor tests/hook/authority/V2、diff check 和 Governance/Python/Security 三审。
6. 候选 verifier 复算 donor objects/bundle，校验六条 unchanged 与六条 corrective disposition，并要求 clean worktree；最终 candidate 另行冻结新的 raw/blob/bytes/bundle/full-index diff。
7. machine verify-candidate PASS 后才允许普通 fast-forward；禁止 force、merge、rebase 和部署。

## Verification

- focused：Shiguan storage/migration/API、readiness、adopted-evidence、daily scheduler、SQLite backup。
- full：`TMPDIR/TEMP/TMP=/tmp` backend-full 与 exact12 Ruff。
- governance：Harness、self-test、doctor、doctor tests、hook self-test、`TMPDIR=/tmp` authority regression、V2、diff check。
- independent：Governance、Python、Security；任一 P0–P2 为 NO-GO。

## Rollback

未推送时保留或丢弃隔离 candidate，不改变 donor；普通快进后只允许 forward-only revert/successor。测试只使用临时 SQLite，不迁移生产数据库、不部署。未来真实 v6 运行库迁移必须在 Pilot/Release 独立授权下执行并先验证 backup/restore。

## Follow-up

exact12 落地后再签发 P04 浏览器 Outcome 闭环与 CT-00 Gate E × Jiqun read-only projection。只允许消费脱敏 authenticated Owner assertion，不允许执行、晋级、生产资格或商业成功推断。

## Stop Conditions

远端、base/tree、donor raw/blob/bytes、exact12 路径或模式漂移，machine STOP，第十三路径，新增事实源，验证失败或独立审查 P0–P2，立即停止。
