# Packet 14 — 可信产物交付合同草案

> 状态：`CONTRACT_AMENDMENT_DRAFT / KNOWN_GAP / NONAUTHORIZING / PRODUCT_STOP`
>
> Packet：`packet-14-trusted-artifact-delivery`
>
> 能力：`trusted-artifact-delivery`

本合同只定义 Batch 1 中“会计工作产物可追溯、仅在产物真实发布后可由本人作一次人工确认、
并可由本人安全下载”的修复与验收边界。它不授权产品代码、commit、push、真实用户数据、生产
数据库、部署、网络、模型、文件上传或旧 W06R 整树合并。

### Follow-up amendment（2026-08-22）

已接受的 P14 合同证据 commit 为 `90bb3abd53af4cbb988d74fb818ec76c731576f5`，已接受的首版
P14 治理三件套 commit 为 `963d313310c3a2a35158428de81e83073096fec8`。首版 M0 的19条路径
在实现 RED 后暴露出一个跨 Packet 的真实兼容缺口：P14 V2 application/trigger 要求 immutable
WorkProduct semantic digest 自洽、`reply_id` 与唯一 artifact binding 一致、内部 actor exact 为
`user:<owner_user_id>`；P15 既有 `backend/app/operations/sqlite_backup.py::_create_synthetic_runtime()`
仍创建占位 `content_digest="3333333333333333333333333333333333333333333333333333333333333333"`、
不一致的 `rc1-synthetic-reply`，并用旧 `synthetic-owner`
直接写 confirmation receipt。结果是 P14 专项链通过，但 approval 强制的 backend-full 与
`test_sqlite_backup.py` synthetic backup/rehearse 在 V2 安全底座上必然失败。

本 follow-up 只把 `backend/app/operations/sqlite_backup.py` 加为第20条产品路径，并允许三项
机械兼容修正：从同一个 `WorkProductEnvelope` 按现有 `semantic_digest` 生成真实 content digest；
把 synthetic WorkProduct `reply_id` 对齐已写入 artifact 的 `synthetic-reply`；把 synthetic receipt
actor 改为 `user:synthetic-owner`。禁止改变 backup/verify/rehearse、writer-stop、registry、retention、
真实数据或 release authority 语义，也禁止为 synthetic ID 建生产特例、放宽 V2 trigger 或 application
guard。修正后必须由既有 synthetic CLI、P14 精准矩阵和 backend-full 同时证明。

该 amendment 本身仍不授权产品施工、commit、push 或部署。它必须先作为单文件治理证据独立
commit/push；随后从其远端 exact head 重新生成并审查 P14 三件套，Owner 接受新 canonical approval
digest 且新版 `product-authority --authorize` 返回 GO 后，才允许恢复当前 P14 产品草稿。旧 approval
在 amendment 成为远端头后必须返回 STOP，不得继续消费。

当前 `ext-dev` 已有 substantive 纵切，但只证明了 happy path。只读复现已确认：确认事务只校验
WorkProduct 自身的 `READY_FOR_HUMAN_CONFIRMATION + PENDING`，没有在同一事务中核对绑定 artifact
必须同 owner、同 run、`PUBLISHED` 且 digest 一致；因此 `PENDING`/`ABORTED` 或跨 run 绑定可被
错误确认。下载路径还会把完整 XLSX 一次性读入内存，公开 receipt 会暴露内部 `actor_ref`，确认
BFF 也缺少封闭的 same-origin、体积与 duplicate-key 边界。P14 必须按 `KNOWN_GAP / GAP_FIX`
处理，不能再以 `SUPERSEDED_VERIFY` 或旧 PASS 直接收口。

## 1. 冻结身份与当前判断

- 唯一目标：`gitee.com/msxn/chaotang-os:origin/ext-dev`。
- 当前 base：`17d6be6538bfbfeeaf5c6fa13eee5d09dd1208a9`。
- 当前 base tree：`03eaa2218429c9b25ee88fda02c5e648a5ea632a`。
- V2 proposal disposition：`REBUILD / PROPOSED_NOT_AUTHORIZED`。
- 当前目标证据修订：`SUBSTANTIVE_EXISTING / GAP_FIX_REQUIRED + REAL_E2E`；这不是修改 Owner
  semantic receipt，而是以当前目标代码和测试决定实施方式。
- 产品 authority：`STOP / APPROVAL_NOT_SELECTED`。

P14 不是“把旧分支里的 PDF/DOCX/JSON 交付平台迁回来”。`ext-dev` 已有围绕会计 XLSX 的单一
产物事实源、WorkProduct、确认回执、下载 API/BFF 和 UI。Batch 1 先验证这条产品链；不得为追求
旧设计的格式数量建立第二套数据库、API、租户或完成权威。

## 2. V2 来源与去重边界

P14 在 Owner review 中共有 40 个 review units：

