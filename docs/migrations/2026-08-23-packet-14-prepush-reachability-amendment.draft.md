# Packet 14 — Pre-push Browser Reachability Amendment

> 状态：`CONTRACT_AMENDMENT_DRAFT / PRODUCT_STOP / NON_AUTHORIZING`
>
> 日期：`2026-08-23`

## 1. 冻结身份与边界

- Repository：`gitee.com/msxn/chaotang-os`
- Target：`origin/ext-dev`
- 当前远端/治理基线：`76839a8e8fc4814fb327debbd3a0f18b6409b7d8`
- 基线 tree：`a6839a6c8774524f932a6c67fa092c585485908a`
- 现行 task：`PACKET-14-TRUSTED-ARTIFACT-DELIVERY-RELEASE-INTEGRATION-V1-20260823`
- 现行 task raw SHA-256：`bfe7282b4f456534d8c2adecc0fb03ba26ca7837058f66296243c44dc56916d7`
- 现行 approval canonical digest：`sha256:1aec183e13c8d8ec9a0e49676d97d14ca739a4b49d586bb9ce818b283803e3a2`
- 本 amendment 不增加产品路径；后继 M0 的 `productPaths` 必须仍严格等于现行 approval 的 30 条路径。
- 当前已授权但未提交的 30-path 产品修改必须保留在隔离工作树；本 amendment 未获批并成为远端头前，不得继续形成产品 commit、push、release 或 deploy。

## 2. 发现的不可达合同

现行 task 同时要求：

1. 浏览器经 candidate OCI backend/frontend/caddy 完成 `DRAFT -> ACCEPT -> fresh SUCCEEDED job -> fresh PUBLISHED artifact`；
2. 整轮零外网、零真实模型、零 secret、零预制 PASS；
3. 产品候选严格限制在既有 30 paths。

三者在当前实现中不能同时成立：

- `POST /api/v1/chancellor-drafts` 的 `DRAFT_READY` 正常路径必须调用 DeepSeek provider；只有 `NEEDS_INPUT` 有无模型确定性分支，而该分支不注册可签发 draft authority。
- `POST /api/v1/decrees/chancellor` 在 idempotency replay 之外必须消费同进程的 draft authority；不能从外部预置合法 authority。
- candidate backend OCI 只包含生产 wheel 与 production config，不包含 `backend/tests` 或 synthetic acceptance app。
- 现有 smoke seed 只提供历史合成数据库；把预置 `SUCCEEDED/PUBLISHED/CONFIRMED` 行伪装成浏览器刚生成的任务，会违反“零预制 PASS”。
- 在 30 paths 内新增生产环境开关、假 provider、隐藏 draft 注入接口或测试专用 API，都会扩大运行时攻击面并越过现行合同。

因此，现行 16-action browser wire 即使结构全绿，也无法诚实证明它声称的 candidate-OCI fresh generation。不得以 mock、请求拦截、假模型、预置 terminal job 或 synthetic app 冒充 candidate production backend。

## 3. 修正后的证据分工

后继 task 必须把三个证明拆开，且任何一个都不得替代另一个：

### 3.1 `P14-REALSTACK`

继续由 P15 RC1 orchestrator 从同一 candidate commit/tree 构建、导入并启动 candidate OCI backend/frontend/caddy，验证只读 rootfs、临时 data、health/readiness、registry digest、容器身份、network/port/session cleanup。该节点不声称模型调用或新制品生成成功。

### 3.2 `P14-GENERATION`

继续运行现有隔离 `backend/tests/run_accounting_synthetic_acceptance.py --rounds 1`：

- 解释器、candidate wheel、RUNTIME/TEST closure、source snapshot 与 candidate commit/tree 必须沿用 P15 锁定 provenance；
- 必须实际经过 draft authority、accept、async worker、accounting generation、archive、publish 与 owner-filtered read；
- synthetic provider/source 只属于该隔离测试进程，不得进入 candidate OCI、产品配置、产品 evidence 或浏览器 round；
- 该节点证明“候选 wheel 的生成全链”，不冒充 production-provider 或 candidate-OCI browser 证据。

### 3.3 `P14-DELIVERY-BROWSER`

真实 Chromium 必须经 runner-owned edge 访问 candidate OCI frontend/caddy/backend，并只验证本 Packet 拥有的交付纵切：

