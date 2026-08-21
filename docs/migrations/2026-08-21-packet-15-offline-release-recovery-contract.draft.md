# Packet 15 — Offline Release / Recovery Runtime 合同草案

> 状态：`CONTRACT_AMENDMENT_DRAFT / NONAUTHORIZING / PRODUCT_STOP`
>
> Packet：`packet-15-offline-release-recovery`
>
> 能力：`release-backup-offline-verification-runtime`

本合同只定义 ext-dev 的可复现构建、SQLite 安全备份、空目录恢复演练、离线发布包验真和
RC1 合成验收能力。它不授权产品实现、commit、push、镜像拉取/加载、部署、生产停写、
生产备份、生产恢复、密钥读取、DNS/TLS/防火墙变更或真实业务网络。

## 1. 冻结身份与处置

- 唯一目标：`gitee.com/msxn/chaotang-os:origin/ext-dev`。
- 当前 follow-up amendment evidence base：`3f794c07763802ac95fb6b8548f17f0bcd857f12`。
- 当前 follow-up amendment evidence base tree：`c9f484dbaac34ddf9984d5548e12a8cbf3a8d4bf`。
- 上一版 amendment contract SHA-256
  `28b60ff5fd97f2095d028f0522fd5124be60bd7d8757281351703becc112e37c` 已以单文件治理提交
  `3f794c07763802ac95fb6b8548f17f0bcd857f12` 落地；生成新 M0 三件套时发现现有
  product-authority 不会向未知未来 candidate 注入 commit/tree/work-root 参数，因此该版只保留审计证据，
  不得据此生成产品授权。本 follow-up 只更正验证器/authority 接口语义和对应计划文字，不扩大 26 条产品路径。
- V2 推荐处置：`REBUILD`。
- V2 证据：51 个 semantic review units；`eligibleDonorSourceCount=0`；状态
  `PROPOSED_NOT_AUTHORIZED`。
- 旧 P15 approval digest `sha256:1d793aee2ef1b214874fc440524020ee2d40a4fd5b920a689916b996bf8c8acf`
  已在首次候选 verification 中暴露不可执行合同循环，治理结论固定为 `AMENDMENT_REQUIRED / PRODUCT_STOP`；
  本 amendment evidence commit 一旦落地，旧 approval 因不再是远端精确头而自动失效。
- P15 amendment evidence base 已包含获 Owner 接受并推送的 P09-A exact commit
  `91e2c986509b1abb5c15d0a05a5268c9cae7b6ff`、tree
  `a16d9f01c5264a05099391aa0066f1b699dd9c59`、`chaotang.release-evidence.v2` schema SHA-256
  `250d2c7df7f4c8f53b4198e8b7a72c0ebf106b3e32a89dee172b5a56657b1fa6` 与 verifier SHA-256
  `f001d50ef4c03bb16aaf51f91531b78651121147cb2ee9e78af9a8a24f8f1e99`；P09-A 只验证 evidence descriptor，
  不因此获得构建、备份或部署权限。

首选历史语义 donor：

- commit：`dd28a1c133f0c0327086ded8006998d22163f1bd`
- tree：`a274c2356b66928cdb73ce9002a07918a75036f5`
- parent：`639e8186790877898d2883be58fd41894ea45ea3`
- subject：`fix(release): close RC1 release blockers`

该 donor 不是 `origin/ext-dev` 的祖先，且它的全量验证后来暴露 installed metadata、可信
wheelhouse 与验证环境冲突。两个后继 RC1 product worktree 仍含未提交/混合状态，V2 将其
分类为 `BLOCKED_WIP`。因此：

1. 不 merge/cherry-pick `dd28a1c`。
2. 不复制任一 RC1 worktree 整树或 staged index。
3. 只把安全备份、闭合 manifest、离线 verifier、loopback 部署和合成 runner 的语义作为
   `REBUILD` 输入；每个字节重新适配当前 ext-dev。
4. `frontend/scripts/system-restore.sh` 等历史直接恢复脚本不进入本 Packet；生产 restore
   永远是另行授权的运维动作。

## 2. 当前 RED 与用户价值

当前 ext-dev 已有 substantive 产品，但不能据此称为可恢复发布：

| 当前事实 | RED |
| --- | --- |
| `deploy/compose.yaml` 暴露 80/443，`deploy/Caddyfile` 绑定域名/TLS | 与 accepted `docs/decisions/0041-single-host-container-deployment.md` 的 `127.0.0.1:8080 + SSH tunnel` 冲突 |
| `scripts/check_deployment.mjs` 对当前公网形状返回 0 | checker 正在证明错误的部署合同 |
| 无 `backend/app/operations/sqlite_backup.py` | 无 SQLite API 一致快照、验真和空目录恢复演练 |
| 无 `backend/requirements-runtime.lock` | Docker 构建会从宽范围依赖在线解析，不能证明重现 |
| 无 offline builder/verifier/RC1 runner | 无离线包、内容摘要、合成恢复和连续验收证据 |
| 旧 donor 只登记 6 个数据库 | 当前 ext-dev 新增 `runtime_bindings.sqlite3`，旧 registry 会静默漏数 |

用户价值：上线测试前能够回答“运行的是否就是被批准的代码、数据是否可恢复、离线包是否被
篡改、失败时能否回到上一版本”，而不是只看到健康页 200。

## 3. 非目标与权限边界

本 Packet 不做：

- 新页面、发布控制台、备份服务、制品数据库、第二流水线或自动部署器；
- 业务 API、六部/39司、模型、provider、证据、史馆或会计业务行为变更；
- 数据库 schema migration 或原地 restore；
- 生产主机目录、systemd、secret、域名、证书、DNS、防火墙或公网端口变更；
- Docker registry push、bundle upload、生产 `docker load/up/down`；
- 真实模型、MCP、行情、付费 API 或用户数据外传；
- 从 dirty worktree、用户 site-packages、浮动 tag 或预制 PASS 日志宣称通过。

产品实现、候选 commit、外部验证环境、构建期受限读取网络、push、部署、生产备份和生产恢复
是彼此独立的 authority；前一步授权不蕴含后一步。

## 4. 当前运行数据事实源

### 4.1 Closed Runtime Data Registry v2

