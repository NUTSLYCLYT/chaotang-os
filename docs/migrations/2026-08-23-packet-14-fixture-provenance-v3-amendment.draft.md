# Packet 14 — Fixture Provenance V3 Amendment

> 状态：`CONTRACT_AMENDMENT_DRAFT / PRODUCT_STOP / NON_AUTHORIZING`
>
> 日期：`2026-08-23`

## 1. 冻结身份与原因

- Repository/target：`gitee.com/msxn/chaotang-os` / `origin/ext-dev`
- 冻结起点 commit：`520c16ed4d424db97099092696504ee0a37053d3`
- 冻结起点 tree：`230ec9d0afaf1dc82db2cc44a459084f1d70713e`
- 先前未落地审查稿 raw SHA-256：
  `b86d7aa87937d0ffaa68ed6bdfcc947597a86241db4005cecc846069ef1ccccf`；仅作调查来源，不授权本合同。
- 被修正 task：`PACKET-14-REVIEWED-DRAFT-REACHABILITY-AND-BFF-CANCEL-V2-20260823`
- 被修正 approval canonical digest：
  `sha256:263619f1325a6e13ff15b0ef509fcfcb2ddbc7a0892096ff53af857cab991476`
- 被继承 reachability amendment raw SHA-256：
  `d3b6671b3a7601fc6ed7fc0771dfef00bb57d5fdc03f52467cecbabab7d82b6a`
- 本 amendment 不增加产品路径；后继 work package 的 `productPaths` 必须仍严格等于 V2 exact32。
- 当前隔离产品草稿保持未提交、未推送、未发布；本 amendment 未获 Owner 精确接受并成为稳定远端头前，
  不得继续 fixture/browser 产品施工，不得冻结 runner hash 或登记六部 fingerprints。

独立 Python/security reachability review 已证明现行 wire 信息不足，不是普通实现缺陷：

1. 本轮真实 `sqlite_backup synthetic -> rehearse` 的 `sourceSnapshotIdentity` 由 backup wire 对
   mode、source-root identity、数据库 manifest 和 artifact manifest 计算；现行 fixture CLI 却现场自造另一种
   `rc1-p14-synthetic-baseline-identity.v1` digest。二者算法不同，实测不相等。
2. runner 持有真实 `sourceSnapshotIdentity`，但现行 marker exact fields 不包含它；seed 固定 argv、固定两个 bind
   mount 也没有其它可信输入通道。因此 default runner 无法让 CLI 可信接收并绑定真实快照身份。
3. marker 只携带 `ownerUserId`，没有绑定真实 registration-issued revoked session、Chromium 当前 login Cookie
   及对应 active session row。按“一个 revoked + 一个 active”猜测行不能防止 session splice。
4. 现行 postimage 只摘要当前状态并抽查少数字段；损坏 workbook、额外文件、FAILED job 或撤销 active login 后仍可
   签发 `fixtureDigest`。
5. 现行 fixture 写入退化为 path-based，多处没有保持同一 root dirfd、closed child identity 和 zero-WAL；marker
   ownership 与 wheel RECORD 也未闭合。

继续在 V2 wire 下实现 default browser runner 只能产生伪绿。机器 GO 不得被解释为允许绕过上述信息缺口。

## 2. V3 marker 与会话绑定

### 2.1 Marker wire

`rc1-prepush-fixture-marker.v2` exact fields 固定为：

`schemaVersion,roundId,sessionId,candidateCommit,candidateTree,candidateImageId,hostRootIdentityDigest,containerDataRootIdentityDigest,sourceSnapshotIdentity,ownerUserId,fixtureNonceDigest,authSessionBinding,preimageDigest,issuedAt,expiresAt,markerDigest`

相对 v1 只增加 `containerDataRootIdentityDigest`、`sourceSnapshotIdentity` 与 `authSessionBinding`：

- `sourceSnapshotIdentity` 必须逐字等于本轮已经通过 backup→verify→rehearse 的真实
  `sourceSnapshotIdentity`。runner 负责验证 sealed backup manifest/verify/rehearse结果后经 root-owned marker可信传递；
  由于 seed 只收到 data root 与 marker 两个 bind，CLI 不声称从 rehearse root独立重算包含原 source-root/capture metadata
  的 backup identity。CLI 必须逐字绑定该值并独立验证下面冻结的 logical baseline。
- `containerDataRootIdentityDigest` 是 `rc1-p14-container-root-stat.v1` 的 digest。该对象 exact fields为
  `schemaVersion,device,inode,uid,gid,mode,containerDataRootIdentityDigest`，所有数值为无前导零十进制字符串，digest preimage
  为排除自身后的完整对象。runner 在原 backend 仍运行时，从同一 `/app/data` bind 的运行态 fstat获得 expected tuple，
  并与host dirfd及Docker inspect source交叉验证；seed start后CLI对自身 `/app/data` fstat重算并逐字匹配。
- `authSessionBinding` 必须是完整 `rc1-p14-fixture-auth-session-binding.v1` 对象，不得只传摘要。
- marker canonical bytes 仍 `<=4096`；root-owned `uid=0,gid=10002,mode=0440,nlink=1`。seed 固定
  `euid=egid=10002`，仅通过 group read读取，不得拥有或写入 marker；非 regular、hardlink、symlink、复制到第二 root、
  第二 consume 或第二 start 一律拒绝。
- v1/v2 marker 必须双向拒收；不得兼容猜测缺失字段。

本 amendment 的所有 `*Digest` 均为 lowercase `sha256:<64hex>`。只有对象自身的 terminal digest（例如
`markerDigest`、`authDeltaDigest`、`fixtureProjectionDigest`）适用“覆盖该对象排除自身 terminal digest field 后的完整
canonical JSON”规则，`schemaVersion` 即 domain separator；引用其它对象/row/raw bytes 的 digest 必须使用本文明确命名的
preimage/wire，禁止套用 terminal digest 规则猜测。旧 amendment未被本文件明确替换的 nested wire、排序、type/framing、
size、时间、privacy、cleanup规则均 byte-for-byte继承。

### 2.2 Auth-session binding wire

`rc1-p14-fixture-auth-session-binding.v1` exact fields：

`schemaVersion,ownerUserIdDigest,registrationSessionIdDigest,registrationSessionRowDigest,registrationSessionExpiresAt,registrationSessionRevokedAt,loginSessionIdDigest,loginSessionRowDigest,loginSessionExpiresAt,browserSessionBinding,authSessionBindingDigest`

其中 `browserSessionBinding` 是完整 `rc1-p14-browser-session-binding.v1`，exact fields为：

`schemaVersion,ownerRole,ownerUserIdDigest,loginSessionIdDigest,candidateCommit,candidateTree,candidateImageId,roundId,sessionId,browserSessionBindingDigest`

