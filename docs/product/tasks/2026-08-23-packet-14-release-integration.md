# Packet 14 — Trusted Artifact Delivery Release Integration M0 Task

> 状态：`M0_CANDIDATE / NOT_LANDED / PRODUCT_STOP`
>
> Task ID：`PACKET-14-TRUSTED-ARTIFACT-DELIVERY-RELEASE-INTEGRATION-V1-20260823`

## Status

Draft

## Product Definition

把 P14 会计产物安全纵切与 P15 离线发布链接成同一主体：确认只作用于同 owner、同 run、真实 PUBLISHED
且 digest 完整绑定的唯一 management workbook；下载在任何整文件读取前先取得 owner/process 租约；V2 安全
底座在 decree writer 启动前完成并验证；Python readiness/backup 与 Node manifest/build/verify/acceptance 使用同一
runtime registry digest；真实浏览器验收由已有 P15 acceptance orchestrator 持有候选容器并生成本轮候选回执。

固定身份：

- Repository：`gitee.com/msxn/chaotang-os`
- Target：`origin/ext-dev`
- Base commit/tree：`563889d555db64b68aab04f816f1e873593641af` / `fd2c794fa3cac7526a7b16514b26c556e36f4c3b`
- Amendment：`docs/migrations/2026-08-23-packet-14-release-integration-amendment.draft.md`
- Amendment SHA-256：`d870c969364a665b9c2f433087d05a9c085fd706ea6c8b32b670281ed48f5c69`
- Predecessor approval digest：`sha256:b74bf2ea38ee75fc31af25b7f65bab8a00feaf9551028a661f7cef0d347f09be`
- Rejected candidate/tree：`7ca598a5136b1f315496bd7a50305d7f8efec610` / `77c7862151ba4cdb76702ac5fa70411f0030d85f`
- Rejected machine evidence：`sha256:e2cdfdef084de6f1c2a176c0fafcbc8c46beac1fdf5324f1e284459317986615`

旧候选机器矩阵通过后，独立复审发现 release digest 分裂、writer 先于 V2 activation、下载租约过晚及异常清理
缺口，故不得推送。旧本地修订只能在本任务获得机器授权后最小重放。

## Acceptance Criteria

- [ ] amendment 12 nodes 与继承的 REALSTACK/BROWSER/PRIVACY/CLEANUP 全部 PASS；任一 FAIL/BLOCKED/NOT_RUN 停止。
- [ ] 下载租约在首次整文件读取/hash前生效；所有失败后计数、owners、reserved bytes、FD、spool 全归零。
- [ ] PENDING/ABORTED/cross-owner/cross-run/drift/tamper 零 receipt；完整性错误优先于终局冲突。
- [ ] legacy DB 在 writer 构造/启动前迁移到 V2；失败零 writer/零业务写；worker-disabled 仍 activation/verify。
- [ ] Python registry、Schema、builder、verifier、acceptance runner 使用唯一新 digest；旧值/漂移拒绝。
- [ ] successor manifest/bundle/verification/acceptance 全部重生成；历史 receipt/rollback anchor 只作引用，旧 PASS 禁复用。
- [ ] `scripts/run_rc1_release_acceptance.mjs` 从 candidate snapshot 构建隔离 TEST/runtime 与 backend/frontend/caddy OCI；新增入口必须与现有 `runAcceptance` / `POST_ACCEPTANCE_FINAL` 分离，仅生成 `rc1-prepush-browser-round.v1`。在清理前仅向 loopback 发布随机 edge 端点，原子写入 closed browser session descriptor，保持本轮容器至受控浏览器完成双 owner journey，校验 bounded sanitized receipt/artifact digests 后清理。超时、伪 receipt、candidate/session mismatch、浏览器失败或 cleanup 残留均 provisional round FAILED。
- [ ] runner-owned edge proxy 生成完整16-action authoritative ledger并覆盖全部业务请求；runner 独立重验 job/artifact/receipt/owner poststate，空请求、自报 PASS、伪 ledger 或额外 receipt 均不得生成 provisional PASS。
- [ ] pre-push round 固定 `phase=PRE_ACCEPTANCE_PROVISIONAL`、`nonAuthorizing=true`、`remoteHead=null`、`externalEffectAuthorized=false`，只绑定 local candidate；现有 final acceptance、release verifier/manifest 与 P09 envelope 必须拒绝 provisional schema。candidate 真正成为远端头后，才运行原有 `POST_ACCEPTANCE_FINAL` 并在独立 release 阶段生成 P09-A closed envelope。
- [ ] P15 隔离 backend full+Ruff、frontend full、release regressions、V2、Root Harness/doctor 全绿，独立 code/security review 无 P0–P3。