- 2 个冻结 ref tree；
- 38 个未提交 worktree entries，全部保持 `BLOCKED_WIP`，不得读取为 canonical donor、复制或
  依据文件名推断完成；
- disposition 分布：1 `ABSORB_ADAPT`、1 `SUPERSEDED_VERIFY`、38 `BLOCKED_WIP`。

可读取的两个冻结 ref：

1. `governance/r0-w06-artifacts-20260724`，tree
   `0e8afcf2b918b9b76e1dbbbea18a5eabd24bbd69`，仅保留历史治理与负测语义；
2. `task/ext-w06r-artifact-delivery-20260725`，commit
   `e51ce33d873cc0ccd3759e6e5533d646a3021972`，tree
   `e2ae01b26c1196723751b8d657939d4ee780e5fa`。可蒸馏内容哈希复验、owner/tenant 隐匿、路径
   约束、重放/损坏负测和失败不能冒充交付；不得吸收其 SQLAlchemy/Alembic 数据面、PDF/DOCX/JSON
   三格式完成公式、`/api/artifacts/**`、第二套 manifest/audit/tenant authority 或整棵源码。

旧 W06R 与当前 XLSX 产品是 semantic siblings，不是 exact duplicate。当前产品事实源优先。

## 3. 当前真实读写图

### 3.1 Writers

1. 户部会计执行从管理员配置的受控工作簿产生一个
   `ACCOUNTING_MANAGEMENT_REPORT_XLSX`；普通回奏不产生 artifact。
2. `ArtifactStorage.create_pending()` 先写 `PENDING` 元数据与受控目录内临时 XLSX；归档成功后
   `publish_run()` 原子投影为 `PUBLISHED` 并绑定唯一 `reply_id`；失败走 `abort_run()`，不得把
   pending 文件暴露给下载。
3. 同一存储事务创建 `WorkProductEnvelope` 和 artifact binding。WorkProduct 的机器状态与人工
   `confirmation_status` 是两条独立轴，不能相互推断。
4. 当前 `append_confirmation()` 只接受当前 owner 和 WorkProduct 自身的
   `READY_FOR_HUMAN_CONFIRMATION + PENDING`；它没有在同一事务中把 WorkProduct 重新绑定到
   artifact 的 owner、run、state、file digest 与 manifest digest。这是本 Packet 已确认的 RED，
   不是既有安全保证。
5. 修复后，application guard 与数据库 insert trigger 必须共同要求：恰好一个 immutable binding；
   artifact/work product owner 与 run exact；artifact `PUBLISHED`；WorkProduct 原始 immutable
   `payload_json` 的 semantic digest 自洽；artifact gate exact `PASSED` 且 reason/missing/unexpected
   全为空；恰好一个 `management_report_xlsx` manifest、`traceable=true`，其 digest 与 artifact
   `file_sha256` exact；内部 `actor_ref` exact 为 `user:<owner_user_id>`。任一失败不得写 receipt 或
   改变 WorkProduct/artifact 状态。浏览器、模型、下载或史馆 review 都不得代替该回执。

### 3.2 Readers

1. FastAPI `GET /api/v1/report-artifacts/{id}/work-product` 返回 owner-filtered public snapshot；
   不返回 `owner_user_id`、本机路径或史馆 review 状态。
2. FastAPI `POST /api/v1/report-artifacts/{id}/confirmation` 从 `CurrentUser` 派生内部 actor，拒绝
   请求体 owner；跨 owner 与未知 id 同形 404，非法逆转或产物尚未发布/已终止返回 409，存储、
   digest 或 binding 损坏返回 503。内部 receipt 继续保存 actor 绑定，但 public DTO 只返回
   `work_product_id, version, sequence, decision, structured_reason, created_at`，不得暴露
   `actor_ref`、owner、本机路径或 session。
3. FastAPI `GET /api/v1/report-artifacts/{id}/download` 只读 `PUBLISHED` artifact。统一最大 artifact
   大小为 64 MiB；创建 pending、publish 前复验和 download 都使用同一常量。下载必须以
   `O_RDONLY|O_NOFOLLOW|O_CLOEXEC` 打开单一 regular FD，拒绝 nlink!=1，在 FD 上分块复制到 process
   private 0700 temp root 内的匿名/立即 unlink、0600 bounded spool，同时计算 SHA-256、核对 size 与
   稳定 `(device,inode,type,nlink,size)`；校验完成后才构造响应。spool memory threshold 固定 1 MiB，
   单份 hard cap 64 MiB，process-wide 同时最多 2 份、同 owner 最多 1 份；spool lease 管理器必须在
   process-wide 锁内原子维护已预留 bytes，同一次原子决策同时核 `statvfs` 可用空间与其它活跃预留，
   每份预留固定 `artifact_size + 64 MiB`。不得让并发请求各自读取 `statvfs` 后分别通过。空间不足、
   lease 不可得、disk-full 或任何 identity drift 均 503。success、hash
   failure、client cancel/disconnect 和 iterator exception 的 `finally` 都必须 close FD/spool、释放
   lease，并证明私密明文零残留。禁止 `Path.read_bytes()`、未验证 reopen、symlink/hardlink/special
   file 和超限内容。返回固定 XLSX MIME、safe filename、`nosniff`、`private, no-store` 和真实
   Content-Length。