`ownerRole` 固定 `OWNER_A`；session ID digest固定为canonical digest of
`{schemaVersion:"rc1-p14-session-id.v1",sessionId:<raw>}`，owner ID digest固定为canonical digest of
`{schemaVersion:"rc1-p14-owner-user-id.v1",ownerUserId:<raw>}`。`browserSessionBindingDigest` 与
`authSessionBindingDigest` 均按本节通用 digest规则计算。

三个 auth row digest 共用 `rc1-p14-sqlite-row.v1`，exact fields为
`schemaVersion,database,table,columns,rowDigest`。`columns` 必须按候选库 `PRAGMA table_info` 的 `cid ASC` 包含完整一行、
不得省略列，每项为 `rc1-p14-sqlite-column.v1` exact fields
`schemaVersion,columnName,declaredType,storageClass,value`：`NULL` 的value为JSON `null`；`INTEGER` 为无前导零十进制字符串；
`TEXT` 为原UTF-8 JSON string；`BLOB` 为无padding base64url string；auth/fixture声明行出现 `REAL` 一律拒绝。
`database` 固定 `shiguan.sqlite3`，`userRowDigest` 覆盖 `table=users` 的完整row wire，两个session row digest分别覆盖
`table=auth_sessions` 的registration/login完整row wire；三者均为各自row对象的terminal `rowDigest`，不得只摘要排序后的
value map或选定列。runner与CLI还必须逐字验证候选schema digest等于冻结baseline，防止用改列顺序改变row preimage。

规则：

1. runner 在真实 Chromium 完成 Owner A register/login 后，从 current Cookie 获得 raw session token。raw token 除
   Chromium current Cookie jar、向 candidate发送的认证请求和runner私有内存外不得持久化，也不得进入 marker、stdout、
   日志、公开 evidence 或 artifact。
2. backend 停写后，runner 从稳定 dirfd 的 `shiguan.sqlite3` 读取相对 synthetic baseline 恰一 user/两 session delta；
   registration-issued row 必须同 owner、已撤销且不能认证，login-issued row 必须同 owner、未撤销、未过期并与当前 Cookie
   的服务端 session ID逐字对应。
3. `browserSessionBinding` 按上述 exact wire覆盖 session ID digest、Owner A role、candidate/session/round identity；不得包含 raw token。
4. CLI 从七库状态独立重算上述对象并与 marker 逐字比较；revoked/active 交换、同 row、第三 session、wrong owner、
   current login revoked/expired、registration 可认证或 Cookie splice 全部零写拒绝。
5. `authDelta` 升级为 `rc1-p14-fixture-auth-delta.v2`，exact fields为
   `schemaVersion,ownerUserIdDigest,userRowDigest,registrationSessionIdDigest,registrationSessionRowDigest,registrationSessionExpiresAt,registrationSessionRevokedAt,loginSessionIdDigest,loginSessionRowDigest,loginSessionExpiresAt,browserSessionBindingDigest,authSessionBindingDigest,authDeltaDigest`。
   runner 与 CLI 对该对象必须得到同一 canonical bytes；各 digest按本节通用规则计算。

## 3. Preimage 与 data-root identity 闭合

1. `rc1-p14-fixture-preimage.v2` exact fields：
   `schemaVersion,registryDigest,sourceSnapshotIdentity,hostRootIdentityDigest,containerDataRootIdentityDigest,databases,artifactTreeDigest,authDelta,preimageDigest`。
2. `sourceSnapshotIdentity` 直接使用并验证 marker 的真实 backup identity；禁止另造 synthetic-baseline identity。
3. runner 在 Owner A 注册前先冻结本轮 rehearse baseline 的七库 typed logical projection、artifact tree、host root identity
   和真实 source snapshot identity；停写后只允许 auth-session binding 所声明的 delta。runner 与 CLI 都必须逐表、逐行、逐文件
   重算，不能用 row count、file bytes或 CLI 自报摘要替代。
4. CLI 全程保持 `/app/data` root dirfd；七库与 `report_artifacts` 只使用 closed basename、`openat`、
   `O_NOFOLLOW|O_CLOEXEC` 和稳定 FD SQLite URI。所有写前后重验 root/child dev、ino、uid、gid、mode、type、nlink；
   拒绝任意 ancestor/child symlink、hardlink、wrong owner/mode、device drift、nested mount或 path replacement。
5. P14 fixture preimage 要求 cold layout：七库任一 `-wal`/`-shm` 均拒绝；不得复用通用 registry 的 sidecar 容忍。
6. host、backend、seed 三份 root/bind identity 按各自 namespace 独立取证；marker 的 host digest、expected container-root
   digest、Docker inspect 与运行态 fstat 必须共同组成唯一 binding。精确顺序为：runner冻结注册前baseline → Owner A在真实
   Chromium完成register/login并取得current Cookie → 在原backend运行态取得expected container-root tuple → 停止原backend并
   证明零writer → 从稳定FD冻结唯一auth delta与完整preimage → 生成并原子consume marker → `docker create` seed → inspect exact
   image/argv/user/network/env/two binds → 写consumption对象 → single start → CLI首个读取动作即重算container-root tuple，任何不等均
   零写退出。不得在backend停写前冻结auth delta/preimage；相同内容复制到不同 inode/root必须拒绝。

## 4. Closed write 与 postimage

### 4.1 确定性 fixture projection

- `rc1-p14-fixture-seed.v1` exact fields为
  `schemaVersion,sessionId,fixtureNonceDigest,candidateCommit,sourceSnapshotIdentity,authSessionBindingDigest,fixtureSeedDigest`；
  `fixtureSeedDigest` 按通用 canonical digest规则计算。所有派生均以该完整 digest ASCII bytes为输入，使用
  `SHA-256(UTF8("chaotang:p14:<purpose>:v1") || 0x00 || UTF8(fixtureSeedDigest))`，其中 `0x00` 是恰一个NUL byte、
  不是反斜杠与字符`0`，输出lowercase hex，不接受其它编码：
  `jobId=job前32hex`、`artifactId=artifact前32hex`、`workProductId="p14-work-product-"+work-product前32hex`、
  `bindingId="p14-binding-"+binding前32hex`、`archiveId=jobId`、`idempotencyKey="p14-"+idempotency-key完整64hex`、
  `requestHash=request-hash完整64hex`、`draftFingerprint=draft-fingerprint完整64hex`、`routeDigest=route完整64hex`。
  `idempotencyKeyDigest` 固定为 canonical digest of
  `{schemaVersion:"rc1-p14-idempotency-key.v1",idempotencyKey:<raw>}`；runner按同一公式在私有内存重算 raw key并注入
  Owner A sessionStorage，raw key不得进入公开evidence。业务时间固定为 marker `issuedAt` 的canonical UTC值；workbook bytes
  只来自candidate wheel内固定generator。不得使用uuid、随机时钟或调用者自由输入。

### 4.1.1 Closed fixture delta