## Delivery Constraints

只允许 manifest 的30条产品路径。不得新增表/列、API namespace、上传、格式、第二 registry/ledger。P15 acceptance
browser session 只服务本地候选验收：随机 loopback、一次性 nonce、bounded closed descriptor/receipt、零生产端点、零外网、
零 raw HAR/trace、完成即清理；不得把 browser command、宿主环境或 client 字段变成执行 authority。runner 同时持有两个
随机 loopback server：edge proxy 是浏览器唯一业务入口，转发到本轮 caddy，并由 runner 独立生成 authoritative request ledger；
collector 只接收固定三类 artifact 与最终 receipt。页面只与 edge 交互；artifact/receipt 由受控 browser controller 的
out-of-page loopback HTTP client 上传，页面 JS 永远不得读取 collector origin/session nonce，也不允许 CORS、OPTIONS 或 CSP 放宽。
session 根由 runner
在受控 acceptance root 内以 `root:<本轮untrusted gid>` / `0750` 新建，descriptor 以 `root:<本轮untrusted gid>` / `0440`
原子生成，regular/nlink1，大小 `<=4096 bytes`；browser 只以本轮固定 non-root uid/gid 读取，不能写 session root。runner
私有 artifact root 为 `root:root` / `0700`。浏览器不得提交 path、filename、URI、
manifest path 或 filesystem ref；runner 自持有独立随机 loopback collector，按固定 artifact ID/route 接收一次 bounded body，
以 root-controlled fixed basename + `wx` 保存并校验。collector 拒绝 redirect、query、chunked/未知 length、重复 upload、
错误 nonce/session/content-type 与 deadline 外请求。collector exact POST routes 仅为 `/v1/artifacts/screenshot-before`、
`/v1/artifacts/screenshot-confirmed`、`/v1/artifacts/console-summary`、`/v1/receipt`；client 上传 ledger 或请求其它 route 必须拒绝。
session 与 nonce 只在 exact `X-Chaotang-Browser-Session` / `Authorization: Bearer <nonce>` headers，日志必须脱敏。
PNG route 只收 `image/png`，JSON route/receipt 只收 `application/json`；receipt `<=64 KiB` 且仅在四 artifacts 全部验完后一次接收。`sqlite_backup.py`
和六部 adapter test 仍限于原合同机械兼容。M0/候选不得读取生产数据、用户工作簿、secret、已有浏览器 profile，
不得真实模型、外网或预制 PASS。产品 push、activation、backup/restore、release/deploy 均需后续独立授权。

edge proxy 与 collector 均只接受 HTTP/1.1 origin-form、exact runner-issued `Host`；POST 必须有且只有一个 canonical decimal
`Content-Length`，body bytes 必须逐字等于声明长度和 route-specific cap；GET 必须无 body、无 `Content-Length`。两者均拒绝
`Transfer-Encoding`、`Expect`、`Upgrade`、`Proxy-Connection`、absolute-form target、重复/冲突 length与pipelining；响应固定
`Connection: close`，`maxRequestsPerSocket=1`并在响应完成后主动关闭。browser-facing edge 允许浏览器自动生成的单值
`Connection: keep-alive`（或缺省），`maxHeadersCount=32`、header bytes `<=16384`；collector 的受控 out-of-page client 必须发送
exact `Connection: close`，`maxHeadersCount=8`、header bytes `<=4096`。两者 `maxConnections=8`，headers/body/idle timeout
分别 `<=5s/10s/10s`，collector单次upload总时限 `<=30s`；任一超限或超时立即 destroy socket、round FAILED并进入同一
finally cleanup。浏览器 controller、edge、collector 不得继承 proxy 环境或自动重试。必须用锁定 Chromium 真实 header fixture
验证页面导航、并发 static assets、Cookie API POST均通过，同时证明第33个header、超总bytes、敏感重复头、CL/TE冲突被拒绝。