4. Next Route Handler 只从 HttpOnly `courtos_session` 取得 session，转成后端 Bearer；浏览器只访问
   same-origin `/api/report-artifacts/**`，不得看到 FastAPI 地址、token、owner 或本机路径。
5. 确认 BFF 只接受同源浏览器 POST：`Origin` 必须 exact 等于请求 origin，`Sec-Fetch-Site` 必须
   `same-origin`，Content-Type 必须 exact JSON；先按 Content-Length 快拒绝，再以流式 reader 在
   8192 bytes 处停止并 cancel，之后才用 fatal UTF-8 与 duplicate-key rejecting JSON 解析。请求只
   允许 `decision, structured_reason` 两键；decoded artifact id 必须无首尾空白且 UTF-8 为 1..256
   bytes，trim 后 structured reason 必须 UTF-8 为 1..1024 bytes。FastAPI 的
   `ConfirmationRequest` 重复执行 reason 上限，不能把 BFF 当唯一防线。未认证、跨源、
   超限、重复键或 unknown key 均零后端调用。
6. FastAPI confirmation endpoint 不得依赖自动 body-model JSON 解析；Content-Length 若存在必须是
   canonical decimal `1..8192`，缺失时仍允许进入 bounded stream；0、负值、前导零、非数字或超限均在
   读取 body 前 413。之后从 `Request.stream()` 累计到 8192 bytes 即 cancel，以 strict UTF-8 +
   duplicate-key rejecting parser 得到 exact 两键对象，之后才构造 `ConfirmationRequest`。无 header、
   声明少于/多于实际、空流、stream 中断都必须有固定 400/413 且零 storage 调用。因此直接调用内部
   FastAPI 也受同一 raw body 与字段上限保护；BFF 不是唯一防线。
7. Download BFF 在返回浏览器前要求 upstream Content-Length 是 `1..67108864` 的 canonical decimal，
   Content-Type 与 body 都存在；缺失、0、超限或非法 header 预响应 503。开始流式后用计数 transform
   验证实际 bytes exact 等于声明值；少、多、中断或取消时 abort browser stream、cancel upstream，
   不得产生一个完整成功下载，也不虚构可在 headers 已发送后改回 503。
8. 前端 strict decoder 拒绝 extra/missing/非法 enum/time/digest，并消费不含 `actor_ref` 的 public
   receipt；UI 只在用户主动查询且服务器回显 `artifact_state=PUBLISHED` 后展示确认控件，不预取
   工作簿，不根据下载、receipt 数量或本地状态推断确认成功。

### 3.3 数据与所有权

- 运行事实源：`backend/app/accounting_reports/storage.py` 管理的 SQLite + 受控 artifact directory。
- WorkProduct 合同事实源：`backend/app/work_products/**`。
- 身份事实源：FastAPI `CurrentUser`；前端只转发 session。
- 归档事实源：史馆唯一 `REPLY`；P14 confirmation 不写史馆 review，也不产生第二条 REPLY。
- Batch 1 输入：系统配置的受控真实/合成工作簿；用户上传属于 P07/Batch 3，不是 P14 前置。
- `content_digest` 只绑定创建时的 immutable `payload_json` 语义内容：使用现有
  `semantic_digest`，排除 root `content_digest` 与既有 non-semantic identity/time keys；它不绑定
  后续投影的 confirmation/work status，也不得拿当前 public snapshot 反算。每次 get/confirm 都先
  对原始 `payload_json` 重算，再叠加数据库投影状态。

## 4. 当前基线与未证明项

### 4.1 已观察

- `test_work_product_models.py`：50 passed。
- `test_accounting_work_product_storage.py`：40 passed。
- P14 前端组件两个测试文件：PASS。
- P14 相关 Ruff：PASS。
- 2026-08-21 Profile S 受控沙箱外矩阵：后端相关 32 文件 745 passed；前端完整 674 passed，
  lint/typecheck/build PASS。
- 本沙箱内两个 FastAPI `TestClient` API 文件以及各自首个单测在 20/90 秒被 timeout 终止；
  Profile S 基线已记录这是 loopback/TestClient 环境限制，不能把它改写为产品失败或 PASS。正式
  evidence 必须来自允许本地进程/loopback 的隔离环境，并且测试进程正常退出。

### 4.2 已确认 RED 与仍待真实链证明

已确认 RED：

1. `PENDING` artifact 与 `READY_FOR_HUMAN_CONFIRMATION` WorkProduct 可以写入终局 receipt；
   artifact 仍是 PENDING。2026-08-21 临时 SQLite 复现同时使用不同 artifact/work-product run，
   得到 `artifact_state=PENDING, receipt=CONFIRMED, receipt_count=1`。