runner与CLI必须分别从seed、marker `issuedAt` 和下列冻结模板构造同一个 `rc1-p14-fixture-delta.v1`，不得先读取新增行再
反推expected。其exact fields为
`schemaVersion,fixtureSeedDigest,businessTime,storageTime,modelTime,deadlineAt,deadlineStorageTime,databaseDeltas,artifactEntry,fixtureDeltaDigest`；
`businessTime` 是marker `issuedAt` 继承的六微秒canonical UTC `Z` string，`deadlineAt` 是其严格加30分钟后的同格式string；
`storageTime`/`deadlineStorageTime` 分别是解析前两者后执行Python aware-datetime
裸 `isoformat()` 得到的 `+00:00` string；零微秒时不得补`.000000`，非零时必须保留六位。`modelTime` 是解析
`businessTime` 后按当前冻结Pydantic JSON datetime规则产生的UTC `Z` string：零微秒省略`.000000`，非零保留六位。
所有SQLite datetime TEXT列与job result `generated_at`使用storage form；Pydantic `WorkProductEnvelope`/
`RuntimeResourceBinding` canonical JSON中的datetime使用model form。该差异是冻结wire的一部分，不得互换或归一化。
`databaseDeltas` 按根
registry顺序包含七库，每库exact fields为 `schemaVersion,database,insertedRows,databaseDeltaDigest`；row使用上节
`rc1-p14-sqlite-row.v1`完整typed wire，并按 `table ASC` 后primary-key typed bytes排序。未列出的库/表 `insertedRows=[]`，
所有update/delete均禁止。唯一允许的insert模板如下，表中“exact object”均用UTF-8、sorted keys、无空白canonical JSON：

| Database/table | 恰一新增row的全部列值 |
| --- | --- |
| `shiguan.sqlite3/archives` | `id=replyId=jobId`; `type=REPLY`; `title=P14 controlled delivery fixture`; `content=Controlled workbook for delivery verification only.`; `matter_type=release_acceptance_fixture`; `department=户部`; `created_at=storageTime`; `lessons_learned=NULL`; `pitfalls=NULL`; `source_kind=DECREE`; `source_text=Display-only DELIVERY_FIXTURE; no provider or accounting generation was invoked.`; `participating_departments=[\"户部\"]`; `reply_process=Controlled fixture seed`; `reply_conclusion=Fixture is not generation evidence.`; `reply_time=storageTime`; `respondent=丞相`; `owner_user_id=<raw Owner A id>`. `DECREE`仅满足现有`ReplySourceKind`持久化/读取合同，不表示已提交authority；fixture provenance仍由matter/source text/facts及generation负门绑定。 |
| `decree_jobs.sqlite3/decree_jobs` | `job_id=jobId`; `owner_user_id=<raw Owner A id>`; `idempotency_key=<derived raw key>`; `request_hash=<derived 64hex>`; `draft_fingerprint=<derived 64hex>`; `decree_text=P14 controlled delivery fixture`; `approved_route_json={}`; `state=SUCCEEDED`; `attempt_count=1`; `provider_request_count=0`; `provider_request_limit=8`; `cancel_requested=0`; `result_json=<jobResultJson>`; `reply_id=jobId`; `error_code/error_stage/error_category=NULL`; `authority_committed=0`; `acceptance_committed=0`; `deadline_at=deadlineStorageTime`; `retry_at/lease_owner/lease_expires_at=NULL`; `created_at=updated_at=storageTime` |
| `decree_jobs.sqlite3/decree_job_idempotency_keys` | `owner_user_id=<raw Owner A id>`; `idempotency_key=<derived raw key>`; `request_hash=<derived 64hex>`; `job_id=jobId` |
| `report_artifacts.sqlite3/report_artifacts` | `artifact_id=artifactId`; `owner_user_id=<raw Owner A id>`; `run_id=reply_id=jobId`; `report_type=management`; `display_name=P14 controlled management workbook.xlsx`; `period_start=period_end=2026`; `source_hashes_json=<canonical one-element array containing fixtureNonceDigest>`; `file_sha256=f76254e2291e1e44076ec6a08d87a194de859b2b50daaf14ded876de86741867`; `state=PUBLISHED`; `created_at=published_at=storageTime` |
| `report_artifacts.sqlite3/work_products` | `work_product_id=workProductId`; `owner_user_id=<raw Owner A id>`; `run_id=jobId`; `capability_id=p14-delivery-fixture`; `version=1`; `work_status=READY_FOR_HUMAN_CONFIRMATION`; `confirmation_status=PENDING`; `payload_json=<workProductJson>`; `created_at=storageTime` |
| `report_artifacts.sqlite3/work_product_artifacts` | `work_product_id=workProductId`; `artifact_id=artifactId` |
| `runtime_bindings.sqlite3/runtime_resource_bindings` | `binding_id=bindingId`; `owner_user_id=<raw Owner A id>`; `run_id=decree_id=jobId`; `case_id=NULL`; `resource_kind=accounting_work_product`; `resource_ref=workProductId`; `resource_version=v1`; `content_digest=<workProduct content_digest raw 64hex>`; `canonical_json=<runtimeBindingJson>`; `created_at=storageTime` |

`jobResultJson` exact keys/values固定为现有owner-filtered terminal display shape：`status=ok`、`chancellor=丞相`、
`route_type=single`、`rationale=Controlled P14 delivery verification fixture.`、`processing_path=["户部","会计司"]`、
`departments=["户部"]`、`ministry_opinions=[{"department":"户部","bureau_opinions":[{"bureau":"会计司","opinion":"Workbook is ready for delivery verification."}],"opinion":"Verify download and confirmation controls."}]`、
`council_verdict=null`、`final_verdict=Controlled fixture published for delivery verification.`、
`recommendations=["Verify the workbook download.","Confirm the work product once.","Retain this fixture only for the current acceptance round."]`、
`delivery_kind=accounting_report`、`delivery_period={"start_year":2026,"end_year":2026}`，以及
`artifacts=[{"artifact_id":artifactId,"kind":"ACCOUNTING_MANAGEMENT_REPORT_XLSX","display_name":"P14 controlled management workbook.xlsx","period_start":2026,"period_end":2026,"generated_at":storageTime}]`；不得出现其它key。