`backend/app/operations/runtime_data_registry.py` 是 readiness、backup、release manifest 和测试共同
消费的唯一 closed registry 事实源；其它模块不得复制第二份名称/版本/artifact-root tuple。
P15 必须显式登记当前 7 个 SQLite logical stores：

| name | exact user_version | 主要 owner/内容 | 附属文件根 |
| --- | ---: | --- | --- |
| `decree_jobs.sqlite3` | 0 | 异步任务、幂等、checkpoint | `null` |
| `jinyiwei.sqlite3` | 5 | 调查、来源尝试、采用状态 | `null` |
| `junjichu_cases.sqlite3` | 0 | 军机处 case ledger | `null` |
| `qintianjian.sqlite3` | 0 | 预测与复盘 | `null` |
| `report_artifacts.sqlite3` | 0 | 会计产物/WorkProduct/确认回执 | `report_artifacts/` |
| `runtime_bindings.sqlite3` | 0 | 六部 RuntimeSkill append-only scope bindings | `null` |
| `shiguan.sqlite3` | 5 | 用户、会话、档案、复盘、每日奏报 | `null` |

`auth` 与史馆共享 `shiguan.sqlite3`，不得伪造第八个 auth 数据库。除 SQLite `-wal/-shm`
sidecar 与唯一 `report_artifacts/` 外，数据根出现未知 entry 必须失败关闭；不能静默跳过。
现有 local-mode 凭据默认目录 `data/credentials/` 明确不属于运行数据 registry，也不得进入
backup/bundle/manifest。生产只能使用容器外 secret/env 注入；若 source root 出现 `credentials/`
或其它敏感/未知 entry，observer 只返回稳定 `sensitive_entry_present` 并停止，禁止遍历、计数或
摘要其内容。迁移凭据到外部 secret 是独立运维权限，不由 P15 自动执行。

`backend/app/readiness.py` 必须从该 registry 派生版本/结构检查，并补上
`runtime_bindings.sqlite3` 的 append-only table/trigger contract；backup 同样从该 registry 构造
manifest。若 readiness、backup 和 release manifest 观察到的 registry digest 不相同，立即 STOP。

registry 是闭合 tuple，不是运行时扫描结果。顶层 exact fields 为
`schemaVersion, entries, registryDigest`；`schemaVersion` 固定
`chaotang.runtime-data-registry.v2`。每个 entry 的 exact fields 为
`name, relativePath, userVersion, requiredTables, requiredTriggers, schemaContractDigest, artifactRoot`，
按上表顺序冻结；
`artifactRoot` 只能是 `null` 或 `report_artifacts`。`registryDigest` 等于
`sha256:` + 排除自身后的完整 registry RFC 8785 canonical JSON 的 lowercase SHA-256。
readiness、backup、release manifest 只能 import 同一 registry 及其 digest，不得接受调用者覆盖、
环境变量追加或目录扫描生成的第八项。七个 entry 的 requiredTables/requiredTriggers 必须分别枚举当前
base 的完整运行 schema，不得只登记 runtime bindings。`schemaContractDigest` 使用 `sha256:` +
RFC 8785 canonical `{schemaVersion:"chaotang.sqlite-schema-contract.v1", userVersion, tables, triggers,
indexes, foreignKeys, columns}`；集合按 name/ordinal 排序，包含完整类型、not-null、default、PK/unique/
foreign-key 与 sqlite_master SQL。SQL canonical text 只做 `CRLF→LF`、删除首尾 ASCII whitespace，内部
bytes 不改写；空/NULL 或不同 bytes 均不等价，不使用方言 parser 自行重排。P15 M0 approval 必须冻结七个 literal digest，source、backup
verify、rehearse、readiness 使用同一 descriptor 重算；低于或高于 exact userVersion、缺/多任一 schema
对象或 constraint 均失败关闭。`runtime_bindings.sqlite3` 摘要中的 table 包含
`runtime_resource_bindings`，triggers 包含 `runtime_bindings_no_update, runtime_bindings_no_delete`。
`/readyz` 的既有公开 body 保持 byte-compatible；digest 只进入内部
readiness result、backup manifest 与 release manifest，不新增公开运维细节。

每个 registry entry 的 presence 必须显式为 `PRESENT` 或 `ABSENT`。当前应用存在惰性建库：
合法未使用能力的 DB 可以不存在，但 manifest 必须记录 ABSENT；恢复演练必须保持不存在。
未知 DB、非 exact user_version、已登记 DB 被目录/链接/特殊文件替代均拒绝。

### 4.2 Readers / writers

- 唯一业务 writer：单 backend 容器/单 Uvicorn worker；SQLite 多副本不在当前架构内。
- `shiguan.sqlite3` 同时由认证、史馆和每日奏报写入。
- `report_artifacts.sqlite3` 与 `report_artifacts/` 必须按同一快照合同核验；PUBLISHED 文件按
  数据库 `file_sha256` 一一对应，未引用/缺失/临时/孤儿内容不得混入备份。
- `runtime_bindings.sqlite3` 是 append-only 执行绑定；不能因 readiness 旧清单未登记而漏备份。
- verifier/rehearsal 全程只读 source/backup；rehearsal 只写全新空目标。

## 5. SQLite 备份、验证与恢复演练

### 5.1 两种模式

`sqlite-backup.v2` 只允许：

1. `ONLINE_PER_DATABASE`：逐库使用 `sqlite3.Connection.backup` 取得各自一致快照；允许业务继续写，
   但 manifest 必须记录每库 capture start/end，明确**不声称跨数据库同一时刻一致**。只能作日常
   可恢复快照，不能单独作为发布回滚点。
2. `COLD_RELEASE`：调用者先在本工具之外停止唯一 backend writer，并提供由受控 runner 产生的
   stopped-container identity。受控 runner 必须在停止 writer 前取得 rollout/backup 独占锁，并在 stop 前
   建立同一条 Docker events 持续连接，连续观察到 capture 与 manifest materialize 前的完整内容验证完成；工具在整个 registry 与 artifacts 复制前后验证
   writer remains stopped、data-root identity 未漂移且期间无 start/restart/第二 writer；这是发布/不兼容
   回滚唯一可接受模式。

   `verify_backup` 与 `rehearse_restore` 是 manifest 落盘后的只读消费阶段，不纳入上述 events stream 的
   时间窗，也不得冒充其组成部分。受控 runner 在这两个阶段继续持有同一 rollout lock，并在前后重验
   container/daemon/data-root/第二 writer；不得要求 manifest 内的 `streamCompletedAt` 晚于 manifest
   `capturedAt`。这是 v2 的唯一可执行时序。

