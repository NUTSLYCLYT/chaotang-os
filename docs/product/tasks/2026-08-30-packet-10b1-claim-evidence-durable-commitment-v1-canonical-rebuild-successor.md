# Packet 10-B1 — Claim-Evidence Durable Commitment V1 Canonical Rebuild Successor

任务 ID：`PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-CANONICAL-REBUILD-SUCCESSOR-20260830`

## Status

Draft

`NON_AUTHORIZING / SHADOW_ONLY / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 forward-only successor 纠正 staged-handoff approval 落地并取得machine GO后机械发现的raw-schema迁移矛盾。前序approval commit为 `07783470780d2dd3c53f40d3b59f830641673a9b / add376f196f303ffa64feb3096fc8ad18b1ca08b`；新shadow仅形成七路径未提交证据，未修改`backend/app/api/decrees.py`，没有candidate commit/push。冻结exact-old identity `aa293873...`经单条`ALTER TABLE ... ADD COLUMN`实际得到`909b62c7...`，不等于唯一canonical-new `8b38c49b...`。因此前序状态固定为 `STOP / APPROVAL_SCHEMA_MIGRATION_CONTRADICTION / UNCOMMITTED_BYTE_EVIDENCE_ONLY / NO_CANDIDATE_IDENTITY`；该七路径草稿不得作为byte donor或重物化来源，只保留矛盾发现证据。

更早 exact8 在 `a41890f0c86c499a4b8133decd73a712baa0f19c / 2df52b20c7ebafd6e7629cc07abdfb777be2ccdd` 形成的八路径donor已因跨系统transaction guard破坏crash recovery而停止；其身份继续按下文冻结，仅作语义证据。

前序 staged-handoff machine authority 生命周期精确处置为 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`：不存在以该 authority 验证或提交的 product child。未来本 successor approval commit 使远端离开 `077834707...`，只是 forward-only治理纠偏，不构成旧one-child authority的消费、恢复、继承或re-anchor。

本 successor 保留 existing staged durable handoff：pending job 先持久化，process-local authority 再 commit，durable marker 与 activation 分阶段提交并可恢复。B1 仍没有任何 non-null commitment writer；SQL NULL 是唯一 legacy 状态。未来 P10-B2 writer 必须另获 authority，并以 server-owned lifecycle/CAS 协议禁止在 active execution、archive 或 publish 窗口写入。任意直接修改 SQLite 文件、绕过 storage contract 的 admin/rogue writer不属于 B1 可原子化的信任边界，不能以牺牲 durable crash recovery 的方式伪装成已解决。

### Stopped donor identity

前序 stopped donor 工作区固定为 `/home/ubuntu/Projects/chaotang-os/.worktrees/packet10b1-claim-evidence-durable-commitment-exact8-shadow-candidate-20260830`，HEAD/tree为 `a41890f0c86c499a4b8133decd73a712baa0f19c / 2df52b20c7ebafd6e7629cc07abdfb777be2ccdd`，精确八条 `M / 100644`：

| path | bytes | raw SHA-256 | Git blob |
| --- | ---: | --- | --- |
| `backend/app/api/decree_jobs.py` | 7454 | `sha256:74bc75f564d61264786ab8d801834d78404dee2a97f1cd11333070f6b7319b72` | `3011ddfd01905cb24d520ae67cb22b049359cd06` |
| `backend/app/api/decrees.py` | 62877 | `sha256:1f0758962c0d9759c6db63a5e43c1c1553cc77814881bf4d1b81d7d8baa3e49a` | `9a1f52824846c0773efbb0433e520d85499f3014` |
| `backend/app/decree_jobs/models.py` | 5195 | `sha256:513b7f37fdf8d314406a8875ea1c707f7562f152f236cd4f1fa3275850c45d69` | `5f751ac9488aaea041bbfc3a25615652c63f2ce2` |
| `backend/app/decree_jobs/storage.py` | 73033 | `sha256:ee59bbb9c9f5b79312767caf693c5ece262b805948579afd51ffa3cc6ddb5c20` | `2b446d98c95fd09b4fab726204403dc6b8e18312` |
| `backend/app/decree_jobs/worker.py` | 13942 | `sha256:f9ac190e69fe74a013a91ef0bf245e1a097e99c44c1b27b2a3c5bb539a88a2af` | `b7d774a1f17d4f04ba6fe13acdd4d9409189e1a2` |
| `backend/tests/test_decree_job_storage.py` | 46927 | `sha256:1cb10344d0d4f2ebc9e023339df8a8e26986ab7d24a142bf0ff4af2c52c76df5` | `e8365ad8ddba0242a691fce68fbf276227065012` |
| `backend/tests/test_decree_job_worker.py` | 42749 | `sha256:2543092c5d866e4765abd8374e1a9fd3aeb0038f562af7f9a58f3867e34aed51` | `c61b2aa154bd3649aaab3ac8619f5587bd42f890` |
| `backend/tests/test_decree_jobs_api.py` | 30024 | `sha256:0ebd1e6f655fc7a57e7d9fe88064781ce314b253f8a63853bcd7f67a696867a7` | `6847f7aaa30e07deefebb24765f55283bb5076a6` |