- owner A/B 注册、登录与 server-issued session 绑定；
- owner A 的 PUBLISHED management workbook 显示、下载、确认、刷新、重复/反向确认拒绝；
- authenticated owner B 对同一 work product/download/confirmation 的同形 404；
- candidate API/temp datastore 独立证明唯一 terminal receipt、Owner B 零所有权；
- screenshot、console、privacy、bounded ledger、provisional/final schema separation 与完整 cleanup。

浏览器 round 不再声称它创建了 draft、job 或 workbook；相应 action 不得出现在 ledger。

## 4. 非授权 fixture 边界

为使 candidate OCI 页面能显示 P14 交付对象，runner 可在 owner A 完成真实注册/登录后暂停浏览器动作，停止 candidate backend/writer，再以同一 candidate backend image 启动一次性 non-root seed container，调用 candidate wheel 中 `app.operations.sqlite_backup` 的新 closed subcommand，向本轮全新临时 data root 写入一个 delivery fixture。seed 完成并重验后必须销毁 seed container、重启原 candidate backend、通过 `/readyz`，然后才可继续浏览器。该能力受以下闭合条件约束：

1. subcommand 固定为 `seed-p14-prepush-delivery-fixture`，不得由 app router、worker、环境启动钩子或生产 API 调用；
2. runner 必须先停止原 backend container，核验 exact container ID 已 stopped、worker 不再运行、同一 data root 无第二 writer。runner 只可 `docker create` 一个 seed container，尚未 start 时先以 `docker inspect` 逐字验证：同一 candidate image ID/digest与 revision/tree labels、fixed `/opt/runtime/bin/python -m app.operations.sqlite_backup seed-p14-prepush-delivery-fixture --root /app/data --marker /run/chaotang/p14-fixture.consumed` argv、exact non-root `10002:10002`、`--network=none`、read-only rootfs、closed env、零 secret/provider env、exact两个bind mount；验证后才可 start/attach一次。runner 记录 exact 64hex container ID，所有退出路径只按该ID清理；
3. CLI 不接受 owner/nonce/commit/tree/image等自由参数，也不得把 caller 回显当 provenance。candidate commit/tree/image ID 由 runner 对 product-authority identity、image inspect与container inspect独立绑定；CLI 还必须验证 `chaotang-os-backend` distribution 位于只读 `/app`、RECORD可重放且 app code来自同一wheel projection。owner A ID、fixture nonce、candidate identity与host-root identity只来自已验证marker；owner A 的 user、已撤销registration session与current login session必须已由真实 register/login BFF 写入并在 restart 后保持精确状态；
4. marker 不得位于 data root，也不得加入 readiness/runtime registry allowlist。runner 私有 session root 固定 `root:root/0700`；marker以 `wx` 创建后固定 `root:10002/0440`、regular/nlink1、canonical JSON `<=4096 bytes`。marker schema `rc1-prepush-fixture-marker.v1` exact fields为 `schemaVersion,roundId,sessionId,candidateCommit,candidateTree,candidateImageId,hostRootIdentityDigest,ownerUserId,fixtureNonceDigest,preimageDigest,issuedAt,expiresAt,markerDigest`，extra/duplicate/Cc/Cf/非canonical/过期/digest mismatch均拒绝。开始seed前runner将唯一 `.ready` marker原子rename为固定 `.consumed` basename并fsync父目录；只把该文件以read-only/nosuid/nodev/noexec single-file bind挂到容器固定 `/run/chaotang/p14-fixture.consumed`。seed `10002:10002`可读，普通app container从不挂载且不可见；wrong uid/gid/mode、第二container、第二start或第二consume均拒绝；
5. runner 停写后必须生成并验证 `rc1-p14-fixture-preimage.v1`：覆盖 runtime registry exact七个SQLite文件、`report_artifacts/`全树、每个路径的root-relative identity与逻辑内容digest。允许状态严格等于本轮 `sqlite_backup synthetic -> rehearse` baseline，加上且只加一个由本轮真实注册/登录BFF产生的Owner-A user与两个distinct session rows：registration-issued row必须同owner、`revoked_at`非空且不可再认证，login-issued row必须同owner、未撤销且精确绑定浏览器current Cookie/session binding；registration-issued session不得用于任何后续业务动作。baseline既有行/文件必须逐字保持，除该auth delta外所有表无新增行，且新增P14 job/work-product/artifact/confirmation receipt均为0；unknown top-level、nested file、row、WAL状态、第二用户或第三session一律拒绝；
6. data root由runner预先以directory fd固定host canonical realpath/dev/ino/uid/gid/mode与host mount facts；容器内固定 `/app/data` 必须由inspect映射到该exact host source，并在运行态fstat为同一底层dev/ino/uid/gid/mode。host与各container mount namespace/path identity分别取证，不要求namespace mount ID或path digest逐字相等。CLI对所有七库与artifact路径只允许相对该dirfd的closed basename，使用`openat`/`O_NOFOLLOW|O_CLOEXEC`，拒绝absolute/`..`、任意ancestor/nested symlink、hardlink、nested mount、非regular/non-directory、wrong dev/ino/nlink/uid/gid/mode；每次SQLite open、artifact create与写前后均重验同一底层root/path identity。只生成一个 `SUCCEEDED` display job、一个 work product、一个 `PUBLISHED` management workbook及必要archive/binding；confirmation receipts必须为零；不得写PASS、browser receipt、release evidence、provider result或第二authority；
7. fixture artifact bytes 必须由 candidate wheel 内固定的最小 XLSX fixture generator 现场生成并重验ZIP/XLSX、size与digest；它只提供交付测试对象，不得声称运行了accounting generation，也不得复制预制workbook/PASS blob；
8. 多DB/文件不宣称跨库原子事务。seed必须按closed顺序写入、逐库commit+fsync、artifact file fsync、parent fsync，再从只读新连接重验exact `rc1-p14-fixture-postimage.v1`、host-root identity与seed bind identity。任一异常、锁争用、identity替换、partial postimage或超时都不得重启backend，必须销毁整个本轮data root、seed container、consumed marker与browser round；不得尝试把partial root修补成PASS；
9. subcommand成功stdout必须恰为一行canonical JSON加单个LF、fatal UTF-8、`<=8192 bytes`、stderr为空、exit=0；schema `p14-prepush-delivery-fixture.v1` exact fields为 `schemaVersion,candidateImageId,sessionId,ownerUserIdDigest,hostRootIdentityDigest,containerDataRootIdentityDigest,preimageDigest,postimageDigest,jobId,idempotencyKeyDigest,artifactId,workProductId,artifactSha256,fixtureDigest`，所有digest为`sha256:<64hex>`且fixtureDigest覆盖除自身外完整object。`containerDataRootIdentityDigest`必须由CLI对`/app/data`的独立dirfd/fstat证据计算，不得回显marker；runner再与host identity、seed container inspect独立组成binding evidence。raw owner/session token、password、Cookie、fixture nonce、路径、workbook内容不得输出。任一nonzero、额外stdout、stderr敏感值、duplicate/extra/Cc/Cf、invalid digest均不得产生fixtureDigest并销毁整轮；
10. runner每轮只允许exact一个seed container ID和一次`.ready -> .consumed`；runner在rename后、start前另以`wx`写入私有`rc1-p14-fixture-consumption.v1`，exact fields为`schemaVersion,roundId,sessionId,markerDigest,seedContainerId,candidateImageId,consumedAt,consumptionDigest`，将consumed marker与随后唯一container start/exit evidence绑定。seed成功后runner必须先删除consumed marker并fsync父目录，销毁seed container，再启动原exact backend container；backend必须通过readiness closed layout（data root无marker/unknown top-level）、registry digest、原exact backend container的host-root/bind identity、registration session仍已撤销、current login session可重放与fixture read-only poststate检查，之后才允许`sessionStorage`注入和任何后续browser action；
11. runner只把该对象的digest写入私有round input；浏览器页面不得读取fixture nonce、manifest path或宿主路径；
12. fixture只证明交付对象的受控初始状态，不计为generation PASS；`P14-GENERATION`仍必须独立通过；
13. 正常、失败、超时与伪receipt后，fixture data随本轮temp root销毁；不得向生产数据、现有用户DB、backup、release bundle或历史证据复制。