工具本身不得停止生产进程，也不得把“未观察到 WAL 变化”解释为已经停写。

### 5.2 输入与文件系统安全

- source root 必须是显式 absolute canonical directory；destination 必须不存在，且不得位于 source
  内或与 source 重叠。
- destination parent 必须已存在、受当前 owner 控制、非 symlink；创建使用 O_EXCL/O_NOFOLLOW
  等价语义，权限默认 0700，文件 0600。
- 根与每个 entry 在打开前、打开后、读取后按 `(device,inode,type,nlink,size)` 重验。
- 拒绝 symlink、hardlink、FIFO、socket、device、路径穿越、大小写冲突、重复 entry、未知文件。
- SQLite WAL/SHM 只用于 SQLite API 读取一致提交页；不得原样复制到备份。
- 任一失败只清理本次工具创建且身份仍匹配的目标；不 glob、不递归删除调用者已有路径。
- 在 materialize 前执行 closed budget：7 个 registry entries；每库 `page_count*page_size <= 8 GiB`，
  七库合计不超过 32 GiB；artifact 不超过 100,000 项、单项 2 GiB、合计 32 GiB；目标总写入不超过
  64 GiB，单次 capture+pre-manifest content verify 最长 30 分钟。先用只读 PRAGMA 与稳定 artifact metadata 计算上界，
  `statvfs` 可用空间必须至少为上界 + 1 GiB safety reserve。
- destination 内使用 O_EXCL/O_NOFOLLOW 创建 0600 reservation file 并以 `posix_fallocate` 真正预占上界；
  每个已 fsync+身份重验的目标文件只释放其 exact 已占空间，失败时只释放本次 reservation。稀疏文件、
  truncate 或仅比较 free-space 数字不能冒充预占。
- 捕获前后都重扫 data-root exact entry/presence shape。COLD_RELEASE 任一 metadata/content 漂移立即失败；
  ONLINE_PER_DATABASE 若并发写导致 registry presence、report artifact ref/inventory 或稳定身份漂移，只能
  从新空目标有界重试，最多 2 次，仍漂移即 BLOCKED；未知/敏感 entry 永不重试或忽略。

### 5.3 Manifest

`chaotang.sqlite-backup.v2` 使用 duplicate-key rejecting parser 和 RFC 8785 canonical JSON。
顶层 exact fields：

`schemaVersion, mode, sourceSnapshotIdentity, sourceRootIdentity, capturedAt,
writerStopEvidence, databases, artifacts, manifestDigest`。

- 所有 digest 使用 `sha256:<64 lowercase hex>`。
- `manifestDigest` 覆盖排除自身后的完整 canonical manifest。
- `ONLINE_PER_DATABASE` 时 `writerStopEvidence` 必须精确为 `null`；非 null 立即拒绝，且 manifest
  不得出现“全局一致”或“发布回滚点”声明。
- `COLD_RELEASE` 时 `writerStopEvidence` 必须是 exact closed object：
  `schemaVersion, runnerSessionId, backendContainerId, backendImageDigest,
  rolloutLockIdentity, eventStreamSessionId, daemonIdentity, streamStartedAt, expectedStopEvent,
  stoppedWatermark, streamCompletedAt, postStopWriterEvents,
  stateBefore, observedAtBefore, stateAfter, observedAtAfter,
  dataRootIdentityBefore, dataRootIdentityAfter, evidenceDigest`。
  `schemaVersion` 固定 `chaotang.writer-stop-evidence.v1`；`runnerSessionId` 是 lowercase canonical
  UUID；container id 是 64 lowercase hex；image digest 使用 `sha256:` 格式；两个 state 均只能是
  `STOPPED`；两个 data-root identity 都是 exact object `device,inode,type`，type 只能是
  `DIRECTORY`，并且三字段 exact 相等。时间为 canonical UTC，且
  rolloutLockIdentity 是 exact `device,inode,uid,mode,nlink,lockDigest`，锁文件位于 owner-controlled
  canonical rollout root，使用 O_NOFOLLOW/O_CLOEXEC + flock exclusive，锁后 fstat/path inode 重验并保持
  fd 到 standalone verify/rehearse 完成。eventStreamSessionId 是本次进程内 UUID；daemonIdentity 绑定 daemon ID/API version；
  stream 必须在发 stop 前已收到可验证握手并保持同一连接，不允许重连。expectedStopEvent exact fields 为
  `containerId,imageDigest,action,timeNano,eventDigest`，action 固定 `die`；stream 在 stop 前到
  stoppedWatermark 之间必须恰有这一条目标 writer die，缺失、重复、container/image 不匹配或同 timeNano
  歧义均失败。`postStopWriterEvents` 只覆盖确认 STOPPED 后至 manifest materialize 前完整内容验证完成的
  start/restart/die，必须为空。standalone verify/rehearse 只消费已封闭备份，并由 runner 的同锁前后
  identity 重验约束；不声称同一 events connection 覆盖这两个后置阶段。
  Docker 没有 durable monotonic cursor，本文不声称跨连接 gap proof；任何 EOF、parse loss、backpressure
  overflow、reconnect、daemon identity 漂移、lock loss、目标 restart 或同 data-root 第二 writer 出现立即失败。
  `lockDigest` 是 RFC 8785 canonical `{schemaVersion:"chaotang.rollout-lock-identity.v1",
  runnerSessionId,device,inode,uid,mode,nlink}` 的 SHA-256；`eventDigest` 是 RFC 8785 canonical
  `{schemaVersion:"chaotang.docker-writer-event.v1",containerId,imageDigest,action,timeNano}` 的 SHA-256。
  `timeNano` 与 stoppedWatermark 的纳秒值必须是 regex `^[1-9][0-9]{0,18}$` 且
  `<=9223372036854775807` 的 canonical decimal string，
  禁止 JSON number、前导零、符号、小数或指数；只用 lossless BigInt 比较，并通过整数除法得到 seconds/
  nanoseconds 后与 RFC3339 UTC 时间交叉验证。相邻纳秒碰撞、超 64-bit、有前导零/指数或时间不一致拒绝。
  将 canonical UTC 时间按 Unix epoch 纳秒无损转换为 BigInt 后，必须满足
  `epochNs(streamStartedAt) < BigInt(expectedStopEvent.timeNano) <= BigInt(stoppedWatermark)
  <= epochNs(observedAtBefore) <= 每个 database/artifact capture time
  <= observedAtAfter <= streamCompletedAt <= capturedAt`；
  stoppedWatermark 早于 die、晚于 observedAtBefore、越出同一 event stream observation window，或与
  RFC3339/`timeNano` 交叉验证不一致均失败；负测必须覆盖这三类越界。
  `capturedAt` 是 capture 与 writer-stop evidence 完全封闭后的 seal time：它必须在 manifest canonical
  serialization/materialization 前由 runner 取得，不冒充跨库 snapshot instant，也不冒充 manifest 自身物理写盘
  完成时间。若需记录 manifest fsync 完成时间，只能写入 manifest 外、绑定 manifestDigest 的 runner receipt；
  该 receipt 不参与 manifestDigest，不能反向改写 manifest。`evidenceDigest` 覆盖排除自身后的完整对象。
  该对象只能由另行获权的 runner 在停写前后真实观察生成；backup 不得自行停止容器、伪造
  STOPPED 或接受调用者 free-form attestation。