2. `ABORTED` artifact 的既有 WorkProduct 没有 transaction-level confirmation guard。
3. `create_work_product()` 只核 owner，不核 artifact 与 WorkProduct 的 run exact；跨 run binding 可进入库。
4. public receipt 原样返回 `actor_ref=user:<CurrentUser.id>`。
5. confirmation BFF 使用无界 `request.json()`，没有 same-origin/CSRF gate，也没有 raw duplicate-key
   拒绝。
6. download 通过 `Path.read_bytes()` 一次性分配完整 XLSX，且没有统一文件大小上限。
7. UI 的 `showControls` 只看 WorkProduct/confirmation status，不看 artifact 必须 PUBLISHED。

仍待产品候选完成后的真实链证明：

1. 登录后的实际浏览器从拟旨、accept、异步 poll、唯一史馆 REPLY 走到 XLSX UI。
2. 浏览器主动加载 PUBLISHED WorkProduct、提交一次人工确认、刷新后读取同一脱敏回执。
3. 第二 owner 无法读取 WorkProduct、确认或下载；未知与 cross-owner 同形。
4. 浏览器下载 bytes 与数据库 SHA-256、工作簿关键 sheet/期间/来源字段一致。
5. 整条链使用 production Next build、真实 BFF/FastAPI/SQLite 与 deterministic provider；无 route
   interception、mock API、预制成功数据库或真实模型/外网。
6. 服务和浏览器在成功/失败后均退出，不遗留监听端口、子进程或临时产物。

## 5. P14-R：失败基线与候选验证矩阵

M0 前只允许在临时根复现 RED 和现有回归，不生成产品 candidate。M0 后同一矩阵用于验证唯一
single-child candidate。所有数据库、artifact、日志、截图和网络证据必须位于新建临时根；不得
读取/写入 `backend/data`、`backend/var`、用户工作簿或已有浏览器 profile。不得记录 raw
Playwright trace/HAR；它们可能含 session、Authorization 或工作簿响应体。只保留无 header/body 的
sanitized request ledger、脱敏截图、console 摘要与命令退出证据。

### 5.1 精准命令

在允许 loopback 与子进程清理的隔离环境运行：

```text
backend:
  python3 -m pytest -q \
    tests/test_work_product_models.py \
    tests/test_accounting_report_storage.py \
    tests/test_accounting_work_product_storage.py \
    tests/test_accounting_confirmation_api.py \
    tests/test_report_artifacts_api.py \
    tests/test_accounting_report_cross_layer.py \
    tests/test_synthetic_accounting_acceptance_app.py
  python3 -m ruff check app/work_products app/accounting_reports \
    app/api/report_artifacts.py tests/test_*work_product*.py \
    tests/test_*report_artifact*.py tests/test_accounting_confirmation_api.py

frontend:
  npm test
  npm run lint
  npm run typecheck
  npm run build  # 仅在 disposable temp repo copy 内

real-stack:
  python3 tests/run_accounting_synthetic_acceptance.py --rounds 1
```

真实浏览器 journey 使用同一轮 real-stack 的 production build 与临时后端；不得另起 mock 服务。
production build 必须在当前 candidate 的一次性临时副本中执行，`.next`、cache 和 build log 只能
写该临时副本；完成后以 candidate tree/preimage 证明受控 worktree 零写。

### 5.2 必须补入 P14 evidence 的 journey

1. Owner A 注册、登录；凭同一 message 生成 draft，accept 后得到 202 job。
2. 轮询至 `SUCCEEDED`，确认 single 户部/会计司、唯一 artifact、唯一史馆 REPLY。
3. 页面展示下载链接；未点击前网络记录中无 XLSX GET。
4. 用户主动打开 WorkProduct；只有服务器回显 artifact `PUBLISHED` 时，机器
   `READY_FOR_HUMAN_CONFIRMATION` 与人工 `PENDING` 才分开展示并出现确认控件。
5. 提交一次 `CONFIRMED` 且 reason 非空；服务端回显 append-only receipt，刷新仍为 CONFIRMED。
6. 同一 owner 再次提交或逆转返回 409，UI 不做乐观篡改。
7. Owner B 对同一 work-product、confirmation、download 都得到与未知 id 同形的 404。
8. Owner A 下载 XLSX；核对 MIME/headers/SHA-256、7 个 sheet、2025 期间、资产 1000、来源哈希。
9. 篡改副本/测试 fixture、超 64 MiB、symlink/hardlink/special file 触发 503；响应、日志、
   sanitized request ledger 与截图不含路径、owner、session、Authorization、Cookie、actor_ref 或
   财务明文。测试账号/session/工作簿各放一个独特 canary，所有留存证据逐字扫描为零命中。
10. 关闭浏览器与服务；证明临时根外零写、端口和子进程零残留。

## 6. Closed 状态与失败语义

允许状态组合：