### 4.1 Path、preimage 与 postimage closed wire

本节所有对象均 fatal UTF-8、duplicate/extra/Cc/Cf reject，使用现有 canonical JSON 与 `sha256:` lowercase SHA-256；数组顺序固定，不接受调用者自选字段：

1. data-root binding拆成三个对象，不跨namespace比较path/mount identity：`rc1-p14-host-root-identity.v1` exact fields为`schemaVersion,canonicalPathDigest,device,inode,uid,gid,mode,hostMountFactsDigest,hostRootIdentityDigest`；`rc1-p14-container-bind-identity.v1` exact fields为`schemaVersion,role,containerId,candidateImageId,inspectSourcePathDigest,inspectDestination,inspectReadWrite,device,inode,uid,gid,mode,containerDataRootIdentityDigest,containerBindIdentityDigest`，其中role固定`backend`或`seed`、destination固定`/app/data`、readWrite固定true；`rc1-p14-data-root-binding.v1` exact fields为`schemaVersion,hostRootIdentityDigest,backendBindIdentityDigest,seedBindIdentityDigest,bindingDigest`。全部数值字段为无前导零十进制字符串；raw canonical path不进公开evidence。runner以host dirfd重算host object，以container inspect source映射及运行态fstat分别重算bind object；原backend在stop前与同ID restart后必须得到同一个backend bind digest，seed独立得到seed bind digest，二者的底层dev/ino/uid/gid/mode必须等于host object。host/container path digest与mount namespace ID不要求相等；wrong source/target/inode、nested mount或任一底层属性不一致拒绝。
2. `rc1-p14-fixture-database.v1` exact fields：`name,schemaContractDigest,logicalContentDigest,rowCounts`。七项按runtime registry顺序逐项覆盖`decree_jobs.sqlite3,jinyiwei.sqlite3,junjichu_cases.sqlite3,qintianjian.sqlite3,report_artifacts.sqlite3,runtime_bindings.sqlite3,shiguan.sqlite3`；`rowCounts`为按表名字典序的exact closed rows。logical digest必须覆盖每表按主键/冻结键排序的全部typed values、NULL/type/framing，不能用file bytes或row count冒充。
3. `rc1-p14-fixture-auth-delta.v1` exact fields：`ownerUserIdDigest,userRowDigest,registrationSessionRowDigest,registrationSessionExpiresAt,registrationSessionRevokedAt,loginSessionRowDigest,loginSessionExpiresAt`。只允许一个Owner-A user与恰两个distinct session rows相对synthetic baseline新增：registration row必须同owner且已撤销，login row必须同owner、未撤销并与浏览器current Cookie/session binding精确一致；两行主键/digest不得相同或交换，registration row不得用于后续动作。raw user ID/session token/password hash/Cookie不进入公开evidence，只保留root私有preimage对象和其digest。
4. `rc1-p14-fixture-preimage.v1` exact fields：`schemaVersion,registryDigest,sourceSnapshotIdentity,hostRootIdentityDigest,databases,artifactTreeDigest,authDelta,preimageDigest`。`databases`恰七项；sourceSnapshotIdentity必须等于本轮`sqlite_backup synthetic -> rehearse`已验证identity；除authDelta外，七库logical digests与artifact tree必须逐字等于该baseline。preimage完整canonical bytes `<=262144`。
5. `rc1-p14-fixture-postimage.v1` exact fields：`schemaVersion,preimageDigest,hostRootIdentityDigest,databases,artifactTreeDigest,fixtureProjection,postimageDigest`。fixtureProjection exact fields为`jobId,idempotencyKeyDigest,artifactId,workProductId,ownerUserIdDigest,runId,replyId,artifactSha256,artifactBytes,artifactState,confirmationReceiptCount`；ID使用既有产品validators，artifactState固定`PUBLISHED`，confirmationReceiptCount固定0。相对preimage只允许closed fixture所需rows及一个valid XLSX file，所有其它row/file digest不变；postimage完整canonical bytes`<=262144`。
6. `rc1-p14-fixture-consumption.v1`与marker/output各自`<=4096/8192 bytes`，时间统一UTC六微秒`Z`且在session deadline内；container ID固定64 lowercase hex，candidate image ID固定`sha256:<64hex>`。任何字段无法独立重算时不得生成PASS或fixtureDigest。