- `sourceSnapshotIdentity` 覆盖 mode、source root identity、按 registry 顺序的 database presence/
  metadata/digest、按 UTF-8 relative path 排序的 artifacts 和 capture timestamps，排除自身。
- PRESENT database 记录 logical name、relative path、bytes、SHA-256、user_version、
  `PRAGMA integrity_check`、capture start/end；ABSENT 只能记录 name/presence。
- artifact 记录 relative path、bytes、SHA-256、所属 artifact_id 与 capturedAt；不记录绝对路径、
  用户名、secret 或 workbook 内容。artifact capturedAt 是成功完成该文件稳定身份重验后的时间。
- RFC3339 canonical time 一律 UTC 六位微秒 `Z`；任何 naive/future/逆序时间拒绝。

### 5.4 Verify / rehearse

- `verify` 只读 backup，重算 closed manifest、每库 SHA/integrity/user_version、每个 artifact hash/
  引用和全部目录 identity；拒绝缺、多、篡改或非 canonical bytes。
- `rehearse` 只接受不存在的新目录，复制并重建同一 presence shape；完成后重新执行 verify，并
  证明 restored snapshot identity 与 backup 一致。
- 不提供 `--in-place`、`--force`、`--overwrite` 或 production 默认路径。
- 真正生产 restore 必须另有 authority，且只能消费与上一 immutable release 精确绑定的
  `COLD_RELEASE` backup；本 Packet 的自动测试只使用脱敏合成数据。

## 6. 运行依赖与镜像身份

- `frontend/package-lock.json` 仍是前端唯一依赖锁。
- 新增 `backend/requirements-runtime.lock`，其内容是 duplicate-key rejecting、RFC 8785 canonical JSON，
  schema 固定 `chaotang.python-runtime-lock.v1`，exact fields 为 `schemaVersion, pythonVersion,
  targetPlatforms, pyprojectDigest, buildRoots, runtimeRoots, testRoots, distributions, lockDigest`。每个 root exact fields 为
  `requirement,normalizedName,specifier,extras,marker`；`requirement` 是绑定 pyproject 中对应 PEP 508 项的
  exact UTF-8 字符串，另外四项是其确定性解析投影，extras 排序且去重。`buildRoots` 绑定
  `[build-system].requires`，`runtimeRoots` 绑定 `[project].dependencies`，`testRoots` 绑定
  `[project.optional-dependencies].dev`，三者都必须 complete/exact。distribution exact fields 为
  `normalizedName, version, requiresPython, scopes, dependencyEdges, wheels`；`scopes` 是从
  `BUILD/RUNTIME/TEST` 取值的非空、去重、按该固定顺序排列数组；每个 dependency edge exact fields 为
  `targetNormalizedName,specifier,marker,extras`，按 target/specifier/marker/extras 排序，target 必须解析到
  同 lock 的 exact distribution，且 resolved version 必须满足 specifier。wheel exact fields 为
  `filename, sha256, pythonTags, abiTags, platformTags, metadataDigest`。名称按 PEP 503 将 ASCII lowercase
  的连续 `[-_.]` 规范为单个 `-`，规范名必须唯一；distribution 与 wheels 分别按 normalizedName/filename
  排序，roots 是规范名 UTF-8 set。marker 只允许由 wheel METADATA 产生的 PEP 508 expression，并针对
  exact Python/platform/extras 在 verifier 中确定性求值；禁止 lock 调用者自定义 marker、直接 URL、VCS、
  editable、sdist 和重复 distribution。
- verifier 必须解析 wheel filename/tag，并从 wheel 内 METADATA 重验 normalized Name/Version 与
  metadataDigest、Requires-Python、Requires-Dist/specifier/marker/extras；只允许与 exact Python minor、ABI、architecture/platform
  匹配的 wheel。`pyprojectDigest` 绑定完整 `backend/pyproject.toml` raw bytes；buildRoots 必须与
  `[build-system].requires` 的完整 PEP 508 投影 exact，runtimeRoots 必须与 `[project].dependencies` 的完整
  PEP 508 投影 exact。对每个目标平台分别求值 root marker/extras，所有 active root 的 resolved version 必须
  满足 specifier；每个 active distribution 的 `requiresPython` 必须接受 exact target Python。对每个目标平台分别
  从 roots 遍历 active edges，build/runtime/test closure 必须完整且无不可达多余 row；同一 distribution
  可由多个 scope 图引用，但 `scopes` 必须等于实际可达集合。
  wheelhouse 必须
  是 closed exact inventory，缺、多、symlink/hardlink/special/同名异 hash 全拒绝。
- wheel verifier 只读 ZIP central/local headers，不 extract 到磁盘：raw wheel 最大 8 GiB、entries 100,000、
  单 member uncompressed 8 GiB、总 uncompressed 16 GiB、compression ratio 200；唯一
  `<normalized-name>-<version>.dist-info/METADATA` 最大 4 MiB。拒绝 encrypted/multi-volume、duplicate/
  case-collision/path traversal/absolute/symlink/special、nested archive、central/local size/name mismatch、
  多余/缺失 METADATA；METADATA 流式读取到 4 MiB+1 即 STOP。zip bomb 与 duplicate METADATA 负测必须
  在 M0 no-network/no-daemon 层运行。