## Affected Modules

- 模块：会计产物存储/确认/下载、app startup/readiness、P15 registry/backup/offline release/acceptance、FastAPI/Next BFF、Study UI。
- 允许路径：严格等于 manifest `request.productPaths` 的30条排序路径。
- 非目标：P06、P09-B、其它 Packet、新业务能力、第二事实源或生产部署。

## Technical Plan

按 `docs/superpowers/plans/2026-08-23-packet-14-release-integration.md`：治理 → authorize → RED → download →
activation → registry → existing P14 slice → RC1 real-stack/browser handshake → full verify/review → Owner candidate decision。

## Implementation Report

amendment 已以单文件治理证据进入 remote base `563889d555db64b68aab04f816f1e873593641af`。本三件套仍为
未提交草案；旧21路径候选和本地修订均无 authority。当前产品保持不变。

## Acceptance Review

当前为 `PENDING_OWNER_M0_DECISION / PRODUCT_STOP`。不授权三件套提交/推送、产品修改/推送、activation、backup、
release 或 deploy。

## Required RED Matrix

1. `P14-DOWNLOAD-PRELEASE-01`：并发超限在首次整文件 read/hash 前拒绝。
2. `P14-DOWNLOAD-CLEANUP-02`：损坏 metadata/constructor failure 后 lease/spool/FD 全归零。
3. `P14-DOWNLOAD-CANCEL-03`：invalid MIME/length、short/long stream、client cancel 精确 cleanup。
4. `P14-CONFIRM-ORDER-04`：terminal receipt 后的 payload/binding/file 损坏优先 unavailable，零新 receipt。
5. `P14-ACTIVATION-ORDER-05`：legacy→V2 postimage 在 worker construction/start 前完成。
6. `P14-ACTIVATION-FAIL-06`：busy/partial/tampered/future schema 零 writer/业务写。
7. `P14-ACTIVATION-DISABLED-07`：worker-disabled 仍 activation/verify。
8. `P14-REGISTRY-CROSSLANG-08`：Python/Schema/builder/verifier/runner digest 唯一，旧值/漂移拒绝。
9. `P14-RELEASE-REPLAY-09`：successor evidence 全新，旧 PASS 禁复用，historical anchors 仅引用。
10. `P14-OWNER-ISOLATION-10`：unknown/cross-owner 同形404，私密字段零响应/日志。
11. `P14-LEGACY-11`：ordinary published legacy download 与无关 decree jobs compatible。
12. `P14-FULL-12`：isolated backend full+Ruff、frontend full、release、V2、Harness/doctor 全绿。
13. `P14-REALSTACK-13`：RC1 orchestrator 的 candidate OCI backend/frontend/caddy 与 temp data PASS。
14. `P14-BROWSER-14`：loopback session 内真实双 owner download/confirm/refresh PASS；closed receipt exact绑定 approval/candidate/tree/session/nonce/deadline/actions/assertions/artifacts。
15. `P14-PRIVACY-15`：日志/响应/截图/console/sanitized ledger canary 零命中，零 raw HAR/trace。
16. `P14-CLEANUP-16`：正常、失败、超时、伪 receipt 后容器/network/端口/session temp 零残留。

## Pre-push Browser Wire

四个 JSON object 均 `extra=forbid`、duplicate-key reject，以现有 canonical JSON + `sha256:` lowercase digest；任何未知
schema/version/field、null 替代、数组重排、时间超限或 digest mismatch 均失败关闭：