## 5. 修正后的浏览器动作

browser wire 升级为 `rc1-prepush-browser-*.v2`；v1 与 v2 必须互相拒收。除本节明确修改的 action/fixture 绑定外，现行 v1 的 canonical JSON、digest、size、HTTP framing、response cap、session binding、privacy、PNG、collector、timeout、cleanup 与 provisional/final 隔离规则全部原样继承。

v2 ledger 固定覆盖以下 14 个 action，按表中顺序且无其它 business entry：

1. `OWNER_A_REGISTER`
2. `OWNER_A_LOGIN`
3. `OWNER_A_JOB_RESUME`（1..60 次 GET，最后 strict `SUCCEEDED`；job ID 来自 fixture digest 绑定的 server-side state，不来自页面自由输入）
4. `OWNER_A_WORK_PRODUCT_GET`
5. `OWNER_A_DOWNLOAD`
6. `OWNER_A_CONFIRM`
7. `OWNER_A_REFRESH_WORK_PRODUCT`
8. `OWNER_A_DUPLICATE_CONFIRM`
9. `OWNER_A_INVERSE_CONFIRM`
10. `OWNER_B_REGISTER`
11. `OWNER_B_LOGIN`
12. `OWNER_B_WORK_PRODUCT_GET`
13. `OWNER_B_DOWNLOAD`
14. `OWNER_B_CONFIRM`