- 标准库-only verifier 落在 `backend/app/operations/runtime_lock.py`，以 duplicate-key rejecting parser
  验证 lock、pyproject raw digest、wheelhouse exact inventory、wheel/METADATA/closure。它只允许在 canonical
  `/tmp` 下用 verifier-owned `mkdtemp` 创建 mode 0700 的唯一新空工作根；创建后立即记录并重验
  `(device,inode,type,uid,mode,nlink)`，所有 BUILD/TEST/config/requirements 子根都必须位于该根内，清理时只删除
  本轮创建且身份仍 exact 的根。不得接受调用者任意 work root、复用已有目录、跟随 symlink，或读取用户 site、
  pip cache和网络。Docker build使用
  verified lock/wheelhouse 生成临时 requirements，并固定
  `pip install --no-index --require-hashes --only-binary=:all: --no-deps --find-links <verified-wheelhouse>`；
  builder 先只安装 hashed build closure，再以 `--no-build-isolation --no-deps` 构建应用 wheel；runtime stage
  只安装应用 wheel + runtime closure。build-only distribution 不得出现在 runtime image，除非同一 exact row
  `scopes` 同时含 BUILD/RUNTIME；运行镜像不得再读取宽范围 pyproject 解析依赖。runtime 不在线解析范围，不继承用户 site，
  不携带 pip/setuptools/wheel/build cache。
- `lockDigest` 等于 `sha256:` + 排除自身后的完整 `chaotang.python-runtime-lock.v1` RFC 8785 canonical
  bytes；pyproject、root、edge、wheel 或 target platform 任一变化都必须改变 digest。
- `/health.version` 只来自已安装 `chaotang-os-backend` distribution metadata；缺失/不匹配失败关闭，
  不回退读取源码 `pyproject.toml` 或 `0.0.0`。
- `deploy/images.env.example` 只接受 digest-pinned Node/Python/Caddy refs；实际版本/平台由 release
  manifest 记录并验证，不信任 tag-only 或环境隐式值。
- 前后端最终镜像必须记录 source commit/tree、created、platform 与 immutable digest。

M0 首先运行 lock/parser 的离线负例；candidate 身份锁定后，由另行只读网络授权把 exact wheelhouse
provision 到 root-owned、candidate 不可写的 `/var/tmp/chaotang-m0-wheelhouse`。机器 verification 由
`/usr/bin/python3 -I backend/app/operations/runtime_lock.py verify-candidate` 完成以下唯一流程：

1. 外层 product-authority 在调用 verification matrix 前后分别重算并钉住同一 clean candidate HEAD，且确保
   candidate 是 approval commit 的 exact single child；这是 candidate authority binding，不要求 authority
   注入一个在 approval 生成时尚不存在的 future SHA 参数。verifier 必须独立从 source root 的 Git object
   database 在开始/结束各重算 candidate commit/tree、parent与clean state，两次结果 exact，并把
   `candidateCommit,candidateTree,parentCommit` 写入 canonical stdout evidence；dirty、replace object、
   shallow/缺 object、非单亲或身份漂移立即 STOP。product-authority 对 stdout 取 digest并在每个 command
   前后再次验证 HEAD/clean，因此外层与内层共同形成唯一身份证明，不能由调用者覆盖 resolver或 expected identity。
2. 从已验证 wheelhouse 在 checkout 外的新空根创建 BUILD venv；所有 pip 子进程固定
   `--isolated --no-cache-dir --no-index --require-hashes --only-binary=:all:`，并使用空 HOME、
   `PIP_CONFIG_FILE=/dev/null`、空用户 config/cache。只安装 lock 的 BUILD closure。
3. 在该 BUILD venv 中以 `--no-isolation --no-deps` 从 exact candidate source 构建唯一 backend candidate wheel；
   wheel 的 METADATA/version/source commit/tree 与 candidate exact，生成 wheel digest并封入 verification evidence。
   wheelhouse 中同名 candidate wheel一律视为多余/陈旧输入并拒绝，不能替代本轮构建产物。
4. 在另一个 checkout 外新空根创建 TEST venv，以同一隔离 pip 规则安装 lock 的
   `RUNTIME ∪ TEST` closure和上一步唯一 candidate wheel；candidate wheel 使用 `--no-deps`，其运行依赖必须
   全部由已验证的 RUNTIME closure 提供。只装 TEST closure 而漏掉 runtime、或让 pip 从 candidate
   METADATA 在线/隐式解析依赖，均立即 STOP。不得把 source checkout、用户 site、宿主 site-packages 或
   pip cache加入 import path。
5. verifier 在 checkout 外新空根生成只含本合同固定 pytest 选项的 sanitized config；不得读取
   `backend/pyproject.toml` 的 `[tool.pytest.ini_options]`，尤其不得继承 `pythonpath=["."]`。使用 TEST venv 的
   `python -I -P -m pytest -c <sanitized-config> --rootdir <external-empty-root>
   --import-mode=importlib <exact source tests>` 运行 full pytest。verifier 同时从 checkout 外加载一个本轮生成、
   bytes固定的 provenance plugin，在 pytest 配置完成后的 `pytest_sessionstart` 再断言 `sys.path` 不含 source
   root、`app.__file__` 位于 TEST venv且不位于 source root，并重验 `importlib.metadata` 的
   `chaotang-os-backend` version、candidate wheel digest、commit/tree与本轮构建 evidence exact。Ruff由同一
   TEST venv对 exact source运行，但不得 import source作为应用版本事实。任何 config/plugin加载失败或分裂
   来源立即 STOP。

全程不访问网络，不读用户 site/pip cache，不回退宿主 Python 环境。registry read、SBOM/scanner DB 获取仍需
各自另行授权。缺 wheelhouse、inventory/hash/METADATA 漂移、candidate wheel身份不一致或隔离安装失败都必须 STOP。

## 7. 部署合同

Accepted `docs/decisions/0041-single-host-container-deployment.md`（base SHA-256
`1e27f11bd5fa033c0ac276eecbf3c379bddd78ba7a38aa1063a473f4359cfc49`）是唯一部署事实源；同编号的
decree ADR 与本 Packet 无关：