bundle算法为上述每条的 `{path,mode:"100644",bytes,rawSha256}` 按path字典序组成array，再对RFC8785 canonical UTF-8 bytes计算SHA-256；donor bundle为 `sha256:81f99a2ef78cc041984f1f20945ecd26ef077c07189ba8956efa91f6fe5763f3`。combined diff精确取 `/usr/bin/git diff --binary --no-ext-diff HEAD -- <八条按上表顺序路径>` 的原始stdout bytes，SHA-256为 `sha256:243a4f42311a90a5ff4a7876efd9c9cc5b1c80ae247d3c7adeb0378449abe809`。

任一identity漂移立即STOP。由于donor含已拒绝的transaction guard及`decrees.py`格式化噪声，新shadow只允许语义选择性重实现并全量重验；不得称byte-for-byte重物化，不继承donor的candidate、verification或review身份。

### Exact B1 guarantee

- 请求开始或任一明确 storage boundary/CAS 观察到 legal、malformed 或 spliced non-null 时固定失败关闭。same-owner changed-request先固定 `409 idempotency_conflict`；same-owner same-request 的 accept/GET/cancel固定为脱敏 `503 {"status":"error","reason":"job_unavailable"}`。查询必须先按owner过滤再读取commitment；cross-owner与missing响应逐字节一致，不泄露raw/schema/digest。
- reserve 前的 owner/key/request/draft preflight 拦截已经提交的 non-null，registry 事件为零。
- 对preflight后的任意direct writer不声明跨系统原子性；只有某个明确storage boundary已经观察到non-null时，后续步骤才必须停止。若此时reservation仍未commit，`release_reservation` 必须成功；返回false或抛异常均固定失败关闭，且禁止后续authority commit、marker、activation与业务副作用。
- staged intent、commit-marker后的安全reconciliation、idempotency、replay和非电池旧流程不得回退；process-local authority commit成功但durable marker尚未落地的歧义窗口不得伪装成可自动恢复。
- worker 在每个既有 storage boundary 重验 SQL NULL；B1 不声称对不服从未来 writer protocol 的任意跨进程直接 SQL 写入与外部 side effect 提供跨系统原子性。

### Staged authority state contract

| 阶段 | durable SQLite 状态 | 失败／崩溃后的唯一合法处置 |
| --- | --- | --- |
| preflight / reserve前 | 无新job | 返回既有错误；registry零事件 |
| reservation已取得、pending尚未持久化 | 无新job | release必须成功；进程退出只丢弃volatile reservation |
| pending已持久化、authority尚未commit | `authority_committed=0 / acceptance_committed=0` | release成功后CAS abandon；不得claim或activate |
| authority commit成功、marker尚未落地 | 同上但外部commit结果不可由SQLite证明 | 永不自动promote；只能保持不可claim，并在新authority/reissue流程下CAS abandon/reconcile |
| marker已持久化、activation未完成 | `authority_committed=1 / acceptance_committed=0` | existing safe reconciliation可激活；不得重复消费authority |
| activation完成 | 两marker均为1 | 进入既有QUEUED/claim生命周期 |

所有false/exception分支必须有精确负向测试。没有可查询、幂等、durable的authority commit receipt前，禁止把commit-before-marker窗口称为“同一acceptance crash recovery”。

### Closed schema contract