- `PENDING artifact` 不可下载，不可确认；
- `PUBLISHED + READY_FOR_HUMAN_CONFIRMATION + PENDING confirmation` 可下载、可作一次终局确认；
- `CONFIRMED` 与 `ESCALATED` 保持 work status ready，但不可再次确认；
- `REVISION_REQUIRED` 同时把 work status 投影为 `REVISION_REQUIRED`，不可再次确认；
- `ABORTED` 永不可下载、不可确认；
- legacy published artifact 没有 WorkProduct 时仍可下载，但 UI 必须明确“仅支持下载”，不得补造回执。

`append_confirmation()` 在同一个 `BEGIN IMMEDIATE` 与 storage-wide artifact lease 内按以下固定顺序
失败关闭：owner-scoped load WorkProduct → 从原始 `payload_json` 重算 immutable payload
digest/gate/唯一 management manifest → load 唯一 immutable binding 与 artifact → exact 比较
owner/run/state/manifest/file digest → 用 `O_NOFOLLOW` regular FD 打开并记录
`(dev,ino,type,nlink,size,mtime_ns,ctime_ns)` → 在同一 FD 分块重算文件 digest → 检查 current
work/confirmation status → 构造 server-owned exact actor_ref → 分配 sequence → insert receipt → V2 trigger
二次校验 → **在 COMMIT 前**再次 `fstat` 同一 FD，并对 canonical path `lstat`，要求上述全部 identity
字段及 path `dev+ino` exact 未变 → commit → close FD 并释放 lease。产品内所有 artifact write/rename/
publish 路径必须取得同一 lease；commit 后只允许不会改变安全判定的 close/release，不能再设置可能失败
却无法补偿的 gate。任何 commit 前步骤失败都 rollback；不得先写 receipt 再补查 artifact。等长原地
改写、rename-replace、mtime/ctime 漂移均必须在 commit 前失败且零 receipt。数据库
V2 trigger 独立验证 work product version/status、唯一 binding、artifact owner/run 与 `PUBLISHED`，
以及 `NEW.actor_ref = 'user:' || owner_user_id`。文件 bytes 与完整 semantic payload 只能由 application
验证；direct SQL 的格式合法伪 digest 不得被宣传为数据库能够重算。

### 6.1 一次性 V2 trigger 迁移

现有每次 `_initialize()` 的无事务 `DROP confirmation_receipts_guard_insert → CREATE` 必须被删除。
P14 使用独立、旧代码不会删除的固定 identity `confirmation_receipts_guard_insert_v2`：

1. `ArtifactStorage` 构造先用只读 schema inspection；V2 与全部既有对象 exact 时立即返回，steady
   state 禁止 DDL。只有空临时库 bootstrap 或 V2 缺失才进入一个专用连接的 `BEGIN EXCLUSIVE`；
   获取锁后必须重新读取 tables、旧 trigger 与 V2 trigger 的 exact `sqlite_master.sql` canonical digest，
   形成 preimage，禁止 `executescript` 的隐式 transaction 边界。
2. V2 不存在时，在同一 exclusive transaction 以逐条 `execute` 创建 exact V2 SQL，重读并核
   postimage digest 后 COMMIT；任何异常 ROLLBACK，旧 trigger 继续完整存在，不得留下无 guard
   空窗。空临时库在同一 exclusive transaction 创建既有 schema + V2，不能先暴露弱 bootstrap。
3. V2 已存在时只允许 exact digest match；运行期是 verify-only，禁止 drop/recreate。unknown/mismatch
   trigger、future schema 或 database busy 超出固定短 timeout 均让 storage unavailable、进程不 ready。
4. 两个同时启动的 candidate 进程必须由 exclusive transaction 串行；两者最终观察同一 postimage。
   但正式部署仍限定单 backend writer，不能把该测试解释为批准多 worker。
5. 迁移 acceptance 覆盖 crash-after-BEGIN、crash-after-CREATE-before-COMMIT、双 initializer、迁移中
   direct insert、旧 initializer 启动、postimage tamper；任一时刻至少有旧 guard，commit 后 V2 永久
   存在且弱写被拒绝。

V2 trigger 是 expand-only 安全底座，不在本 Packet 内删除。preimage/postimage digest 只进入 P14
evidence receipt，不新增 schema ledger/table。P15 落地后，P14-G 必须同步更新其唯一 closed
`runtime_data_registry.py`：`report_artifacts.sqlite3.requiredTriggers` 必须包含 exact
`confirmation_receipts_guard_insert_v2`，并重算 registry digest。storage constructor、readiness、backup
verifier 与 release verifier 必须消费同一 digest；删除/篡改 V2 后四者全部失败关闭。P14 不允许复制
第二份 schema registry。

public receipt 是独立 DTO，不是内部模型的 `model_dump()`：exact fields 为
`work_product_id, version, sequence, decision, structured_reason, created_at`。内部 `actor_ref` 保持
append-only 且 owner-bound；public/BFF/UI 任一层出现 `actor_ref` 都是 contract failure。