`workProductJson` 必须是 `WorkProductEnvelope` 全字段canonical JSON：IDs/owner/run/reply按上表，`version=1`、
`capability_id=p14-delivery-fixture`、`work_status=READY_FOR_HUMAN_CONFIRMATION`、`confirmation_status=PENDING`、
`artifact_state=PUBLISHED`、`decision=Review the controlled management workbook delivery.`，facts恰一项并精确为
`{"fact_id":"p14-delivery-fixture","generationEligible":false,"provenanceClass":"DELIVERY_FIXTURE","value":"Controlled delivery object; not generation evidence."}`；
`assumptions=[]`、`missing_evidence=[]`、`conflicts=[]`，`recommendations=["Confirm only after the browser verifies the workbook."]`、
`evidence_used=["p14-controlled-delivery-fixture"]`、
`risk_register=["This fixture must never be represented as generated business output."]`；artifact_manifest恰一项
`kind=management_report_xlsx,ref=report_artifacts/<artifactId>.xlsx,content_digest=<workbook raw 64hex>,traceable=true`；
artifact_gate恰为 `status=PASSED` 且三个list为空；`created_at=modelTime`。`content_digest` 必须按现有
`semantic_digest` frozen wire（其现有规则排除顶层`content_digest`）独立重算，payload不得有额外字段。`runtimeBindingJson` 必须是现有
`RuntimeResourceBinding` 全字段canonical JSON，scope固定
`scope_mode=owner_only,tenant_id=null,owner_user_id=<Owner A>,run_id=decree_id=jobId,case_id=null,draft_fingerprint=<derived>,route_digest=<derived>`，
resource按上表，JSON内`created_at=modelTime`而SQLite row `created_at=storageTime`，`parent_binding_ids=[]`，不得有额外字段。

`artifactEntry` exact fields为
`schemaVersion,relativePath,bytes,sha256,zipEntries,artifactEntryDigest`，固定
`relativePath=report_artifacts/<artifactId>.xlsx`、`bytes="1585"`、
`sha256=sha256:f76254e2291e1e44076ec6a08d87a194de859b2b50daaf14ded876de86741867`；ZIP entry顺序固定为
`[Content_Types].xml,_rels/.rels,xl/workbook.xml,xl/_rels/workbook.xml.rels,xl/worksheets/sheet1.xml`；每项为
`rc1-p14-xlsx-entry.v1` exact fields
`schemaVersion,name,crc32,compressedBytes,uncompressedBytes,method,dosTimestamp,createSystem,mode,entryDigest`，数值均为无前导零
十进制string，method=`DEFLATE`、DOS timestamp=`2026-08-23T00:00:00`、createSystem=`UNIX`、mode=`0100600`。每项的raw XML bytes、
CRC、compressed/uncompressed size
都由该唯一raw SHA/size冻结。runner必须从自身sealed oracle生成expected bytes并先得到此SHA，再与candidate actual bytes比较；
不得把candidate bytes作为expected。任何候选schema新增列、默认值漂移、JSON序列化差异或workbook bytes漂移均失败关闭并要求
新amendment，不得宽松归一化。
- 相对 synthetic baseline 恰新增一个 deterministic XLSX、一个 PUBLISHED management artifact、一个 work product、
  一个 runtime binding、一个 archive 和一个 display-only SUCCEEDED job；该 fixture关联的 confirmation receipt新增数固定为0。
  baseline既有 job/archive/artifact/work product/binding/receipt及历史 workbook必须逐字不变，不计入本轮增量。
- display job 的 `authority_committed=0`、`acceptance_committed=0`，不得注册 draft authority、provider result、worker lease
  或可重放 acceptance authority；Owner A 的 owner-filtered GET 仍可读取 terminal display projection。
- work product `capability_id` 固定为 `p14-delivery-fixture`，facts/evidence/risk 必须明确 `DELIVERY_FIXTURE / NOT_GENERATION`。
  为满足现有 management workbook 完整性不变量，内部 `artifact_gate.status=PASSED` 仅表示该 XLSX 的结构与摘要闭合；
  它不得进入 P14-GENERATION、release PASS、provider/accounting generation evidence 或业务价值统计。任何 adapter 把该
  capability 当 generation evidence 必须失败关闭并有负测。

`rc1-p14-fixture-projection.v2` exact fields为：

`schemaVersion,jobId,idempotencyKeyDigest,artifactId,workProductId,bindingId,archiveId,ownerUserIdDigest,runId,replyId,capabilityId,provenanceClass,generationEligible,artifactGateStatus,artifactSha256,artifactBytes,artifactState,jobState,authorityCommitted,acceptanceCommitted,confirmationReceiptDelta,fixtureProjectionDigest`

固定值为 `capabilityId=p14-delivery-fixture`、`provenanceClass=DELIVERY_FIXTURE`、`generationEligible=false`、
`artifactGateStatus=PASSED`、`artifactState=PUBLISHED`、`jobState=SUCCEEDED`、两个commit flag均`false`、
`runId=replyId=jobId`、`confirmationReceiptDelta="0"`；`artifactSha256`固定使用 `sha256:<64hex>`，`artifactBytes`与
`confirmationReceiptDelta`为无前导零十进制JSON string，commit flags与`generationEligible`为JSON boolean，digest按通用规则计算。

### 4.2 写入与 partial failure

- 写入顺序仍为 closed multi-DB sequence。SQLite可实现策略固定为：保持root dirfd，对closed basename使用
  `openat(O_RDWR|O_NOFOLLOW|O_CLOEXEC)`取得稳定child FD，复用已在 ArtifactStorage 负测验证的
  `/proc/self/fd/<fd>`（不可用则失败关闭）建立连接；连接前后及transaction/commit前后同时重验child FD、原basename和root
  identity。journal mode固定`DELETE`，开始前任何`-wal/-shm/-journal`拒绝；事务期间只允许同库exact `-journal`，commit后必须
  消失，始终禁止WAL/SHM；每库commit后fsync DB FD和root dirfd。artifact只经artifact dirfd/openat写入并fsync file/parent。
- runner 在 seed 前复制/冻结 expected preimage；CLI 从该 preimage按确定性 projection 构造唯一 expected postimage。
- 任一异常、锁争用、identity replacement、extra row/file、partial commit 或超时后，不得修补 root、重启 backend或生成
  postimage/fixture digest；runner 必须销毁整个 round data root、marker、seed container、browser session和network。

### 4.3 Postimage wire

`rc1-p14-fixture-postimage.v2` exact fields：

`schemaVersion,preimageDigest,sourceSnapshotIdentity,hostRootIdentityDigest,containerDataRootIdentityDigest,authSessionBindingDigest,fixtureDeltaDigest,databases,artifactTreeDigest,fixtureProjection,postimageDigest`

必须验证：

1. 七库完整 typed logical state 精确等于 preimage + runner/CLI独立构造并逐字一致的 `fixtureDeltaDigest`；所有其它 row、
   column value与 schema digest不变。
2. artifact tree 精确多一个 deterministic `.xlsx`；重读实际 bytes并验证 ZIP/XLSX结构、entry allowlist、CRC、size与SHA-256。
3. job 固定 SUCCEEDED/display-only、同 owner/idempotency、commit flags均0；archive、artifact、work product、binding 的
   owner/run/reply/ID/content digest互相逐字绑定。
4. auth delta逐字不变，current login session仍active且registration session仍revoked。
5. 本 fixture关联的 confirmation receipt新增数为0；除 `fixtureProjection` 声明的唯一增量外不得新增其它
   artifact/work product/binding/archive/job/provider result/authority，baseline既有对象与receipt逐字不变。