唯一净 schema delta 仍为新增 `decree_jobs.claim_evidence_commitment_json TEXT NULL`，但exact-old不得用产生`909b62c7...`的持久单条ALTER形态。initializer必须先用纯文件读取建立稳定、只读的隔离快照probe：复制目标主库及当时已存在的`-wal/-shm/-journal`字节到POSIX临时目录，复制前后分别记录并复核源文件集合、size、mtime、inode与SHA-256；任一集合或摘要变化立即按unknown失败关闭。probe只在隔离副本上打开SQLite并计算完整identity，不得打开目标SQLite connection、创建目标sidecar或授权DDL。probe为unknown时直接拒绝；probe为exact-new时仅在双快照稳定且完整identity为`8b38...`后零写返回。probe为fresh empty或三种supported migration shape时，才允许打开不设置WAL的目标validation connection；在`BEGIN IMMEDIATE`前设置并读回connection-local、nonpersistent的`PRAGMA foreign_keys=ON`与`PRAGMA legacy_alter_table=OFF`，任一不等立即STOP，随后在第一次目标schema/shape读取前执行`BEGIN IMMEDIATE`。dispatch必须在该锁内从零复算完整identity；probe结果不得授权任何DDL，只有锁内identity可授权bootstrap/migration。supported migration与canonical-new重验必须在同一connection/transaction内完成。allowlist判定前禁止任何persistent PRAGMA、DDL或DML，退出closed transaction后普通runtime connection才允许设置WAL。dispatcher精确允许fresh empty bootstrap sentinel加四种existing shape：exact-new、exact-old、最早parent-only predecessor、pre-authority parent-only predecessor；empty只能一次生成exact-new。

closed schema identity算法冻结为：查询 `sqlite_schema` 的 `type,name,tbl_name,sql`，排除`sqlite_%`并按`type COLLATE BINARY,name COLLATE BINARY`排序；SQL只允许CRLF/CR转LF并trim外层空白，禁止大小写折叠、内部空白压缩或删除collation/FK/CHECK。唯一JSON record schema为：

```text
{
  applicationId: INTEGER,
  foreignKeys: { TABLE: [{id,seq,table,from,to,onUpdate,onDelete,match}] },
  indexes: { TABLE: [{seq,name,unique,origin,partial,xinfo:[{seqno,cid,name,desc,coll,key}]}] },
  objects: [{type,name,tableName,sql}],
  tableXinfo: { TABLE: [{cid,name,type,notNull,defaultValue,pk,hidden}] },
  userVersion: INTEGER
}
```

其中`TABLE`是表名作为JSON object key；SQLite INTEGER编码为JSON number，NULL编码为JSON null，其余字段编码为JSON string。`objects`按`type,name`的UTF-8/BINARY序；每个`tableXinfo` array按`cid`升序；`foreignKeys`按`id,seq`升序；`indexes`按`name`的UTF-8/BINARY序（name相同再按`seq`），每个`xinfo`按`seqno`升序；table-keyed object由RFC8785按key canonicalize。字段映射逐字对应：`sqlite_schema.tbl_name→tableName`，`table_xinfo(cid,name,type,notnull,dflt_value,pk,hidden)→(cid,name,type,notNull,defaultValue,pk,hidden)`，`foreign_key_list(id,seq,table,from,to,on_update,on_delete,match)→(id,seq,table,from,to,onUpdate,onDelete,match)`，`index_list(seq,name,unique,origin,partial)`与`index_xinfo(seqno,cid,name,desc,coll,key)`对应同名camelCase record。对该record做RFC8785 canonical UTF-8 SHA-256。冻结identity为：

- fresh empty：`sha256:0c346e52fa80d30e8948d709d7e83d84389c51ec195a866f44bd874fb414fb51`
- exact-new：`sha256:8b38c49b719aa2a758ba037eb436d6fdf97db50e0a4b8cabd874b1a20f3059c2`
- exact-old：`sha256:aa2938733179612f5d4decd4f5e363be7dafaee5d38128273fef9f24eea3f027`
- earliest parent-only predecessor：`sha256:8632c03d798b1a3ac0e5e2774d8d64c4af7d1c734b0b95b2d2d3465b9b3e1124`
- pre-authority parent-only predecessor：`sha256:dbfd9074ca92d0538f97e63320360bff1ba38d634afa892e0bf5cb00d8d5cffc`

unknown view/generated/collation/FK/CHECK/STRICT/index/trigger/partial-new全部拒绝；必须覆盖目标处于DELETE与WAL journal mode、WAL sidecar存在与clean-shutdown后缺失的unknown矩阵，拒绝前后database bytes、journal mode和`-wal/-shm/-journal` sidecar集合、bytes与摘要必须不变。snapshot/probe只能产生拒绝或允许进入锁内重验的分类，不得授权DDL；exact-new的零写快速路径也必须证明两次源快照集合与摘要稳定。上述identity任一不能由测试fixture机械复算即STOP，不得临时扩充allowlist。

### Exact-old canonical rebuild