HTTP 语义固定：401 未登录；404 未知或 cross-owner；409 确认状态冲突（含 PENDING/ABORTED、
非 READY 或重复终局）；503 binding、payload、manifest、文件 digest 或存储不可用；400 BFF
same-origin/body/contract 验证失败。
任何 2xx 都不得由 fallback、静态 fixture 或前端本地状态制造。

## 7. P14-G：已知缺口的独立 M0 修复包

P14-G 是 Batch 1 的产品修复 Packet，不能由本合同、Batch 1 方向确认、P09/P15 或历史 PASS 隐式
授权。必须生成独立 machine-readable M0，绑定本合同最终 digest、当前 accepted ext-dev parent、
以下 exact product paths、RED nodes、单提交回滚和唯一单亲子；只有
`node scripts/product-authority.mjs --authorize --task <exact-P14-task-id>` 返回 GO 后才可施工。

P14 20 路径候选的 backend-full RED 又揭示一处继任兼容缺口：历史六部测试仍通过直接确认
`PENDING` artifact 构造 ESCALATED/CONFIRMED fixture，而本合同的核心安全不变量明确要求只有
`PUBLISHED` 且 payload/manifest/file digest 完整绑定的唯一 artifact 才能产生终局 confirmation。
同时，2026-08-14 六部 readiness 的 69 文件历史审查集合包含 P14 接管的
`backend/app/accounting_reports/storage.py` 与对应六部适配测试；原 67 文件 current-content
指纹策略无法区分未授权漂移与已批准后继 Packet，因此任何合法 P14 修改都会令 Root Harness 永久失败。

继任兼容修复必须先于新 P14 M0 落地，并满足以下封闭策略：

- 六部报告的历史 69 文件清单、历史独立 review 指纹 `sha256:a6c2de2c...a265190`、review status、
  reviewer 与 P0/P1 结论完全不改；不得冒领旧 review 覆盖 P14 新语义。