6. CLI 完成自身只读重算后输出 provisional fixture object；runner 收到seed stdout和exit evidence后，以独立只读连接、
   实际新增artifact bytes与冻结baseline重算完整postimage。只有runner计算的canonical digest逐字等于CLI
   `postimageDigest`时，runner才可接受 provisional object；CLI自报digest不构成PASS，也不存在runner→CLI反向握手。

## 5. Provisional stdout 与 runner-accepted fixture

CLI stdout `p14-prepush-delivery-fixture-provisional.v2` exact fields：

`schemaVersion,candidateImageId,sessionId,ownerUserIdDigest,hostRootIdentityDigest,containerDataRootIdentityDigest,sourceSnapshotIdentity,authSessionBindingDigest,preimageDigest,fixtureDeltaDigest,postimageDigest,jobId,idempotencyKeyDigest,artifactId,workProductId,artifactSha256,provisionalFixtureDigest`

- `provisionalFixtureDigest` 覆盖除自身外完整对象；v1/provisional-v2 stdout双向拒收。CLI不得输出或声称最终
  `fixtureDigest`。
- raw owner/session/password/Cookie/nonce/idempotency key/path/workbook bytes不得输出。
- stdout恰一行 canonical JSON + LF、fatal UTF-8、`<=8192`、stderr空、exit0；否则不得生成provisional digest。

runner 在验证CLI provisional object、seed create/start/exit、data-root binding、consumption和独立postimage后构造
`rc1-p14-accepted-delivery-fixture.v1`，exact fields：

`schemaVersion,provisionalFixtureDigest,dataRootBindingDigest,consumptionDigest,runnerPostimageDigest,fixtureDeltaDigest,fixtureProjectionDigest,fixtureDigest`

`dataRootBindingDigest` byte-for-byte继承旧 amendment 的 host/backend/seed bind objects；`consumptionDigest` byte-for-byte
继承旧 `rc1-p14-fixture-consumption.v1` 并覆盖 markerDigest、exact seedContainerId、candidateImageId、roundId、sessionId和
consumedAt。最终 `fixtureDigest` 只由runner按通用规则计算，P14 browser receipt/round只接受该digest。

## 6. Wheel、marker 与 runner closure

1. seed CLI 强制 marker `uid=0,gid=10002,0440,nlink1`；不得允许 `uid==euid` 的宽松分支。
   CLI以 `O_RDONLY|O_NOFOLLOW|O_CLOEXEC` 打开后全程保留同一marker FD，读取前后fstat并重算canonical content digest；
   runner在seed start前后按host同inode/markerDigest复验，任何替换或写入均零写拒绝。
2. wheel RECORD 使用 CSV 规则解析；所有带 hash/size成员经 `/app`稳定dirfd重算，路径不得逃逸；当前加载的
   `app.operations.sqlite_backup`、runtime registry、work-product、accounting storage模块及其实际imported package/
   `__init__.py`都必须有恰一RECORD entry，hash algorithm恰为`sha256`，urlsafe-base64 hash与无前导零exact size均非空，
   并与稳定dirfd重读bytes逐字重算一致。只有RECORD自身及Python wheel规范明确允许的generated metadata可空；关键模块
   任一空hash、空size、重复entry、非sha256或未覆盖均失败关闭。
3. runner 必须验证 seed create-before-start inspect、exact image/revision/tree/argv/user/network/env/two bind mounts；一次
   `.ready -> .consumed`、一次 container start/exit、按 exact 64hex ID销毁。
4. backend restart后必须再次验证原 exact backend container ID、root/bind identity、readiness closed layout、registration
   revoked、current login Cookie可重放及 fixture poststate，之后才能注入 owner-scoped sessionStorage。
5. default runner 不得依赖 test injection、client self-report或宿主源码搜索铸造 PASS；真实 Chromium、edge、collector、PNG、
   console、bounded ledger、A/B Cookie、candidate poststate与cleanup任一 NOT_RUN/BLOCKED/FAIL，P14均失败关闭。
6. 后继 V3 task/approval 必须冻结 `/usr/bin/google-chrome` 的realpath、regular/nlink/owner/mode、binary SHA-256与
   `--version` exact值，以及sealed runner/controller source digest。controller只使用真实CDP；Chrome清空proxy环境、禁止
   background egress，只能访问runner-owned `127.0.0.1:<ephemeral>` edge/collector。runner通过Docker inspect取得candidate
   caddy在本轮internal network的exact IP，并由loopback edge转发到该IP:8080；任何host published candidate port、remote
   controller、mock/interception或identity drift拒绝。登录只用Chromium `fetch`接收真实Set-Cookie，页面在fixture完成前保持
   login origin；backend restart/readiness/session replay后才注入existing owner-scoped sessionStorage并导航`/study`。
7. `/study` mount必然产生 `GET /api/daily-memorial-drafts/latest`。V3将其冻结为唯一
   `UI_BOOTSTRAP_AUXILIARY`：每个Owner A/B Study mount最多1次、同一current Cookie、response `<=262144`、状态只允许现有
   candidate返回的200/404/503，edge必须记录method/route/status/request/response/session digest。它不计入固定14个business
   action，也不得被当作成果或PASS；除页面静态资源、HTML导航和该exact auxiliary外，其它未声明`/api/**`均拒绝。
8. `P14-GENERATION` evidence graph必须机器拒绝任一引用值逐字等于本轮accepted fixture的
   `fixtureDigest`、`fixtureDeltaDigest`、`provisionalFixtureDigest`、`dataRootBindingDigest`、`consumptionDigest`、
   `runnerPostimageDigest`、`fixtureProjectionDigest`、`postimageDigest`、`jobId`、`idempotencyKeyDigest`、`artifactId`、
   `workProductId`、work-product `content_digest`、`archiveId`、`bindingId`、`fixtureNonceDigest`、
   `fixtureSeedDigest`、`requestHash`、`draftFingerprint`、`routeDigest`或`markerDigest`。
   workbook SHA必须同时加入两种逐字比较值：accepted fixture `artifactSha256` 的
   `sha256:<64 lowercase hex>` prefixed值，以及只移除该恰好一个`sha256:`前缀得到的`<64 lowercase hex>` raw值。
   raw值只是runner内派生的forbidden comparison value，不增加accepted fixture、projection或receipt字段；DB
   `file_sha256`、artifact manifest `content_digest`或generation stdout `artifact_sha256`使用raw表示时同样必须被拒绝。
   缺前缀、重复前缀、大小写、长度或非hex不合法时失败关闭，不得宽松规范化后继续。
   允许共享而不因本规则拒绝的仅是candidate image/commit/tree、sourceSnapshot/preimage、auth/session/round identity；这是
   值级污染检查，不得误拒合法generation graph自身同名字段中的不同真实值。runner还要逐一执行现有work-product/evidence consumers的
   负测，证明`capability_id=p14-delivery-fixture`、`provenanceClass=DELIVERY_FIXTURE`或`generationEligible=false`任一出现时
   都不能晋级accounting generation、release PASS或业务价值。