输入必须精确为 `aa2938733179612f5d4decd4f5e363be7dafaee5d38128273fef9f24eea3f027`；`909b62c7a3138562a17531666e137e212a974fe06cdbadd6f1693ec925206973`只记录为被拒绝的单ALTER中间观察值，绝不进入persistent allowlist。exact-old在同一`BEGIN IMMEDIATE`事务中必须：

1. 冻结parent/child全部logical rows、row counts、binary主键顺序、markers、typed metadata与owner/key/request/job mapping。
2. 先将`main.decree_job_idempotency_keys`重命名为保留名`__ct_p10b1_decree_job_idempotency_keys_old`，再将`main.decree_jobs`重命名为保留名`__ct_p10b1_decree_jobs_old`；所有DDL/DML必须使用`main.`全限定名，开始前断言两个保留名在`main.sqlite_schema`与`sqlite_temp_schema`均不存在，且`sqlite_temp_schema`不得参与名称解析。禁止让SQLite自动改写后的临时FK成为最终事实源。
3. 按冻结exact-new raw SQL创建canonical parent与canonical child。
4. 从`main.__ct_p10b1_decree_jobs_old`复制全部旧列并对新增commitment显式写SQL NULL；从`main.__ct_p10b1_decree_job_idempotency_keys_old`复制全部mapping。
5. 先删除`main.__ct_p10b1_decree_job_idempotency_keys_old`，再删除`main.__ct_p10b1_decree_jobs_old`；最终`main.sqlite_schema`与`sqlite_temp_schema`均不得残留保留名。
6. 提交前断言`foreign_key_check`为空、parent旧列projection的RFC8785 canonical bytes与原输入逐字节不变、parent/child counts不变、mapping/markers/typed metadata不变、commitment non-null count为0、exact object set闭合且identity精确为`8b38c49b...`。
7. 任一duplicate、mapping mismatch、FK drift、故障注入或identity mismatch必须整体rollback；重启必须零DDL/DML。

负向与结构测试必须同时断言：parent rename后临时child FK精确指向临时parent；新child FK精确指向canonical parent；任何`legacy_alter_table`、FK target或rename顺序漂移均STOP。

两个parent-only predecessor仍按既有truth table迁移到同一canonical-new。fresh empty直接创建canonical-new；exact-new零写。任何成功分支的唯一输出identity均为`8b38c49b...`。

两个 supported predecessor 必须迁到唯一 canonical new shape：最早 shape补 provider limit、typed error、acceptance/authority与child mapping；pre-authority shape按 `authority=acceptance`，并只对`FAILED/CANCELLED`且为空的typed terminal metadata执行旧CASE backfill、保留已有非空值。精确truth table为：`error_stage`在`CANCELLED && attempt_count=0`时为`queue`，其他terminal为`execution`；`error_category`依次为`CANCELLED→cancelled`、`provider_budget_exceeded→budget`、`deadline_exceeded→deadline`、`retry_exhausted→retry`、`provider_%→provider`、其他terminal→`internal`；非terminal空值保持NULL。迁移事务提交前重验 canonical new 与行/mapping不变量，提交后新连接重启必须零写。

### Forward sequence

本 successor 仍只形成不可提交 shadow。目标 backend-full 失败只允许 runtime schema closed digest 与 readiness ordered pair 两类 prerequisite；出现 crash recovery、API、worker、P10-A或其他第三根因立即停止。冻结 exact8 bundle、新 schema digest、65-path runtime fingerprint和successor fingerprint后，放弃本 shadow authority，签发 exact6 compatibility prerequisite；exact6落地后再签 final exact8。

本 shadow approval的machine verification故意包含raw backend-full与readiness命令，因此在两个prerequisite尚未落地时不能产生可通过的product child；不得跳过或包装成成功。新approval普通FF后必须只读证明remote离开前序`077834707...`，并依赖现有product-authority remote-head fence与12项回归机械证明旧task不能再次授权；禁止为了取证而重试已放弃的旧authority。

P10-B2 commitment writer是后续独立successor：必须另获machine authority并冻结新的tenant-aware schemaVersion，绑定canonical Tenant Principal、owner、job、request、draft、commitment digest与lifecycle revision。owner-only v1永不写入、激活或冒认tenant binding；B2 CAS必须禁止acceptance pending、authority reservation/commit、`RUNNING / RESULT_READY / ARCHIVING / PUBLISHING`及任何外部side-effect窗口，并将writer与`backend/app/api/decrees.py`接入点一并纳入届时冻结范围。