- 一个 Caddy、一个 frontend、一个 backend；backend 恰好一个 Uvicorn worker。
- Caddy 只发布 `127.0.0.1:8080:8080`；frontend 3000/backend 8000 不 publish。
- Caddy 使用 `:8080`、关闭自动 HTTPS；无域名、TLS、HSTS、80/443。
- 应用内部网络隔离；backend 可接专用 egress 网络但业务公网默认关闭。
- 全部容器 non-root、read-only rootfs、drop capabilities、no-new-privileges、固定健康检查、
  有界日志；data/accounting mounts 权限保持现状。
- `scripts/check_deployment.mjs` 必须拒绝当前错误的公网 80/443 + domain/TLS 形状以及 floating
  images、多 backend replica、默认 Docker socket、应用直出端口和额外 writer。

### 7.1 Closed operator inputs 与 runbook

`deploy/README.md` 只能调用同一受控 `run_rc1_release_acceptance.mjs`，不得教 operator 手工 stop 后传入预制
writer session。每次 COLD 流程必须从一个 duplicate-key rejecting、canonical
`chaotang.p15-operator-inputs.v1` object 读取 exact fields：

`schemaVersion, candidateCommit, candidateTree, releaseExpectationPath, releaseExpectationDigest,
verifierPath, verifierDigest, bundlePath, bundleDigest, immutableSnapshotPath, immutableSnapshotDigest,
dockerEndpoint, sourceRoot, backupRoot, rehearsalRoot, rolloutLockPath, backupPythonPath, backupToolDigest,
operatorRef, maintenanceWindowStart, maintenanceWindowEnd, inputsDigest`。

路径都必须是本次另行授权范围内的 absolute canonical path；root 不重叠且 backup/rehearsal target 必须不存在。
Docker endpoint 只能是本次 disposable-host authority 绑定的 endpoint；operatorRef 只作审计绑定，不证明权限；
maintenance window 使用 canonical UTC 且 start < end。`inputsDigest` 是排除自身后的完整 RFC 8785 canonical
object SHA-256。expectation/verifier/bundle/snapshot/backup tool 均在任何 stop/网络/daemon动作前重算 bytes/digest。

runner 必须在本轮进程内先取得 rollout lock、建立并验证 Docker events 连接，之后才允许 stop writer；
`writerStopEvidence`/session 只能由该 runner 本轮生成，禁止作为 operator input、环境变量、已有目录或 free-form
attestation 传入。所有 shell/runbook 示例使用 `env -i`，在 `set -u` 之前从已验证 object 显式赋值/export
所需变量；未声明变量、陈旧/预制 session、手工 stop 后伪造 session、输入 digest漂移必须在任何 stop 前失败。

未来公网域名/TLS 不是本 Packet 的“优化项”，而是新 ADR 与独立基础设施授权。

## 8. 离线 release bundle

### 8.1 Builder

`build_offline_release.mjs`：

- 只接受 clean、已获 M0 的 exact single-child candidate，并分成两个不可混淆模式：
  - `PRE_ACCEPTANCE_PROVISIONAL`：local candidate 是 live `origin/ext-dev` approval commit 的 exact child；
    远端必须仍停在 approval parent。只在新空临时根构建 provisional bundle/evidence，供独立 review 与 Owner
    判断；不得称 final、不得 deploy/push/upload，P09-B 不消费。输出 closed
    `chaotang.p15-provisional-receipt.v1`：`schemaVersion,candidateCommit,candidateTree,approvalDigest,
    toolchainDigest,sourceDateEpoch,runtimeLockDigest,configDigest,bundleDigest,verificationDigest,createdAt,
    receiptDigest`；receiptDigest 覆盖排除自身后的完整 RFC 8785 canonical object。
  - `POST_ACCEPTANCE_FINAL`：Owner 已接受并单独授权 push，live `origin/ext-dev` 必须等于同一 candidate；
    重新从 clean checkout 构建 final bundle，source/tree/locks/toolchain/SOURCE_DATE_EPOCH 必须与 provisional
    exact，final bundle digest 必须与 provisional exact，否则 Owner 接受失效并 STOP。
- PRE 模式运行现有 product-authority candidate verifier（其 remote 必须是 approval parent）。Owner
  acceptance 与 push authorization 是 P15 无法自行认证的外部治理权限前置；POST 不把聊天、布尔值或调用者
  文本升级为机器 authority，也不新建 receipt ledger。POST 只重验 candidate→approval exact ancestry/path、
  完整 provisional receipt、candidate/tree/toolchain/SOURCE_DATE_EPOCH/config/lock/bundle digest，并用固定
  Gitee resolver 双读证明 live remote=candidate；调用者显式提供的 `acceptanceReferenceDigest` 仅作内容寻址
  绑定/审计，不证明授权身份。不得用 repo-local remote/tag 替代。两阶段各自失败关闭，不能用 provisional
  bundle 绕过接受后 live-head 重验。
- 输入路径、输出的新空目录、source commit/tree、SOURCE_DATE_EPOCH、工具路径与 digest 必须显式；
  不读取生产目录、secret、proxy credential 或隐式 Docker context。
- 只构建/打包；不得 push、load、deploy、切换 current symlink 或写生产。
- bundle exact inventory：canonical release manifest+digest、images.env、Compose/Caddy、frontend/
  backend/Caddy OCI archives、每镜像 SBOM、provenance、source/lock/config digests、核验说明。
- 缺/多任何 entry、构建工具/平台/digest 不一致或工作树漂移即失败。

### 8.2 Verifier

`verify_offline_release.mjs` 全程只读。每次调用必须从 bundle 外显式提供
  `chaotang.release-expectation.v1` exact object：`candidateCommit, candidateTree, approvalDigest,
p09ContractDigest, p09VerifierDigest, runtimeRegistryDigest, releaseManifestDigest, previousReleaseId,
previousBundleDigest, coldBackupManifestDigest, provisionalReceiptDigest, acceptanceReferenceDigest,
expectationDigest`。`provisionalReceiptDigest` 必须绑定通过 PRE 验证的完整 provisional receipt；
`acceptanceReferenceDigest` 必须与 POST 调用者提供的内容寻址引用 exact，二者均为非空
`sha256:<64 lowercase hex>`，但后者只作审计绑定、不证明 Owner 身份。该 object 只能来自 accepted M0/P09
descriptor 或 Owner 绑定的发布输入，不得从 bundle、repo-local remote、tag、manifest 默认值或环境变量
推导。BOOTSTRAP 时 previousReleaseId/previousBundleDigest 必须 null、coldBackupManifestDigest 非空；
UPGRADE 三者必须非空并与 prior accepted receipt exact。verifier 先验证 expectation digest，再逐字段与 bundle 重算结果 exact；整体替换
bundle+manifest 仍无法改变包外 expectation。
`expectationDigest` 等于 `sha256:` + 排除自身后的完整 `chaotang.release-expectation.v1` RFC 8785
canonical bytes。