### 6.1 单一 request ledger V3

旧只容纳14个business action的ledger升级为同一个 `rc1-prepush-browser-request-ledger.v3`，不得另建第二ledger；v2/v3
双向拒收。exact fields为
`schemaVersion,roundId,sessionId,businessEntries,auxiliaryEntries,businessEntriesDigest,auxiliaryEntriesDigest,requestLedgerDigest`。
`businessEntries` 的entry wire、actionId、bounded body、ordering与旧v2 byte-for-byte继承，数量仍严格14；
`businessEntriesDigest` 覆盖exact对象
`{schemaVersion:"rc1-p14-business-entries.v3",entries:<businessEntries>}`。14个action的正反向覆盖只针对该数组，
auxiliary不得占用actionId或改变business action计数。

`auxiliaryEntries` entry使用 `rc1-p14-browser-auxiliary-entry.v1` exact fields
`schemaVersion,sequence,ownerRole,actionClass,method,route,requestBodySha256,responseStatus,responseBytes,responseSha256,sessionBindingDigest,entryDigest`。
固定两个entry、顺序 `OWNER_A` 后 `OWNER_B`、sequence分别为字符串`"1"/"2"`，其余固定
`actionClass=UI_BOOTSTRAP_AUXILIARY`、`method=GET`、`route=/api/daily-memorial-drafts/latest`、
`requestBodySha256=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`；response status只允许
JSON string `"200"|"404"|"503"`，bytes为`"0".."262144"`无前导零十进制string，response digest直接覆盖actual raw
response bytes，session binding逐字等于该owner现有browser-owner session wire的terminal digest。`auxiliaryEntriesDigest`
覆盖exact对象 `{schemaVersion:"rc1-p14-auxiliary-entries.v3",entries:<auxiliaryEntries>}`；PASS要求A/B各恰一项，缺、多、乱序、
重复或不同Cookie均失败。旧browser receipt中的request-ledger引用升级为总 `requestLedgerDigest`，必须覆盖两个nested digest及
完整arrays；receipt、collector和edge三方逐字一致后才可接受。

### 6.2 Cleanup V3

旧布尔 cleanup wire由 `rc1-prepush-browser-cleanup.v3`替代，v2/v3双向拒收。exact fields为：

`schemaVersion,roundId,sessionId,sessionDeadline,cleanupDeadline,commandLedgerDigest,resources,negativeObservations,cleanupCompletedAt,cleanupDigest`。
`sessionDeadline` 是business journey硬截止，任何业务PASS/新动作不得晚于该时间；`cleanupDeadline` 固定为
`sessionDeadline + 120 seconds` 的同格式canonical UTC，超时只允许停止、销毁和负探测，全部cleanup observation必须不晚于
该有限截止。cleanup不延长或补发业务PASS。

`resources` 与 `negativeObservations` 均按固定顺序
`SEED_CONTAINER,BACKEND_CONTAINER,FRONTEND_CONTAINER,CADDY_CONTAINER,NETWORK,EDGE_LISTENER,COLLECTOR_LISTENER,BROWSER_PROCESS,MARKER,SESSION_ROOT,DATA_ROOT`，
不得缺项。每个resource为 `rc1-p14-cleanup-resource.v1` exact fields
`schemaVersion,resourceKind,plannedIdentityDigest,creationState,createdIdentityDigest,resourceDigest`；`creationState` 只允许
`CREATED|NEVER_CREATED|ATTEMPTED_NO_RESOURCE`。`CREATED`要求非空created digest；`NEVER_CREATED`与
`ATTEMPTED_NO_RESOURCE`要求JSON null。planned identity在任何create/listen/open动作前写入sealed command ledger：没有任何
create/start/bind/open attempt才可`NEVER_CREATED`；attempt成功或返回任何identity必须`CREATED`；只有命令明确`FAILED`、没有
返回identity、没有后续成功/未知结果，且planned name/label/origin/basename负探测全部ABSENT时才可
`ATTEMPTED_NO_RESOURCE`。命令结果未知、daemon断连或无法证明未创建时整个cleanup失败关闭，不得选任一状态猜测。

每项observation为 `rc1-p14-cleanup-negative-observation.v2` exact fields
`schemaVersion,resourceKind,plannedIdentityDigest,creationState,createdIdentityDigest,probeKind,probeResult,commandLedgerDigest,terminalProbeSequence,terminalProbeEntryDigest,observedAt,observationDigest`。
`CREATED` 只允许 `probeResult=ABSENT` 且必须按created exact identity做负探测；`NEVER_CREATED` 只允许
`probeResult=NEVER_CREATED`，并同时要求sealed command ledger中不存在该resource的create/start/bind/open attempt，且按planned
name/label/origin/basename完成list/ENOENT负探测；`ATTEMPTED_NO_RESOURCE`只允许
`probeResult=ATTEMPTED_ABSENT`，同时绑定唯一FAILED attempt及同强度planned-identity负探测。`observedAt` 必须是canonical UTC且
不晚于`cleanupDeadline`；禁止用NEVER_CREATED/ATTEMPTED_NO_RESOURCE替代已创建、可能已创建或创建结果未知的资源。

身份对象与唯一probeKind逐项冻结如下；observation中的两个identity digest必须分别逐字等于同序resource字段，禁止从其它
已消失资源拼接证明：

所有planned identity统一使用 `rc1-p14-cleanup-planned-identity.v1` exact fields
`schemaVersion,resourceKind,attributes,plannedIdentityDigest`；created identity使用
`rc1-p14-cleanup-created-identity.v1` exact fields
`schemaVersion,resourceKind,plannedIdentityDigest,attributes,createdIdentityDigest`。`attributes` 必须按下表逗号顺序恰好包含
全部属性，每项为 `rc1-p14-cleanup-identity-attribute.v1` exact fields
`schemaVersion,name,valueType,value,attributeDigest`，valueType只允许`STRING|DECIMAL|DIGEST|STRING_MAP`；decimal为无前导零string，
digest遵守本文digest格式。`STRING_MAP`是按key UTF-8升序的
`rc1-p14-cleanup-string-map-entry.v1` exact objects，fields为`schemaVersion,key,value,entryDigest`。
`requiredLabels`固定三项：`courtos.p14.round=<roundId>`、`courtos.p14.session=<sessionId>`、
`courtos.p14.resource=<resourceKind>`。不得添加未列属性或替换schemaVersion/terminal digest field。

