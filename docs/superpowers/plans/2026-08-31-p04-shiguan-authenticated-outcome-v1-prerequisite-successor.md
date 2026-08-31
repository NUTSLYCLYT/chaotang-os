# P04 Shiguan Authenticated Outcome V1 Prerequisite Successor Plan

## Status

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Baseline

- Commit：`b86f4e32a29d03c833eba5221c91f53a83ca6e26`
- Tree：`35570b1c5e3f79ba31cdf4d7736b74cdb61e056d`
- Candidate：现有史馆 API、runtime registry、db/maintenance/models/storage 与六份直接受影响测试，共 exact12。

## Source Of Truth

- Principal：`AuthenticatedPrincipal`，由可撤销 bearer session 和 membership join 派生。
- Archive：现有 owner-scoped Shiguan `REPLY`。
- Decision：现有不可变 `archive_decisions`。
- Evidence：现有 archive evidence references，仅引用和摘要，不复制正文。
- Outcome：本任务新增的单一 append-only `OutcomeEvent`；ReviewStatus 继续只是可变复盘视图。生产 source 固定为 `OWNER_ATTESTATION / AUTHENTICATED_OWNER_ASSERTION`，只证明认证 Owner 陈述，不证明独立核验。

## State And Projection

Outcome event kind 只能由服务器派生为 `RECORDED` 或 `CORRECTED`；业务 outcome 仅为 `ACHIEVED | PARTIAL | NOT_ACHIEVED | OBSERVING`。不得 update/delete；纠正只能追加同 scope 当前 head，`UNIQUE(supersedes_event_id)`，并发 `BEGIN IMMEDIATE` CAS 只允许一个赢家。

请求仅含 `outcome/occurred_at/idempotency_key/supersedes_event_id`。key 为 8..128 ASCII closed pattern；时间归一化为唯一 UTC。事务内重新验证 active PERSONAL/OWNER membership，并读取同 Owner 的 REPLY、ADOPTED decision 与至少一条 ordered evidence reference。只读投影是独立 closed DTO，只含 opaque ID、closed enum、受界时间、digest 和 evidence count，不含任意 label/text/value、身份字段、档案、客户、prompt、URL、path 或 evidence 正文。两个 GET 都采用 1..100 limit、稳定排序和 bounded opaque cursor。Jiqun 和 CT-00 本轮均不接线。

registry 同时冻结 current-v7 与只迁移可用的 `SHIGUAN_V6_PREDECESSOR`。旧 `--migrate-v5-to-v6` 保持字面语义，产生 verified-v6 intermediate 但在 current-v7 registry 下 `ready=false`；不得自动继续。操作者随后显式运行新增 `--migrate-v6-to-v7`，再生成独立 `.v6-backup`。v7 迁移前按稳定 PK/列序冻结全部既有表 row count + typed-content digest；该摘要必须精确复用现有 `db._content_digest_value` 的类型标签、字节长度与原始 bytes framing，以及 `db._legacy_content_snapshot` 的稳定表/列/行顺序。source-before、verified backup 与 committed-v7 readback 必须等价。事务内失败回滚；提交后 same-inode/content readback 失败则保留 backup 和 `PENDING_VERIFICATION` v7，readiness/backup/open 全部拒绝。验证通过才转 `VERIFIED`。v7 同时为 archive_decisions 与 OutcomeEvent 安装 UPDATE/DELETE 拒绝 trigger。

## RED To GREEN

1. RED：当前只有 overwrite ReviewStatus，没有 append-only authenticated Outcome；当前 v6 registry/maintenance 也不认识 v7。
2. RED：missing/cross-scope 响应逐字节同形；身份夹带、事务中 membership 撤销、非 REPLY/非 ADOPTED/零 evidence、时间/key/page 越界、source laundering、current snapshot/event digest splice、幂等重试前 snapshot 漂移、纠正目标 head snapshot 漂移、幂等冲突、self/fork supersede、UPDATE/DELETE 和富对象泄漏必须失败；重试与纠正漂移均固定 503、零事件字段或零写入。
3. RED：canonical v6 之外的 predecessor、路径替换、symlink/hardlink、schema/manifest/row/type/backup splice、post-commit readback 故障均失败关闭并保留受保护 backup。
4. GREEN：canonical v7 registry、受治理 v6→v7、不可变 decision/event、同 scope 幂等、head-only correction、closed redacted read model。
5. GREEN：测试 spy 证明授权失败发生在事件写入前，且无网络、模型、工具、worker 或其他业务写。

RED 节点与首次失败输出只作为本轮开发证据，不是可继承 identity；最终机器验收以候选提交内负向测试、完整矩阵、verify-candidate 和独立审查为准，不伪称 approval 能自动在 parent 重放新增测试。

## Verification

- focused：Shiguan storage/migration/API、readiness、adopted-evidence、daily scheduler 与 SQLite backup tests。
- full：backend-full 与 exact12 Ruff。
- governance：Harness、self-test、doctor、TMPDIR=/tmp authority regression、V2、diff check。
- independent：Governance、Python、Security，任一 P0-P2 停止；审查必须核对三个兼容测试文件只做 v6→v7 期望升级和约束增强，禁止删除/skip/xfail/放宽既有断言。

## Rollback

未推送时丢弃隔离 candidate；普通快进后仅允许 forward-only revert/successor。测试仅使用临时 SQLite；本任务不迁移生产数据库、不部署。未来真实 v6 运行库必须由本任务新增的 locked operator path 在 Pilot/Release 单独授权下迁移，并先生成已验证 backup。

## Follow-up

本包通过只证明 Outcome prerequisite，不代表完整 P04；浏览器结果闭环仍须后继验收。P04 prerequisite candidate 落地后，CT-00 只能绑定其最终 commit/tree/machine evidence 重新签发 Gate E × Jiqun read-only projection successor；随后才允许脱敏 authenticated Owner assertion 的只读消费，仍禁止执行、晋级和生产资格。四个旧 CT-00 refs 与临时 proposal 均为 `NO_IDENTITY / NO_AUTHORITY / NO_VERIFICATION_INHERITANCE`。