runner 只可通过受控 browser controller 在 fresh owner-A context 写入现有 owner-scoped `sessionStorage` active-job key，使 candidate Study UI 走既有 resume/poll/render 路径；值只能是 fixture 绑定的 job ID/idempotency key，写入后立即由页面自身 strict parser 读取。禁止使用 `localStorage`，也禁止新增 query、debug route、global storage key或产品测试开关。

fixture 在 session 签发后才存在，因此 v2 session 不得包含或预言 `fixtureDigest`；v2 receipt 与 round 必须新增 `fixtureDigest`，其值来自 runner 独立验证的 closed fixture stdout。artifact ID 必须从最终 SUCCEEDED job response严格解码，不能直接信任 fixture stdout或客户端字段。fixture、job response、work product、download与confirmation中的 owner/run/artifact/digest 任一不一致均失败关闭。

## 6. 必需 RED 与真实链

后继 task 至少新增并锁定：

1. provider missing时 production draft 不得被浏览器 gate伪造为 DRAFT_READY；
2. fixture subcommand对无 marker、旧/生产 root、错误 owner/candidate/session、symlink、复用 nonce、已有 receipt、第二 artifact 全部零写拒绝；auth delta缺session、同row/digest、register/login交换、第三session、wrong-owner或current-login已撤销也必须零写拒绝；
3. fixture stdout/client/sessionStorage/job response/artifact splice 全部拒绝；
4. v1/v2 receipt、round、manifest、ledger 双向拒收；
5. 浏览器 ledger 缺少/额外 draft或accept action必须拒绝；
6. candidate Study UI 必须通过真实 resume/poll 显示 PUBLISHED workbook，确认前后各有截图且 DOM/privacy canary PASS；
7. authenticated owner B 的三条 404 必须绑定 B 的 current Cookie，不得以未认证 404 冒充；
8. generation、real-stack、delivery-browser 三节点中任一 NOT_RUN/FAIL/BLOCKED，P14 candidate 均不得提交或推送；
9. writer-active、错误/still-running backend ID、第二 writer、marker 位于 data root、partial multi-DB postimage、marker残留或restart后session失效均失败关闭；
10. 正常、browser failure、fixture failure、timeout、伪 receipt 后原backend/seed container/network/port/session/fixture temp零残留。

## 7. 治理与提交顺序

1. 本 amendment 先经独立 code/security 合同复审达到 P0=P1=P2=P3=0。
2. Owner 只可按本文件 raw SHA 精确接受，并单文件 commit/push；不得与 task/plan/approval 或产品代码同提交。
3. 远端双读确认 amendment 为 `origin/ext-dev` 新头后，现行 approval 必须返回 STOP。
4. 以新远端头重新生成 exact task/plan/approval 三件套；产品路径仍为原 30，verification 必须绑定三份独立证据。
5. Owner 接受新 canonical approval digest 后，三件套单独 commit/push。
6. 仅当新 task 的 `product-authority --authorize` 返回 GO，才允许把当前隔离工作树的 30-path修改重钉到新 approval parent并继续施工。
7. 产品候选仍只可为新 approval 的唯一 exact 单亲子；独立 code/security review 与机器全门通过后，再请求 Owner 产品 push。

## 8. 回滚与非目标

- 本 amendment 不改变 P14 activation 后永久 V2/strict safety floor、P15 registry digest、backup/restore、release authority或生产 STOP。
- 不新增 API namespace、表/列、第二 registry/ledger、模型/provider配置、生产 feature flag、上传能力或长期 fixture。
- 不把 synthetic generation 当 production-provider证明，不把 delivery fixture 当 fresh generation证明，不把 provisional browser round 当 release acceptance。
- amendment 未获批时，现行产品工作树保持未提交；不得删除、覆盖或推送用户其它工作树资产。