1. `rc1-prepush-browser-session.v1` exact fields：`schemaVersion, phase, nonAuthorizing, remoteHead,
   externalEffectAuthorized, approvalDigest, candidateCommit, candidateTree, sessionId, nonce, issuedAt, expiresAt,
   edgeOrigin, collectorOrigin, journeyId`。固定值为 schema literal、`PRE_ACCEPTANCE_PROVISIONAL`、`true`、`null`、`false`；
   edgeOrigin 与 collectorOrigin 只能是 runner 分别随机分配的 `http://127.0.0.1:<ephemeral>`；nonce 为 server-owned 32-byte lowercase hex；
   expiresAt 最多晚于 issuedAt 30 分钟；完整 canonical descriptor `<=4096 bytes`。
2. `rc1-prepush-browser-receipt.v1` exact fields：`schemaVersion, phase, approvalDigest, candidateCommit,
   candidateTree, sessionId, nonce, journeyId, startedAt, completedAt, actions, assertions, artifactRefs,
   privacyStatus, consoleErrorCount, requestLedgerDigest, status, receiptDigest`。actions 固定覆盖16个 business action 且按
   ordinal 1..16、全部 PASS；每项 exact fields `ordinal,actionId,ledgerOrdinals,routeDigest,requestDigest,responseDigest,status`。
   actionId 有序 enum 固定为 `OWNER_A_REGISTER,OWNER_A_LOGIN,OWNER_A_DRAFT,OWNER_A_ACCEPT,
   OWNER_A_JOB_POLL,OWNER_A_WORK_PRODUCT_GET,OWNER_A_DOWNLOAD,OWNER_A_CONFIRM,
   OWNER_A_REFRESH_WORK_PRODUCT,OWNER_A_DUPLICATE_CONFIRM,OWNER_A_INVERSE_CONFIRM,
   OWNER_B_REGISTER,OWNER_B_LOGIN,OWNER_B_WORK_PRODUCT_GET,OWNER_B_DOWNLOAD,OWNER_B_CONFIRM`。
   除 `OWNER_A_JOB_POLL` 外 ledgerOrdinals 必须恰含一个 safe integer；poll 必须含 `1..60` 个连续 ledger ordinal。
   三个 digest 均由 runner 从 ledgerOrdinals 所指 authoritative proxy entries 重算：routeDigest 覆盖 ordered
   `{routeId,method,routeTemplate,status}` rows，requestDigest/responseDigest 分别覆盖 ordered entry digests；单项也使用同一
   aggregate payload，禁止直接信任 client 提交值。status 仅 `PASS`。
   assertions 恰5项，每项 exact `assertionId,status,evidenceArtifactIds`，有序 assertionId 固定为
   `OWNER_ISOLATION,PUBLISHED_ONLY_CONTROL,SINGLE_TERMINAL_RECEIPT,REFRESH_REPLAY,PRIVACY_CANARY`，status 仅 PASS；
   evidenceArtifactIds 只能引用下述固定 artifact ID，排序/去重，并分别固定映射为：owner isolation→request ledger；
   published-only→before screenshot+ledger；single terminal/refresh→confirmed screenshot+ledger；privacy→两个 screenshot+
   console+ledger。artifactRefs 必须逐字等于固定有序 ID 列表 `SCREENSHOT_BEFORE,SCREENSHOT_CONFIRMED,CONSOLE_SUMMARY,
   REQUEST_LEDGER`，不含任何 path/filename/URI；status/privacy 固定
   PASS，consoleErrorCount=0。完整 receipt `<=65536 bytes`；receiptDigest 覆盖除自身外完整 canonical object。