## Acceptance Criteria

- [ ] Shadow 精确 `0 ADD + 8 MODIFY`、全部 `100644`、无第九路径、永不 product commit/push。
- [ ] 前序 staged-handoff authority 保持 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`；早期8-path shadow只允许逐项选择性参考语义／字节证据，staged 7-path shadow只保留矛盾发现证据且不得作为byte donor，两者均无candidate／验证／authority继承身份。
- [ ] 新approval FF后远端不再等于前序approval；现有remote-head fencing回归全绿，且不重试旧authority。
- [ ] exact8 shadow 的六项 crash-recovery回归恢复全绿，且不存在 authority consumed without durable intent。
- [ ] preexisting non-null 在 reserve前固定503且registry零事件；任一明确storage boundary观察到non-null后固定失败关闭，不对未观察到的post-preflight rogue interleaving宣称原子性。
- [ ] reservation release false/exception、commit-before-marker和marker-before-activation的状态／崩溃矩阵均按上表fail-closed。
- [ ] exact-old以canonical parent+child transactional rebuild实现唯一净`+1 nullable column`，输入`aa293...`、输出`8b38...`；`909b...`永不成为persistent allowlist。
- [ ] exact-new通过稳定双快照probe实现目标零写restart；fresh bootstrap、两个predecessor canonical迁移及完整raw schema闭合均有负向证据。
- [ ] unknown schema在DELETE/WAL及sidecar存在／缺失矩阵中拒绝；目标database、journal mode与sidecar集合／bytes／摘要保持不变，probe不得授权DDL。
- [ ] storage/worker/API 的 existing-row mutation 与claim均以 `IS NULL` CAS和rowcount失败关闭；新INSERT显式SQL NULL。
- [ ] P10-A、focused、Ruff全绿；raw backend-full/readiness machine matrix因两个冻结prerequisite保持STOP，且不存在第三根因。
- [ ] Governance、Python与Security独立审查均无P0–P2。

## Delivery Constraints

- 单一 shadow字节写入者；审查者只读。
- 不修改第九路径、P10-A、runtime registry、readiness validators、Harness、authority、锦衣卫、史馆、executor、graph、archive、runtime report或前端。
- 不增加canonical-new之外的净新表、索引、trigger、数据库、依赖、环境flag、第二ledger、第二authority或non-null writer；允许exact-old与supported parent-only migration在同一事务内创建canonical parent/child和临时rebuild对象，但临时对象必须在提交前清除，最终object set精确等于exact-new。
- 不删除或改写 crash-recovery门禁，不把 direct admin DB tampering 假装成 B1 可跨系统原子化能力。
- 远端漂移、machine STOP、第三类backend-full根因、独立审查P0–P2或需要扩大范围时立即STOP。

## Affected Modules

- 模块：真实旨意接受 API、owner DecreeJob API、model、SQLite closed schema/migration/read-write guard、worker defense-in-depth及三套现有测试。
- 允许路径：`backend/app/api/decree_jobs.py`、`backend/app/api/decrees.py`、`backend/app/decree_jobs/models.py`、`backend/app/decree_jobs/storage.py`、`backend/app/decree_jobs/worker.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_decree_job_worker.py`、`backend/tests/test_decree_jobs_api.py`。

## Technical Plan

从新 machine GO 后在全新shadow选择性重新实现decoder、canonical rebuild、SQL NULL guards、fixed 503和worker defense；拒绝前两代shadow的transaction guard、单ALTER持久形态与格式化噪声。先证明现有六项async crash tests保持GREEN，再补preexisting/boundary观察、五态schema dispatcher、exact-old canonical rebuild、crash rollback、duplicate/mapping/FK/collation/typed-metadata负例。实现只允许最小staged preflight与storage CAS。focused/P10-A/Ruff通过后跑POSIX backend-full并机械归类失败；仅两类prerequisite才冻结身份。

## Implementation Report

更早 exact8 shadow 的 focused 232项、P10-A 42项和Ruff曾通过；随后 backend-full为 `4433 passed, 4 skipped, 51 failed`，其中44项为runtime schema prerequisite cascade、1项为readiness pair、6项为single-transaction真实async crash回归。staged-handoff successor随后取得machine GO，但在实现前复算发现`aa293 --ALTER→909b != 8b38`；其七路径未提交证据立即停止。两代前序均无candidate commit/push。

## Acceptance Review

待三文件治理包校验与独立审查。本文件不授权产品实施、candidate、Pilot、Release或部署。