- Python verifier 与 Root Harness 的 current-content exclusions 从两个自引用 validator 精确扩为四条：
  `backend/app/accounting_reports/storage.py`、
  `backend/tests/test_six_ministry_accounting_evidence_adapter.py`、
  `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。
- 剩余 current-content 集合必须恰好 65 条，继续使用
  `sha256-path-null-content-null-v1`，精确 digest 为
  `sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69`；第五条排除、
  任一剩余文件漂移或两 validator 策略不一致都失败关闭。
- 两条 P14-owned exclusions 不得成为永久盲区。两个 validator 必须另按相同算法、相同排序计算这两条
  路径的 composite fingerprint，并只允许两个完整状态：旧 base pair
  `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`，或本文冻结的
  P14 reviewed pair
  `sha256:d98fbc113e5d620eea902ed132a6c4d638023f5e4d55d0ce5162f3ab621648d9`。旧/新混搭、单条漂移、
  第三种状态均失败关闭；后继新语义仍须由 P14-R、backend-full、Root Harness、独立 code/security review
  与 exact product candidate receipt 覆盖。
- 六部 accounting fixture 只能改成先建立正确 `management_report_xlsx` digest 绑定、发布 artifact、再确认；
  tampered durable payload 在 storage read boundary 失败后保持 non-enumerating
  `accounting_evidence_unavailable`。不得放宽 PENDING/ABORTED confirmation、actor、digest 或 V2 trigger。

该继任兼容修复必须使用独立 governance repair packet，approval commit 只含其 task/packet/plan；
candidate commit 只含本文、Python verifier 与 Root Harness 三路径。两提交均须 exact single-parent、
exact paths、独立 code/security review 与 Owner commit/tree 确认。它落到远端后，旧 20 路径 P14 approval
继续保持已消费/失效，必须在新 base 上重新生成 21 路径 M0；不得把治理修复与产品候选合并为一提交。

未来 P14-G `productPaths` 必须严格等于以下 21 条，按字典序冻结；不得用目录、glob 或“对应测试”
扩面：

1. `backend/app/accounting_reports/storage.py`
2. `backend/app/api/report_artifacts.py`
3. `backend/app/operations/runtime_data_registry.py`
4. `backend/app/operations/sqlite_backup.py`
5. `backend/app/readiness.py`
6. `backend/tests/test_accounting_confirmation_api.py`
7. `backend/tests/test_accounting_report_storage.py`
8. `backend/tests/test_accounting_work_product_storage.py`
9. `backend/tests/test_readiness.py`
10. `backend/tests/test_report_artifacts_api.py`
11. `backend/tests/test_six_ministry_accounting_evidence_adapter.py`
12. `backend/tests/test_sqlite_backup.py`
13. `frontend/src/app/api/report-artifacts/[id]/confirmation/handler.ts`
14. `frontend/src/app/api/report-artifacts/[id]/confirmation/route.test.ts`
15. `frontend/src/app/api/report-artifacts/[id]/handler.ts`
16. `frontend/src/app/api/report-artifacts/[id]/route.test.ts`
17. `frontend/src/features/study-visual/StudyArtifactConfirmation.test.ts`
18. `frontend/src/features/study-visual/StudyArtifactLinks.test.ts`
19. `frontend/src/features/study-visual/StudyArtifactLinks.ts`
20. `frontend/src/lib/backendClient.test.ts`
21. `frontend/src/lib/backendClient.ts`

路径 4 只允许修复本节冻结的 P15 synthetic semantic digest、reply 与 actor 三项，不得改变任何真实
backup/release 行为。路径 11 只允许修正过时 fixture/expected error，不得改变任何产品代码或放宽
confirmation。路径 15 只允许收紧现有 download BFF 对 Content-Length/stream contract 的验证，不得改变 URL、MIME、
Content-Disposition 或认证语义。
任何确实需要的新表、列、API namespace、artifact 格式、上传、自动发布或历史清理都属于新迁移
合同，不得塞入 P14-G。

P14-G 实施顺序固定：

1. 在临时 SQLite 写入 PENDING、ABORTED、cross-run、payload/gate/manifest/file digest drift、伪 actor、
   public actor canary、CSRF/duplicate/oversize、stream mismatch/cancel、spool concurrency/disk-full 与
   64 MiB 边界 RED；确认 candidate parent 上稳定失败。
2. Expand：以 6.1 的 exclusive migration 增加永久 V2 trigger，强化 application guard；不新增表/列，
   不重写已有行。
3. Adapt：引入 public receipt projection、bounded verified spool、BFF same-origin/bounded strict parser 与
   PUBLISHED-only UI projection；把 V2 trigger 加入 P15 唯一 runtime data registry，并由 readiness/backup/
   release verifier 消费同一 registry digest；ordinary legacy download-only 行为保持不变。
4. Verify：运行 P14-R 全矩阵、真实双 owner 浏览器链、Root/Frontend/Backend Harness、独立
   code/security review 和 `--verify-candidate`。
5. Contract：本 Packet 不删除旧字段/回执/产物。任何未来收缩另行授权。

触发器属于持久 schema 行为。测试 candidate 只操作临时库；P14-G 的真实 approval base 必须已经
包含 accepted P09-A schema/verifier 与 accepted P15 runtime-data registry/readiness/backup/release
verifier。真实环境采用 closed 双镜像/双 digest 过渡：先停止唯一旧 writer，由 **旧 P15 image + 旧
registry digest** 对尚无 V2 trigger 的旧库取得并验证 `COLD_RELEASE` backup，绑定 old release/preimage；
随后才启动 P14 candidate，安装并 commit V2 trigger。activation 后 readiness、后续 backup/rehearse 与
release verifier 只能消费包含 V2 的 **新 registry digest**。evidence 必须记录两个 registry digest、对应
image/release/DB preimage-postimage；旧/新 digest 或 image 禁止交叉消费。禁止旧/新 backend 同时对同一 SQLite 写入；旧 backend
即使只处理 GET 也会运行旧 initializer，因此不属于安全 read-only client。P14 不自行停服、备份或恢复。

## 8. 回滚与兼容窗口

- M0 前复现：删除临时根并停止临时进程即可；没有产品或持久数据回滚。
- 首次 persistent DB activation 前：可完整 revert 未激活 candidate；不得恢复旧 W06R tree，也不得
  改动任何 SQLite 行、artifact bytes、reply 或 confirmation receipt。
- activation 定义为 candidate 首次在持久库成功 commit V2 trigger。activation 后禁止普通 full revert：
  V2 trigger、严格 application guard、raw bounded confirmation parser 与脱敏 public DTO 是永久安全
  floor，必须保留。UI 或非安全展示若需回退，只能用预先验证、另行获批的 forward compatibility
  child；若该 child 不可用，停止 confirmation/work-product 服务并保持数据库/产物原样，不能启动旧
  backend 继续服务。
- P14 candidate evidence 必须在 activation 前验证两条 rollback 路径：全量未激活 revert；以及激活后
  “保留 strict backend safety floor + 前端兼容回退/服务停用”。后者实际启动 rollback image，并重跑
  application-only 全矩阵：immutable payload semantic digest、artifact gate、唯一 traceable management
  manifest/file digest、稳定 FD/lease、伪 actor、FastAPI raw oversize/duplicate parser、public DTO 脱敏、
  spool privacy/cap/cleanup，以及 PENDING/cross-run insert 拒绝和 V2 trigger/registry digest 不变。任一失败
  只能停服，不能激活该 rollback image。
- trigger expand 是兼容约束而非数据 rewrite。部署前使用旧 P15 image/旧 registry digest 生成并验证
  pre-activation cold backup；activation 后立刻用新 registry digest完成 readiness 与新的 backup/rehearse
  证明。若候选已生成任何新 confirmation receipt，不能用旧 backup 覆盖整个库；activation 后也不能
  重新启动旧 image。
- mixed-version：旧 artifact 无 WorkProduct 继续 download-only；旧已确认 receipt 继续可读，但 public
  projection 从部署时起不再暴露 actor_ref。前端先升级时，缺新 public contract 失败关闭为 unavailable；
  后端先升级时，旧前端因 receipt extra/missing contract 失败关闭，不能猜测或本地补 actor。
- 同一 SQLite 不允许旧/新 backend 并发。只有以 SQLite `mode=ro` 打开且绝不执行 `_initialize()`、
  schema SQL 或 FastAPI storage constructor 的独立 consumer 才算 read-only coexist；当前旧 backend
  不满足。升级顺序与 image pin 由 P15 执行，P14 不隐式扩张为部署权限。
- 数据收缩、旧字段删除、DB VACUUM、artifact 清理和 retention 全部不属于本 Packet。

## 9. 验收节点

固定 mandatory nodes：

1. `P14-IDENTITY-01`：P14 业务安全语义不由 P09/P15 定义，但 P14-G approval base 必须包含已接受的
   P09-A candidate commit/tree 与 accepted P15 candidate commit/tree；raw evidence 从生成时即由 P09-A
   schema/verifier 验证，P15 提供唯一 runtime-data registry/readiness/backup/release verifier，P14 只在其
   后继 child 中把 V2 trigger 加入该 registry。P09-B 最后单向消费 P14 receipt，不反向改变 P14 identity；
2. `P14-MODEL-02`：immutable payload semantic digest、public receipt closed DTO、artifact gate tests PASS；
3. `P14-STORAGE-03`：pending/publish/abort/orphan/hash/append-only、exclusive V2 trigger migration、
   crash/concurrent initializer/postimage tamper、hash 后等长写/rename/时间漂移、P15 registry/readiness/
   backup/release verifier trigger-tamper 与完整 rollback-floor tests PASS；
4. `P14-AUTH-04`：CurrentUser owner/cross-owner/unknown indistinguishability PASS；
5. `P14-DOWNLOAD-05`：published-only、64 MiB cap、verified stable FD/private spool、owner/process lease、
   原子 process-wide disk reservation、cancel/cleanup、special-link reject、fixed safe headers PASS；
6. `P14-CONFIRM-06`：PENDING/ABORTED/cross-run/digest drift 零 receipt，PUBLISHED exact binding only，
   one terminal decision、refresh replay、inverse/duplicate 409 PASS；
7. `P14-BFF-07`：HttpOnly session、Origin + Sec-Fetch-Site same-origin、Content-Type、BFF 与 FastAPI raw
   bounded stream、Content-Length 缺失/0/非 canonical/declared-actual drift/中断、fatal UTF-8、
   duplicate-key reject、strict decoder、download declared/actual length与 cancel、no owner/path/token/
   actor_ref PASS；
8. `P14-UI-08`：explicit load、PUBLISHED-only controls、no prefetch、server snapshot only、download-only
   legacy PASS；
9. `P14-REALSTACK-09`：production Next + FastAPI + temp SQLite + deterministic provider PASS；
10. `P14-BROWSER-10`：真实浏览器完整 journey、脱敏截图/console/sanitized request ledger PASS；raw
    trace/HAR 不生成、不留存；
11. `P14-PRIVACY-11`：日志/响应/截图/留存网络证据 canary 零命中与受控 worktree 零写 PASS；
12. `P14-CLEANUP-12`：正常与失败路径端口、线程、子进程、临时文件零残留；
13. `P14-REGRESSION-13`：Profile S 后端相关矩阵、前端 674 基线、build/doctor 无回归；
14. `P14-REVIEW-14`：独立 backend/frontend/security review 均 GO；
15. `P14-AUTHORITY-15`：known gap 不能由验证 receipt 关闭；exact M0/candidate/Owner acceptance 完整，
    P09 只消费最终 P14 receipt。

任一 mandatory node 为 FAIL、BLOCKED 或 NOT_RUN，P14 不得标记 covered/migrated，P09 overall 不得
VERIFIED。

## 10. Owner 选择与当前停止点

Owner 已于本任务选择 Batch 1，但该方向确认不等于 P14 产品 M0。当前允许继续：冻结合同、运行
P14-R 的安全只读/临时 RED 与回归、整理 evidence、编制独立 P14-G M0。当前不允许：修改产品、
提交、推送、部署、读取真实
用户数据或把历史 PASS 当当前 release 证明。

下一安全动作是先落地本节冻结的继任兼容 governance approval/candidate，再从其远端 exact head 把
已确认 RED 与 21 条 exact paths 转成新的 P14-G machine-readable M0 候选。只有 Owner 接受新版
approval 且机器 `--authorize` 返回 GO 后才恢复产品施工；旧 20 路径 approval 不得继续消费，P14 也
不能以“已覆盖”跳过修复。