verifier 拒绝：

- duplicate JSON keys、未知字段、非 canonical bytes；
- absolute/穿越/重复/大小写冲突路径，symlink/hardlink/special entry；
- manifest 外文件、digest/size/source/tree/image/SBOM/provenance/config 不一致；
- floating reference、错误 platform、缺旧可恢复 release/backup identity；
- 在分配/解压前超出：4096 entries、32 GiB bundle、8 GiB single entry、200 compression ratio、
  16 MiB JSON、depth 32、path 512 bytes/16 segments。

verifier 不调用 `docker load`，不连接 daemon，不写生产，不把 HTTP health 当 bundle unity。

## 9. RC1 合成验收 runner

`run_rc1_release_acceptance.mjs` 是候选冻结后唯一验收编排入口。分两层：

### 9.1 M0 离线层

- 只运行 mocked/no-daemon/no-network 测试。
- 拒绝 default Docker context、`/var/run/docker.sock`、生产挂载、生产路径、secret、网络、
  预制 PASS 日志和无清理证明。
- 不真实 build image、不下载 scanner DB、不启动容器。

### 9.2 另行授权的 disposable host 层

- Owner 另行绑定 candidate SHA/tree、toolchain digest、允许的只读 origins、临时 Docker endpoint。
- 外部宿主防火墙/egress proxy 默认拒绝；仅允许固定依赖/镜像/scanner read，禁止上传、发布、
  business/provider 网络和用户凭据。
- 实际构建 bundle，调用 verifier，验证 SBOM/provenance/vulnerability policy，启动 non-root/
  read-only/cap-drop/loopback stack。
- 使用 deterministic provider 与脱敏合成工作簿完成：注册/登录→拟旨/受理→异步任务→唯一史馆
  REPLY→会计 XLSX→work-product→人工确认→下载/hash→跨 owner 404。
- 执行 `ONLINE_PER_DATABASE` 与 stopped-writer `COLD_RELEASE` backup→verify→new-root rehearse。
- 重启 stack，证明任务/史馆/确认/runtime bindings 保留；不得调用真实模型/MCP/行情。
- 每轮结束证明容器、端口、进程、临时目录和凭据环境全部回收。
- 先 1 轮，再同一候选/locks/images/fixture 连续 10 轮；任一失败从 1/10 重算。