3. `rc1-prepush-browser-artifact-manifest.v1` exact fields：`schemaVersion, sessionId, entries, totalBytes,
   manifestDigest`。entries 恰4项并按上述固定 ID 顺序，each exact `artifactId,mediaType,bytes,sha256`，无额外字段，
   mediaType 映射固定为前两项 `image/png`、后两项 `application/json`；前三项由 runner 对 collector 实收 bytes 生成，
   `REQUEST_LEDGER` 由 runner edge proxy 自行生成；client 不得上传 ledger 或提供 manifest。两个 PNG 各 `1..8 MiB`、
   完整 signature/chunk CRC/IHDR/IDAT/IEND、无尾随、
   width/height `1..4096`、decoded RGBA budget `<=64 MiB`，拒绝 text/metadata chunks；`CONSOLE_SUMMARY` exact fields
   `schemaVersion,errors`，schema literal=`rc1-browser-console-summary.v1` 且 errors 必须 exact `[]`；`REQUEST_LEDGER`
   exact fields `schemaVersion,entries,ledgerDigest`，schema literal=`rc1-browser-request-ledger.v1`，entries `16..75`项，
   each exact `ordinal,actionId,routeId,method,routeDigest,requestDigest,responseDigest,sessionBindingDigest,status`，ordinal 从1连续；method enum=
   `GET,POST`，status 为 `100..599` safe integer，三个 digest 为 `sha256:<64hex>`；ledgerDigest 覆盖除自身外 canonical object。
   ledger 禁止 URL/query/header/cookie/token/body，`<=512 KiB`；console `<=256 KiB`；两者 fatal UTF-8、duplicate-key reject、
   Cc/Cf reject；receipt.requestLedgerDigest 必须 exact 等于 ledgerDigest；entries totalBytes 必须等于各 bytes 之和且
   `<=17563648`，manifest `<=65536 bytes`，manifestDigest 覆盖除自身外
   完整 canonical object。duplicate/out-of-order/unknown artifact ID 或 receipt ref mismatch 均拒绝。
   edge proxy 必须按下表生成 ledger，禁止 client 自报 action、route 或 status：

   | actionId | routeId / routeTemplate | method | request body cap | success response cap | exact status |
   | --- | --- | --- | ---: | ---: | --- |
   | `OWNER_A_REGISTER`,`OWNER_B_REGISTER` | `AUTH_REGISTER` / `/api/auth/register` | POST | 8192 bytes | 16384 bytes JSON | 201 |
   | `OWNER_A_LOGIN`,`OWNER_B_LOGIN` | `AUTH_LOGIN` / `/api/auth/login` | POST | 8192 bytes | 16384 bytes JSON | 200 |
   | `OWNER_A_DRAFT` | `CHANCELLOR_DRAFT` / `/api/drafts/chancellor` | POST | 131072 bytes | 262144 bytes JSON | 200 |
   | `OWNER_A_ACCEPT` | `CHANCELLOR_ACCEPT` / `/api/decrees/chancellor` | POST | 16384 bytes | 65536 bytes JSON | 202 |
   | `OWNER_A_JOB_POLL` | `DECREE_JOB` / `/api/decree-jobs/{jobId}` | GET | 0 | 1048576 bytes JSON | 200，1..60次，最后响应 strict state=`SUCCEEDED` |
   | `OWNER_A_WORK_PRODUCT_GET`,`OWNER_A_REFRESH_WORK_PRODUCT`,`OWNER_B_WORK_PRODUCT_GET` | `REPORT_WORK_PRODUCT` / `/api/report-artifacts/{artifactId}/work-product` | GET | 0 | 262144 bytes JSON | 200 / 200 / 404 |
   | `OWNER_A_DOWNLOAD`,`OWNER_B_DOWNLOAD` | `REPORT_DOWNLOAD` / `/api/report-artifacts/{artifactId}` | GET | 0 | 1..67108864 bytes XLSX stream | 200 / 404 |
   | `OWNER_A_CONFIRM`,`OWNER_A_DUPLICATE_CONFIRM`,`OWNER_A_INVERSE_CONFIRM`,`OWNER_B_CONFIRM` | `REPORT_CONFIRMATION` / `/api/report-artifacts/{artifactId}/confirmation` | POST | 8192 bytes | 262144 bytes JSON | 200 / 409 / 409 / 404 |

   edge 在读取任何 POST body byte 前按表中 exact cap 检查 canonical Content-Length，超限立即拒绝；不得把 cap 配成实现参数。
   所有非成功 JSON response 另有统一 `16384 bytes` cap。JSON content-type 只接受 ASCII lower/trim 后 exact
   `application/json` 或 `application/json; charset=utf-8`；先分块计数，完整结束且未超 cap 后才允许在内存 strict-decode。
   edge 不得透传浏览器 `Accept-Encoding`，对每个 upstream request 强制单值 `Accept-Encoding: identity`；JSON、HTML、static、
   XLSX response 在读取首个 body byte前只接受缺失 `Content-Encoding` 或 exact单值 `identity`，gzip/br/deflate/多值/重复均
   cancel/destroy且不得parse、转发或写证据。
   declared length 超 cap 必须在读 body 前拒绝；缺失 length、chunked 或持续发送的 response 在实际第 `cap+1` byte 立即
   cancel/destroy upstream，禁止 parse、继续转发或写 PASS evidence。每个 upstream request 从发起时开始计时：connect
   `<=5s`、完整 response headers `<=10s`、body idle `<=10s`；JSON/HTML/static total `<=30s`，不得从收到headers后才起算。
   download 200 必须为 exact XLSX MIME、canonical Content-Length `1..67108864` 且实际相等，边转发边计算 response digest，
   禁止整文件 buffer；download total从upstream dispatch起 `<=120s`。download 404仍走16KiB JSON error cap。HTML document 每响应 `<=4194304 bytes`，
   其它同源 static asset 每响应 `<=16777216 bytes`；每轮所有 upstream response actual bytes aggregate
   `<=268435456`，超限立即中止所有 active upstream、round FAILED并执行完整cleanup。
   routeDigest 由 runner 对 exact canonical payload
   `{schemaVersion:"rc1-browser-route.v1",routeId,method,routeTemplate}` 计算。`jobId` / `artifactId` 必须是 runner 从前序
   strict-decoded candidate response 获得的 server-derived safe segment；仅在 exact segment 位置规范化成模板占位符，未知、
   不匹配、query 或其它 `/api/` route 一律失败；非 API static asset 不进 ledger。每个 business ledger entry 必须被恰好
   一个 action 的 ledgerOrdinals 引用，且所有 action 反向覆盖全部 business entries，无缺失、重复或多余。

   `OWNER_A_LOGIN` / `OWNER_B_LOGIN` 的200 response 必须各含一个 server-issued `courtos_session`，runner 只在内存按
   URL-safe opaque token `[A-Za-z0-9_-]{43}` 捕获，并绑定同一 strict-decoded login identity；A/B token 必须非空且不同。
   REGISTER与LOGIN request的 `sessionBindingDigest=null`；其余每条A/B ledger entry必须分别带 runner 计算的
   `sha256:` digest of canonical `{schemaVersion:"rc1-browser-session-binding.v1",ownerRole,ownerId,sessionToken}`。
   fresh browser context 的对应 request `Cookie` 必须恰为单个 `courtos_session=<该token>`，禁止 missing、swapped、stale、
   duplicate、额外 cookie或 `Authorization`；raw token、Cookie、Set-Cookie不得进入ledger/receipt/manifest/round/log。
   edge 在转发前 constant-time 比较 token，且 poststate Owner A/B IDs 必须逐字等于各自 login identity；B的三个404仅在
   authenticated B binding exact通过后才可计入 isolation PASS。

   edge proxy 对 request/response exact proxied bytes 分块计算 digest，不保留、不记录 raw body；只在内存 strict-decode
   必需的最小 projection：Owner A/B identity、draft/accept job ID、job final `SUCCEEDED`、artifact/work-product ID与
   `PUBLISHED` 状态、confirmation receipt identity，以及固定404/409结果。浏览器结束后、provisional PASS 前，runner 必须
   再以只读 candidate API/临时 datastore 独立验证：Owner A 恰一条相关 `SUCCEEDED` job；恰一条 PUBLISHED artifact/work
   product 且 file/payload/manifest digests匹配；恰一条 terminal `CONFIRMED` receipt，actor=`user:<ownerA id>`；refresh
   返回同一 receipt；duplicate、inverse 与 Owner B 尝试均未新增 receipt；Owner B 无 ownership/receipt；最终 receipt count
   仍为1。client自报 PASS、截图或结构合法 receipt 均不能替代该 poststate；任一不符 round FAILED并清理。