attribute `valueType`逐名冻结：`requiredLabels=STRING_MAP`；
`device,inode,uid,gid,mode,port,socketInode,pid,procStartTime=DECIMAL`，其中`mode`严格等于
`stat.S_IMODE(st_mode)`的无前导零十进制值；所有名字以`Digest`结尾的下表属性，以及`expectedImageId`、`imageId`、
`containerId`、`networkId`，固定为`DIGEST`；Docker裸64hex ID在进入wire前规范为
`sha256:<64hex>`；其余下表属性一律`STRING`。不得把decimal/mode/ID改作STRING。

上述引用digest的preimage冻结如下。除已由marker/V2 root wire定义的`markerDigest/hostRootIdentityDigest`和直接对raw bytes取
SHA-256的`expectedConfigDigest/configDigest`外，均是 `rc1-p14-cleanup-reference.v1` terminal digest，exact fields为
`schemaVersion,referenceKind,fields,referenceDigest`；`fields` 是按下表顺序的
`rc1-p14-cleanup-identity-attribute.v1`数组，不得含未列字段：

| referenceKind / 对应attribute | fields exact order |
| --- | --- |
| `DOCKER_ENDPOINT` / `daemonEndpointDigest` | `socketDevice(DECIMAL),socketInode(DECIMAL),uid(DECIMAL),gid(DECIMAL),mode(DECIMAL:S_IMODE),daemonId(STRING)` |
| `DOCKER_CONTAINER_INSPECT` / `inspectDigest` | `containerId(DIGEST),canonicalInspectJsonSha256(DIGEST)`；后者直接摘要同endpoint实际inspect完整parsed JSON经本文canonical JSON重编码的raw bytes |
| `DOCKER_NETWORK_INSPECT` / `networkObjectInspectDigest` | `networkId(DIGEST),canonicalInspectJsonSha256(DIGEST)`；摘要规则同上 |
| `DOCKER_BIND` / `bindInspectDigest` | `containerId(DIGEST),hostRootIdentityDigest(DIGEST),destination(STRING),readOnly(STRING:true|false),propagation(STRING)`；该host digest必须逐字等于V2既有host root identity，不得另造source-root digest |
| `DOCKER_NETWORK_ATTACHMENT` / `networkInspectDigest` | `networkId(DIGEST),containerId(DIGEST),ipv4Address(STRING),aliasesCanonicalJsonSha256(DIGEST)`；aliases按UTF-8升序canonical JSON raw bytes摘要 |
| `PROCESS_IDENTITY` / `ownerProcessIdentityDigest` | `pid(DECIMAL),procStartTime(DECIMAL),uid(DECIMAL),gid(DECIMAL),executableIdentityDigest(DIGEST)` |
| `LOOPBACK_ORIGIN` / `originDigest` | `scheme(STRING:http),host(STRING:127.0.0.1),port(DECIMAL)` |
| `EXECUTABLE_IDENTITY` / `chromeBinaryIdentityDigest,executableIdentityDigest` | `realpath(STRING),device(DECIMAL),inode(DECIMAL),uid(DECIMAL),gid(DECIMAL),mode(DECIMAL:S_IMODE),nlink(DECIMAL),bytes(DECIMAL),rawSha256(DIGEST),version(STRING)` |
| `PLANNED_PATH` / `profileRootPlannedDigest` | `retainedParentDirfdIdentityDigest(DIGEST),basename(STRING),purpose(STRING:BROWSER_PROFILE)` |
| `ROOT_STAT` / `profileRootIdentityDigest,sessionRootIdentityDigest` | `retainedParentDirfdIdentityDigest(DIGEST),basename(STRING),device(DECIMAL),inode(DECIMAL),uid(DECIMAL),gid(DECIMAL),mode(DECIMAL:S_IMODE),nlink(DECIMAL)` |
| `DIRFD_STAT` / `retainedParentDirfdIdentityDigest` | `device(DECIMAL),inode(DECIMAL),uid(DECIMAL),gid(DECIMAL),mode(DECIMAL:S_IMODE),nlink(DECIMAL)` |

每个reference object的`referenceKind`即domain，不能互换；`canonicalInspectJsonSha256`、
`aliasesCanonicalJsonSha256`和`rawSha256`是明确的raw-byte摘要例外：前两者按各自行定义，`rawSha256`直接覆盖该
EXECUTABLE_IDENTITY所指可执行文件的exact raw bytes，结果为lowercase `sha256:<64hex>`；三者都不得再包装成另一reference。
未在本表或既有marker/V2 wire中定义的
digest-valued attribute一律非法。

| resourceKind | planned / created identity exact preimage | 唯一 probeKind |
| --- | --- | --- |
| `SEED_CONTAINER` | planned attrs=`daemonEndpointDigest,roundId,sessionId,exactName,requiredLabels,expectedImageId`；created attrs=`containerId,imageId,inspectDigest` | `DOCKER_CONTAINER_INSPECT_ENOENT` |
| `BACKEND_CONTAINER` | planned attrs=`daemonEndpointDigest,roundId,sessionId,exactName,requiredLabels,expectedImageId`；created attrs=`containerId,imageId,bindInspectDigest,inspectDigest` | `DOCKER_CONTAINER_INSPECT_ENOENT` |
| `FRONTEND_CONTAINER` | planned attrs=`daemonEndpointDigest,roundId,sessionId,exactName,requiredLabels,expectedImageId`；created attrs=`containerId,imageId,networkInspectDigest,inspectDigest` | `DOCKER_CONTAINER_INSPECT_ENOENT` |
| `CADDY_CONTAINER` | planned attrs=`daemonEndpointDigest,roundId,sessionId,exactName,requiredLabels,expectedImageId,expectedConfigDigest`；created attrs=`containerId,imageId,networkInspectDigest,configDigest,inspectDigest` | `DOCKER_CONTAINER_INSPECT_ENOENT` |
| `NETWORK` | planned attrs=`daemonEndpointDigest,roundId,sessionId,exactName,requiredLabels`；created attrs=`networkId,networkObjectInspectDigest` | `DOCKER_NETWORK_INSPECT_ENOENT` |
| `EDGE_LISTENER` | planned attrs=`roundId,sessionId,loopbackHost,portPolicy,ownerProcessIdentityDigest`，固定host=`127.0.0.1`/policy=`KERNEL_ASSIGNED`；created attrs=`port,socketInode,originDigest` | `LOOPBACK_BIND_CONNECT_SS_ABSENT` |
| `COLLECTOR_LISTENER` | planned attrs同listener；created attrs=`port,socketInode,originDigest`且port/origin不同于edge | `LOOPBACK_BIND_CONNECT_SS_ABSENT` |
| `BROWSER_PROCESS` | planned attrs=`chromeBinaryIdentityDigest,roundId,sessionId,profileRootPlannedDigest`；created attrs=`pid,procStartTime,executableIdentityDigest,profileRootIdentityDigest` | `PROC_KILL_ZERO_AND_PROFILE_ENOENT` |
| `MARKER` | planned attrs=`retainedParentDirfdIdentityDigest,basename,roundId,sessionId`；created attrs=`device,inode,uid,gid,mode,markerDigest` | `PARENT_DIRFD_OPENAT_ENOENT` |
| `SESSION_ROOT` | planned attrs=`retainedParentDirfdIdentityDigest,basename,roundId,sessionId`；created attrs=`device,inode,uid,gid,mode,sessionRootIdentityDigest` | `PARENT_DIRFD_OPENAT_ENOENT` |
| `DATA_ROOT` | planned attrs=`retainedParentDirfdIdentityDigest,basename,roundId,sessionId`；created attrs=`device,inode,uid,gid,mode,hostRootIdentityDigest`，不得引用尚未存在的seed/backend完整dataRootBindingDigest | `PARENT_DIRFD_OPENAT_ENOENT` |