所有构建期只读网络使用单一 fail-closed fetch boundary：authority 冻结 exact HTTPS
`scheme/hostname/port/path-prefix` allowlist，拒绝 userinfo、fragment、IP literal、HTTP、wildcard host 与
路径规范化越界；DNS 每次解析和连接 peer IP 都拒绝 loopback/private/link-local/multicast/unspecified/
cloud-metadata，所有 answers 与实际 peer 必须通过。redirect 默认禁止；若某上游合同必须 redirect，则每跳
重新执行同一 allowlist/DNS/peer/TLS 校验且绝不跨 origin 发送 credential。严格系统 CA、hostname、证书时间，
禁止 `-k`/自签 fallback。清空 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY`、Docker config/credential
helper、Git credential、SSH agent 与用户 config；使用新空 HOME/config root，任何 helper 调用即 FAIL。
每 origin 并发 2、总并发 4、单响应 2 GiB、总下载 32 GiB、连接 10 秒、总请求 30 分钟；content-type、
length/hash 与 frozen descriptor exact。credential 仅由另行 authority 的内存注入绑定 exact origin，
不进 argv/env dump/log/bundle。DNS rebinding、redirect、proxy、metadata 与 credential canary 必须有负测。

每轮和总结果使用 closed canonical JSON；未运行项是 `NOT_RUN`，不能写 PASS。

## 10. Exact product path proposal

未来 P15 amendment M0 的 `productPaths` 必须严格等于以下 26 条，按字典序冻结；不是子集，不得出现
第 27 条：

1. `backend/Dockerfile`
2. `backend/app/health.py`
3. `backend/app/operations/__init__.py`
4. `backend/app/operations/runtime_data_registry.py`
5. `backend/app/operations/runtime_lock.py`
6. `backend/app/operations/sqlite_backup.py`
7. `backend/app/readiness.py`
8. `backend/requirements-runtime.lock`
9. `backend/tests/test_health.py`
10. `backend/tests/test_readiness.py`
11. `backend/tests/test_runtime_lock.py`
12. `backend/tests/test_sqlite_backup.py`
13. `deploy/Caddyfile`
14. `deploy/README.md`
15. `deploy/compose.yaml`
16. `deploy/images.env.example`
17. `deploy/release-manifest.schema.json`
18. `frontend/Dockerfile`
19. `scripts/build_offline_release.mjs`
20. `scripts/build_offline_release.test.mjs`
21. `scripts/check_deployment.mjs`
22. `scripts/check_deployment.test.mjs`
23. `scripts/run_rc1_release_acceptance.mjs`
24. `scripts/run_rc1_release_acceptance.test.mjs`
25. `scripts/verify_offline_release.mjs`
26. `scripts/verify_offline_release.test.mjs`

只读依赖包括 `backend/pyproject.toml`、`frontend/package-lock.json`、七个 storage/schema 事实源、
`docs/decisions/0041-single-host-container-deployment.md`（base SHA-256
`1e27f11bd5fa033c0ac276eecbf3c379bddd78ba7a38aa1063a473f4359cfc49`）、V2 Proposal/
Receipt、accepted P09-A schema/verifier、product authority 和根/前后端 Harness；不得修改这些只读来源来迎合候选。

## 11. RED / acceptance matrix

未来 M0 至少冻结以下 node：

1. `P15-RED-01`：当前 backup module/test 缺失。
2. `P15-RED-02`：旧 6-DB registry 漏 `runtime_bindings.sqlite3`。
3. `P15-RED-03`：当前 deployment checker 错误接受 80/443 + domain/TLS。
4. `P15-RED-04`：无 hashed backend runtime lock，宽范围构建不可重现。
5. `P15-RED-05`：offline builder/verifier/runner 缺失。
6. `P15-BACKUP-01`：7-entry PRESENT/ABSENT registry、WAL、artifact 与 canonical manifest 正例。
7. `P15-BACKUP-02`：unknown/future/symlink/hardlink/special/path/tamper/missing/extra/overwrite、预算/
   statvfs/reservation/inventory 漂移负例。
8. `P15-BACKUP-03`：online 不声称 global atomic；cold 正常唯一 die 正例，以及缺/重复/错 stop、持续
   event stream EOF/reconnect/overflow、独占锁丢失、writer restart/第二 writer、identity 漂移、相邻
   timeNano JSON-number collision/前导零/指数/超界负例。
9. `P15-RESTORE-01`：只恢复到新空目录并重算 identity；in-place/force/production path 不存在。
10. `P15-LOCK-01`：canonical lock、build/runtime/test roots+closure+scopes、PEP503 唯一名、逐 hash、wheel
    filename/METADATA/Requires-Dist/platform exact；build-only 不进 runtime，zip bomb/duplicate METADATA/
    sdist/非法 marker/用户 site/网络/浮动依赖拒绝。
11. `P15-DEPLOY-01`：ADR 0041 loopback exact，所有公网/多 writer/floating/root 负例。
12. `P15-BUNDLE-01`：pre-acceptance local child/remote parent provisional 与 post-acceptance live candidate
    final 两阶段及各自 verifier；closed inventory、source/tree/lock/image/config/digest exact。
13. `P15-BUNDLE-02`：包外 expectation/P09-A binding；整体替换、duplicate/path/archive-limit/digest/
    provenance/SBOM 负例。
14. `P15-RUNNER-01`：M0 mock/no-daemon/no-network；disposable-host 的 HTTPS/DNS/peer/TLS/redirect/
    proxy/credential/Docker-helper/预算与生产 socket/path 边界失败关闭。
15. `P15-BASELINE-01`：候选态后端 full matrix（当前已知基线 4106 passed / 4 skipped）、Ruff、前端
    674、lint/typecheck/build、部署 checker 重跑；测试发现数随新 base 合法变化时必须报告完整 collected/
    passed/skipped 数和差异原因，不得把旧 745 focused count 冒充 full matrix。
16. `P15-E2E-01`：disposable host 合成 owner/BFF/async/Shiguan/XLSX/confirmation/download/backup/restart。
17. `P15-REPEAT-01`：同候选 1+10 轮与清理 evidence。
18. `P15-AUTHORITY-01`：exact single child、26 paths、remote head、Harness、rollback、Owner final SHA/tree。

`P15-DEPLOY-01` 还必须覆盖 closed operator inputs、`env -i` 下未声明变量、过期/prebuilt/free-form
writer session、手工 stop 后伪造 session与输入 digest漂移；`P15-AUTHORITY-01` 必须覆盖 amendment evidence
成为远端头后旧 digest、旧 base 与旧 25-path approval 全部 `STOP`。

M0 verification 自身不得依赖 Docker daemon、registry/scanner 网络、真实业务网络或生产路径，也不得
自行联网 provision wheelhouse。它必须只读消费由另行授权任务在候选身份锁定后预置、内容寻址并固定权限的
exact wheelhouse；该 wheelhouse 是 verification 的显式输入而不是隐式宿主依赖。缺失、可写、未绑定候选、
inventory/hash/METADATA 不一致均 STOP。其它外部证据在 candidate acceptance 前另行完成并绑定 candidate identity。

## 12. 回滚与失败处理

- P15 不迁数据库 schema，因此产品代码回滚以 prior immutable release 为主；不自动恢复数据。
- builder/verifier/runner 失败只清理本轮已创建且身份仍匹配的临时根；保留失败 canonical evidence，
  不删除用户目录或其它 worktree。
- candidate 未被 Owner 接受前不得 push；已接受但未部署时，可回退 Git candidate，不涉及数据。
- 未来部署后回滚必须有 previous bundle + matching `COLD_RELEASE` backup；启动镜像前先验证其
  数据兼容性。P14 是 P15 的单向后继 registry safety amendment：P14 激活前只允许旧 P15 image + 旧
  registry digest 对旧库做 cold backup；P14 安装 V2 trigger 并提交后，旧 digest 与不认识该 trigger 的
  旧 P15 image 永久禁止启动。此后回滚只能使用保留 P14 strict trigger floor、理解新 registry digest 的
  forward-compatible image，或保持停服等待另行 repair；不得用产品代码回退删除 trigger。任何 production
  restore/overwrite 需新 authority。
- 若 P15 改动业务 API、数据库 schema、页面、第二发布控制面，立即 STOP 并重写合同/M0。

## 13. 合同 readiness 与后续门

本草案形成后仍需：

1. 独立 code、Python、security、release/operations 合同审查 P0–P3=0。
2. Owner 明确选择包含 P15 的首批组合。
3. Owner 接受本合同 exact bytes/SHA 后，只提交本合同一个文件形成独立 amendment evidence governance
   commit，并单独 push；不得与 approval 三件套或产品 child 合并为同一提交/一次 push。
4. 使用固定 Gitee resolver 在 push 前后双读 `refs/heads/ext-dev`，证明 amendment evidence commit 已成为
   live 远端精确头；同时重跑旧 task 的 `--status/--authorize`，必须因远端头不再等于旧 approval commit 而
   `STOP`。未完成这一步，不得生成、提交或 push 新 approval 三件套。
5. 以该已落地 evidence commit 为新 base 生成 machine-readable M0 amendment approval + task + plan，锁
   exact digest/26 paths/18 nodes；Owner 接受新 digest 后才可把三件套作为第二个独立 governance commit
   提交并单独 push。
6. 新 amendment approval governance commit 成为 `origin/ext-dev` 精确头后，机器 `--authorize` 必须返回 GO。
7. 只在 exact single-child 产品席位 TDD 实现；完成候选、外部验证、独立审查后再呈 Owner。

在此之前结论始终是：`CONTRACT_AMENDMENT_DRAFT / PRODUCT_AUTHORITY_STOP / PRODUCTION_UNTOUCHED`。