4. `rc1-prepush-browser-round.v1` exact fields：`schemaVersion, phase, nonAuthorizing, remoteHead,
   externalEffectAuthorized, approvalDigest, candidateCommit, candidateTree, candidateParent, sessionId,
   sessionNonceDigest, issuedAt, expiresAt, browserReceiptDigest, artifactManifestDigest, privacyStatus,
   cleanupStatus, status, roundDigest`。固定 provisional/non-authorizing/null/false；status/privacy/cleanup 仅可 PASS；
   roundDigest 覆盖除自身外完整 canonical object，round `<=65536 bytes`，整个 session evidence bytes 总计
   `<=18874368`。raw nonce、edge/collector origin、path、cookie、token 不进入 round。

所有 action/assertion/artifact arrays 在 digest 前先按上述唯一固定顺序验证，禁止由实现自行排序来掩盖输入重排。
Privacy PASS 必须扫描 backend/frontend/caddy logs、browser console summary、request ledger、receipt/manifest/round 的全部
JSON key/string，且浏览器在每次截图前对完整 DOM text/attributes 做 synthetic canary 零命中断言；PNG 拒绝全部 text/
metadata chunks。任何 canary 命中都删除 provisional PASS、执行 cleanup并返回 FAILED。

负测必须覆盖 unknown nested field、duplicate/reordered/missing action/assertion/artifact、oversize、digest/ref mismatch、
wrong media type、PNG truncation/CRC/metadata/dimension/decode bomb、JSON duplicate/control、wrong uid/gid/mode/nlink、
descriptor/session-root tamper、重复/过期 upload、absolute/relative path字段注入与 canary 命中；还必须覆盖 slow header/body、
Content-Length drift、TE+CL、Expect/Upgrade、pipeline、connection flood、edge超32头/16KiB、collector keepalive/超8头/4KiB、
collector OPTIONS/CORS、client ledger upload、
空 ledger、错误 action/route/method/status/digest mapping、缺失/重复/额外 business request、最终 poll 非 SUCCEEDED、
poststate tamper、额外 receipt、owner/job/artifact splice；response 负测还必须覆盖 declared/undeclared/chunked oversized、
持续发送超限、JSON cap+1、XLSX length/MIME漂移、static/session aggregate超限、upstream abort。所有网络负测均须证明
socket/port/container/temp/lease 精确清理。身份负测必须覆盖无Cookie、错误Cookie、A Cookie冒充B、A/B交换、旧token重放、
重复/额外cookie与login identity/poststate owner splice。编码/时钟负测必须覆盖浏览器gzip/br请求被改写为identity、upstream
gzip/br/多值/重复Content-Encoding、never-headers、slow-headers、headers后idle与持续小流量超total deadline。

现有 `rc1-acceptance-round.v1`、`POST_ACCEPTANCE_FINAL`、release manifest/verifier 与 P09 typed envelope 不得接受、升级、
转换或引用上述 provisional schema；两个模式不得共享输出文件名或 evidence root。正式 release 证据仍只由 push 后原链生成。

## Rollback

activation 前可 revert 唯一 product child。activation 后 V2、owner/binding/file guard、strict parser/public DTO、
FD/lease/cleanup 与新 registry digest 是永久安全底座；禁 full revert、旧 writer 或覆盖新 receipt 的 cold restore，只能
另批 forward-compatible child，否则停服。