container/network使用同一disposable Docker endpoint做exact inspect/ENOENT并用label/name list反证；listener同时使用bind、connect与`ss`；browser同时用
PID/start-time/executable identity、`kill(pid,0)`与profile parent dirfd；文件/目录使用retained parent dirfd的ENOENT。
`commandLedgerDigest` 是 `rc1-p14-cleanup-command-ledger.v1` terminal digest，该对象exact fields为
`schemaVersion,roundId,sessionId,entries,commandLedgerDigest`；每项为
`rc1-p14-cleanup-command-entry.v1` exact fields
`schemaVersion,sequence,resourceKind,operation,plannedIdentityDigest,observedIdentityDigest,result,at,entryDigest`，sequence为从`"1"`
开始连续无前导零decimal string，operation只允许`PLAN|CREATE|START|BIND|OPEN|STOP|DESTROY|PROBE`，result只允许
`ATTEMPTED|SUCCEEDED|FAILED`；尚无identity时`observedIdentityDigest`必须为JSON null；所有entry `at`必须严格递增且不晚于
`cleanupDeadline`。每个observation的terminal sequence/digest必须逐字等于该resource在完整ledger中的最后一项，该项必须是
`operation=PROBE,result=SUCCEEDED,at=observedAt`；terminal probe前runner必须join全部controller/child并等待该resource相关Docker
命令得到确定结果，terminal probe后该resource不得再有任何entry或重建动作。ledger在11项terminal probe后原子seal，
`cleanupCompletedAt` 必须不早于所有`observedAt`且不晚于`cleanupDeadline`。resources/observations必须引用同一digest。
accepted成功round要求11项全部`CREATED`后`ABSENT`；失败/timeout允许真实`NEVER_CREATED`或
`ATTEMPTED_NO_RESOURCE`。任一probe失败、daemon
断连、identity未知/不符或cleanup未完成时，journey过程中内存里的provisional receipt不得被认定或持久化为accepted browser
receipt/round；`cleanupDigest`只能由runner对实收resource records和负观测计算。

browser receipt同步升级为 `rc1-prepush-browser-receipt.v3`：旧v2除terminal `receiptDigest`外的exact fields byte-for-byte保留，
再以`cleanupDigest,cleanupCompletedAt,acceptedAt,receiptDigest`作为唯一suffix，v2/v3双向拒收；`acceptedAt` 必须不早于cleanupCompletedAt且不晚于
cleanupDeadline。accepted receipt只能在command ledger sealed、cleanup digest重算完成后构造/持久化；probe后重建、晚到异步
create或receipt先于terminal observations全部失败关闭。

## 7. 必需 RED

至少锁定：

- marker v1、缺/错 source identity、复制 root、第二 create/consume/start、self-owned marker、open后替换、错误 RECORD；
- auth session同row/交换/第三row/wrong owner/current revoked或expired/Cookie splice；
- 任一 WAL/SHM、ancestor/child symlink、hardlink、wrong uid/gid/mode/nlink、nested mount、connect-window swap；
- workbook损坏/替换、额外文件/row、FAILED job、commit flag=1、第二 authority/provider result、额外 receipt/artifact/binding；
- partial multi-DB write、写后 active session撤销、postimage concurrent splice均不得生成 fixture digest或重启 backend；
- fixture capability/IDs/digest不得被 generation/evidence adapter或release aggregation计为 accounting generation PASS；
- `businessTime/storageTime/modelTime`互换、零/非零微秒、`Z/+00:00` splice、work-product/backend restart读取失败、archive model读取失败均拒绝；
- generation forbidden set中每个fixture专属ID/digest都要单独注入并拒绝；workbook SHA必须分别以
  `sha256:<64hex>` prefixed值和`<64hex>` raw值单独注入并拒绝，共享candidate/source/auth/round值不得误拒；
- executable `rawSha256`缺失、换domain、双包装或binary byte splice，DOCKER_BIND host digest splice，
  `PLANNED_PATH.purpose!=BROWSER_PROFILE`均拒绝；
- stdout/marker/preimage/postimage v1/v2双向拒收，runner/CLI digest、actual bytes、session binding任一 splice拒绝；
- `/study`缺/多 auxiliary、额外business/API action、非真实Chrome/CDP、binary/source drift、proxy/外网、fixture前Study导航拒绝；
- 正常、fixture/browser failure、timeout、伪 receipt后 cleanup v3所有identity-bound负观测必须成立；特别覆盖create明确失败无ID、
  create结果未知、DATA_ROOT早于seed、`ATTEMPTED_NO_RESOURCE`滥用和cleanup deadline耗尽。
- terminal probe后重建container/listener/file、晚到异步create、非末项probe、ledger时间倒退和accepted receipt早于cleanup均拒绝。

## 8. 治理顺序与停止条件

1. 本 amendment 先经独立 code/Python/security 合同复审达到 P0=P1=P2=P3=0。
2. Owner 按重锚定后的本文件 raw SHA-256精确接受后，本文件作为冻结起点的直接单亲子单独 commit/push；不得混入产品代码或 V3 task/plan/approval。
3. 远端双读确认后，V2 approval必须返回 STOP。
4. 基于新远端头生成 exact32 V3 task/plan/approval；Owner精确接受新 canonical digest，三文件单独 commit/push。
5. exact V3 task机器 GO 后才可重放产品草稿；不得在当前 V2 dirty product worktree继续施工或提交。
6. 产品代码、compatibility fingerprints、最终 M0、push/release/deploy仍分别需要原治理链，不由本 amendment授权。

任何需要第33产品路径、新表/列/API、生产 feature flag、第二事实源、真实 provider/公网/secret/生产数据或不可逆
外部动作的方案都必须再次停止，不得扩大本 amendment。

## 9. 回滚与非目标

- 本 amendment 只修正一次性 P14 delivery fixture/browser evidence wire，不改变正常生产 API、真实用户数据、accounting
  generation、release authority或最终产品信息架构。
- 不把 fixture当 generation，不把内部 XLSX integrity gate当 release PASS，不新建 BFF、provider或长期 fixture入口。
- amendment 未获批时，删除本单一 draft即可；现有隔离产品工作树与用户原工作树均保持不提交、不覆盖。
