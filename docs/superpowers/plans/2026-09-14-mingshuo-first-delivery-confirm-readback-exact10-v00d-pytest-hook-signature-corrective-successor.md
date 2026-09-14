# Mingshuo Confirm/Readback exact10 v00d Pytest Hook Signature Corrective Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-V00D-PYTEST-HOOK-SIGNATURE-CORRECTIVE-SUCCESSOR-20260914`

Base: `4002e766c8493d9549db5b2df44199578ca1f387 / 9490b37c7977d7c78ca5c966e8a97ce1b1679c81`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

关闭前序正式 approval 的唯一确定性 `v00d` 合同缺陷：pytest audit hook使用非hookspec参数名 `s`，被当前Pluggy在collection前拒绝。新包只把hook修正为 `self/session`，保留既有closed schema、完整RFC 8785 canonical PASS record、sealed-FD、18-case、插件inventory和所有其他门槛；authority仍必须等全部preflight PASS后才能运行。

## Frozen Boundary

- 当前基线：`origin/ext-dev@4002e766c8493d9549db5b2df44199578ca1f387`；tree `9490b37c7977d7c78ca5c966e8a97ce1b1679c81`。
- 当前 `4002e766…` approval：`STOP / V00D_PYTEST_HOOK_SIGNATURE_CONTRACT_VIOLATION / AUTHORITY_NOT_RUN / HISTORICAL_EVIDENCE_ONLY / NO_RETRY / NO_REANCHOR`。
- `1e682066…` 下的旧 authority：`AUTHORITY_ABANDONED_BY_OWNER_UNCONSUMED / HISTORICAL_EVIDENCE_ONLY / NO_RETRY / NO_REANCHOR`。
- 前序 `b648f613…` approval：`STOPPED_BEFORE_AUTHORITY / PATH_BINDING_ATTESTATION_PREIMAGE_UNBOUND / AUTHORITY_NOT_RUN / HISTORICAL_EVIDENCE_ONLY / NO_REANCHOR`。
- 更早 `c8b7e4a7…` authority：`CONSUMED_BY_STOPPED_SHADOW_ATTEMPT / NO_RETRY / NO_REANCHOR / REISSUE_REQUIRED`。
- Approval paths：本轮正式 Approval、Task、Plan三文件；proposed临时路径不进入未来提交。
- Product paths：原 exact10 十路径，保持 `10 MODIFY / ALL 100644`。
- exact10 donor：`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；bundle `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`；full-index diff `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。
- Python dependency snapshot：`15302`普通文件、`309250828` bytes、manifest `sha256:b1e3dd18b41406f9728ed198b2d260f556f796ceae4346d23bb0583b37e080ca`。
- Controller mechanism donor：`sha256:72e016f57f6d5a80f5ba793595ef6163131f4a6ad93c4fae98f2475f93aae5dc`，仍为 `REJECTED_MECHANISM_SOURCE_DONOR / DO_NOT_EXECUTE`。
- Future controller candidate path：`/tmp/chaotang-mingshuo-confirm-readback-sequence-20260914/controller.mjs`。
- Future lifecycle verifier candidate path：`/tmp/chaotang-mingshuo-confirm-readback-sequence-20260914/verifier.py`。
- 上述私有根目录必须为`0700`；两文件必须是非symlink普通文件、逻辑模式`100644`，并在执行前将`path`、`mode`、`bytes`、`rawSha256`与`gitBlobSha1`冻结为`schemaVersion=chaotang.lifecycle-preflight-executable-identity.v1`的RFC 8785 closed identity record，records按path UTF-8字节序排列。
- `gitBlobSha1`唯一算法：`lowerhex(SHA1(UTF8("blob " + decimal_byte_length + "\\0") || raw_bytes))`，精确40位小写hex；两个候选位于`/tmp`，禁止用pathname、`ls-tree`或任意仓库索引查询代替对实际source FD和sealed FD bytes的重算。
- `identityRecordDigest`唯一算法：`sha256:`加上述完整closed identity record的RFC 8785 canonical UTF-8 bytes之SHA-256小写hex。
- Readiness：十三pairs、四exclusions、69/65 counts、historical review identity、两条successor-content paths及fingerprint算法全部不变。

## Closed Attestation Identity

- Schema：Task内 `Complete RFC 8785 canonical closed schema` 代码块的精确UTF-8内容。
- Schema bytes：`8475`。
- Schema digest：`sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049`。
- PASS record：Task内 `Complete RFC 8785 canonical PASS record` 代码块的精确UTF-8内容。
- Record bytes：`4123`。
- Record digest：`sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572`。
- Schema version：`chaotang.path-binding-self-test.attestation.v1`。
- Root keys精确为 `caseCount,cases,schemaVersion,status`；`caseCount=18`、`status=PASS`。
- Case keys精确为 `attack,cleanup,externalSentinel,id,observedStop,stage,target`。
- 全部case固定 `observedStop=VERIFICATION_PATH_IDENTITY_DRIFT`、`cleanup=PASS`、`externalSentinel=UNCHANGED`。

## Ordered 18-Case Matrix

1. `mkdir.home-ancestor.rename-directory-replacement`
2. `mkdir.home-ancestor.symlink-replacement`
3. `mount.home-ancestor.rename-directory-replacement`
4. `mount.home-ancestor.symlink-replacement`
5. `mount.target.rename-directory-replacement`
6. `mount.target.symlink-replacement`
7. `copy.home-ancestor.rename-directory-replacement`
8. `copy.home-ancestor.symlink-replacement`
9. `copy.target.rename-directory-replacement`
10. `copy.target.symlink-replacement`
11. `remount.home-ancestor.rename-directory-replacement`
12. `remount.home-ancestor.symlink-replacement`
13. `remount.target.rename-directory-replacement`
14. `remount.target.symlink-replacement`
15. `cleanup.home-ancestor.rename-directory-replacement`
16. `cleanup.home-ancestor.symlink-replacement`
17. `cleanup.target.rename-directory-replacement`
18. `cleanup.target.symlink-replacement`

## v00d Contract

外层verifier必须根据其独立观察构造或逐字段核验实际self-test record，把record canonical bytes与本包closed schema canonical bytes分别进行严格Base64编码，并在controller不可改写的进程边界中注入：

- `CHAOTANG_PATH_BINDING_SELF_TEST_RECORD_BASE64`
- `CHAOTANG_PATH_BINDING_SELF_TEST_RECORD_DIGEST`
- `CHAOTANG_PATH_BINDING_SELF_TEST_SCHEMA_BASE64`
- `CHAOTANG_PATH_BINDING_SELF_TEST_SCHEMA_DIGEST`
- `CHAOTANG_PATH_BINDING_SELF_TEST_CONTROLLER_DIGEST`
- `CHAOTANG_PATH_BINDING_SELF_TEST_EXPECTED_CONTROLLER_DIGEST`

`v00d` 必须：

1. 使用validate模式Base64解码，UTF-8严格解析并通过object-pairs hook拒绝重复键。
2. 在代码内机械生成唯一有序18-case期望对象；实际schema canonical bytes必须精确匹配本Task冻结的byte count与digest，治理阶段另以Draft 2020-12验证该closed schema及record。
3. 验证实际record与schema逐字段完全相等，不接受额外字段、额外case、重排、单边摘要或第三状态。
4. 用受限JSON值域下与RFC 8785等价的 `json.dumps(ensure_ascii=False,separators=(",",":"),sort_keys=True)` 重算canonical bytes，并要求其与解码原字节完全相等。
5. 重算record/schema SHA-256并分别匹配 `7ba1…c572` 与 `9afc…f049`。
6. 验证外层verifier从sealed controller执行bytes独立计算并注入的controller digest与expected digest字节相等，且二者均为规范 `sha256:<64 lowercase hex>`；controller自报digest不构成证据，controller raw不进入record，避免循环依赖。
7. 继续验证PID1、临时HOME、HOME/target FD dev/inode、ro/nosuid/nodev、无默认路由、socket/pip fail-closed、用户配置隔离、pytest/anyio/FastAPI/Pydantic版本及唯一conftest/plugin inventory；除审计器自身和不可执行的`None`占位外，所有已注册插件必须具有规范普通非symlink文件身份，非builtin插件必须按插件名＋canonical path精确匹配`anyio.pytest_plugin`和冻结conftest，任何pathless hook插件立即fail-closed。
8. 所有安全条件使用显式fail-closed helper，不使用可被`python -O`删除的`assert`；即使存在优化模式或`PYTHONOPTIMIZE`，检查也必须保留，helper绕过或任一条件false均以非零状态退出。
9. pytest audit hook必须使用 `def pytest_collection_finish(self,session)`、`session.config.pluginmanager` 与 `p is self`；不得用 `q/s` 非hookspec参数、关闭Pluggy验证、兼容性吞错或放宽冻结plugin inventory。

## Independent Lifecycle Verifier Provenance Contract

本包不把controller自报的PASS当作执行证据。既有authority之前的唯一外层lifecycle verifier只是deterministic preflight gate：它不签发GO、不持久化第二事实源、不修改产品字节，也不替代`product-authority.m0.v1`。

外层verifier必须：

1. 由不属于controller/verifier的既有主线父进程对上述两个精确candidate path分别使用`O_RDONLY|O_NOFOLLOW`打开；拒绝symlink、非普通文件、路径/FD identity漂移并读取FD实际bytes。父进程从两个source FD实际bytes按冻结算法重算raw SHA-256与Git blob SHA-1，再把两份bytes分别复制到`memfd_create(MFD_ALLOW_SEALING)`，施加`F_SEAL_WRITE|F_SEAL_GROW|F_SEAL_SHRINK|F_SEAL_SEAL`，并从两个sealed FD再次重算。source/sealed两侧全部identity字段必须相同并等于冻结closed identity record；父进程对该record重算`identityRecordDigest`。verifier必须由`/usr/bin/python3 /proc/self/fd/<sealed-verifier-fd>`启动，controller必须由verifier通过继承的sealed controller FD及`/proc/self/fd/<n>`启动；父进程持有两份sealed FD直至preflight完成并在authority启动前再次复核，禁止任何组件重新解析candidate pathname。平台不支持、seal失败、复制或复核不一致、FD漂移或路径式回退均立即STOP。
2. 从kernel CSPRNG生成至少256-bit fresh challenge，仅保留在verifier私有内存和受控只读FD；每次尝试仅使用一次，结束后销毁challenge与fixture。
3. verifier自己创建并持有18项fixture、攻击barrier、外部sentinel与单向receipt通道；controller不能选择fixture根、攻击时机、sentinel或最终receipt写端。
4. verifier按冻结顺序各执行一次case，独立观察实际`VERIFICATION_PATH_IDENTITY_DRIFT`、安全cleanup和sentinel unchanged；controller仅执行与生产path-binding同源的被测操作，不能把自报JSON当作观察值。
5. verifier根据独立观察构造，或对独立观察逐字段核对，strict canonical receipt：`challenge`、`controllerDigest`、`verifierDigest`、`identitySchemaVersion`、`identityRecordDigest`、`recordDigest`、`schemaDigest`及有序18-case结果；父进程必须从两份sealed执行bytes和冻结closed identity record独立计算并核对controller/verifier/identity digest，任何自报值均不构成证据。父进程在启动`v00d`和authority前均须验证identity绑定；拒绝重复键、额外字段、缺项、重排、重复case、错误digest或非fresh challenge。
6. 只有receipt与本包record/schema完全一致后，verifier才启动`v00d`，通过controller不可改写的FD/进程边界注入actual record/schema，并从sealed执行bytes独立注入相同的controller digest与expected digest；`v00d`通过后才释放既有machine authority barrier。controller不得设置或覆盖上述环境，也不得自行启动`v00d`、回显challenge或直接注入冻结PASS bytes，否则立即STOP。
7. 必须有独立hash-to-launch负向测试：在源FD已读取和哈希、但controller尚未spawn的精确窗口，由同UID helper执行candidate pathname rename/replacement并尝试写改原inode；实际controller仍只能从已复核且sealed的FD bytes启动。若实际执行bytes不能由verifier证明等于sealed digest，或任何pathname/原inode变化能够改变执行内容，立即STOP。

## Controller Derivation Contract

正式approval落地后，派生controller才可创建。除新task、approval path、approval commit/tree/digest、authority/shadow根、local config digest与verification digest等identity常量外，只允许前序已冻结的六项机制纠偏，以及本successor对attestation record/schema传递与v00d复算的精确替换。不得改变DONOR_FILES、exact10 bundle/full-index diff、snapshot identity、降权、stdin协议或其余状态转换。

Self-test必须复用生产path-binding函数，而不是复制一份测试专用判定。每个case在生产函数完成初始FD/open和identity锁后发出barrier；同UID helper替换对应HOME ancestor或target；生产操作在mkdir/mount/copy/remount/cleanup立即前重验FD与path的dev/inode及symlink状态。测试只能在全部18项真实观察目标STOP、清理安全、sentinel不变后生成冻结PASS record。

Controller raw不参与固定record的hash，避免自引用；其绑定方式为：

1. 派生后冻结controller raw SHA；只有不属于controller/verifier的既有主线父进程可以从`O_NOFOLLOW`打开的实际源FD读取bytes，再复制到sealed memfd并复核两份bytes一致，从sealed执行bytes独立重算expected digest。verifier不得重新打开controller pathname。
2. `node --check`、精确diff allowlist和Code/Python/Security Review绑定该raw。
3. controller只从父进程经verifier传递的sealed FD通过`/proc/self/fd/<n>`启动，不得再次解析candidate pathname；父进程从该sealed执行bytes计算controller digest与expected digest，verifier只能转交这两个不可改写值，`v00d`再次要求两值相等。controller或verifier自报digest不构成证据。
4. 在source hash与spawn之间执行同UID pathname replacement及原inode写改负向测试；只有sealed FD执行身份保持不变才可继续。
5. 18-case必须由外层verifier拥有fixture并独立观察，在machine authority之前完成；authority之后不得重新生成或替换attestation。

## Governance Validation

- Proposed manifest：strict JSON、重复键拒绝、Draft 2020-12 approval schema、`validateApprovalManifest`、RFC 8785 canonical。
- Task：`productTaskErrors=[]`。
- Contract：提取Task两个canonical代码块，验证字节数、strict JSON、schema闭合、record按schema逐项通过、record/schema canonical SHA。
- Manifest：verification精确21项；仅v00d相对前序发生 `q/s` → `self/session` hook签名与self-reference纠正；其余20项字节语义及v00d其他合同不放宽。
- Paths：工作区精确三份新增治理草案，模式 `100644`，无第四路径。
- Harness：草案工作区必须全绿；当前完整运行结果为 `159` 个基线文件通过。proposed只存在于 `docs/migrations/`，不得被发现为正式authority或进入未来approval commit。
- Digests：三文件raw SHA、Packet/Approval RFC8785 canonical、三文件bundle。
- Reviews：Governance、Python、Security独立只读审查；任一P0–P2立即STOP。

治理冻结结果：Governance/Python Review 与 Security Review 均为 `GO / P0=0 / P1=0 / P2=0 / P3=0`；该结论只覆盖三文件治理草案，不冒充未来controller/verifier或产品验证结果。

## Future Product Verification

本轮不运行产品矩阵。未来经Owner确认、正式三文件落地和machine GO后，原21项矩阵保持：

- v00/v00a：exact10 scope、shape、donor content、bundle与full-index diff。
- v00b/v00c：新approval直接单亲与实时remote。
- v00d：本包closed attestation、Python snapshot、namespace、FD、网络、配置与plugin合同。
- v01：Mingshuo finalization/download/archive/readback focused。
- v02：backend-full结构化exact-two readiness closed-pair失败拓扑。
- v03：exact10 Ruff。
- v04–v12d：Harness、Doctor、hook、authority regression、V2、diff与最终identity。

Backend-full预期仍为 `5164 passed, 4 skipped, 5 warnings, 2 failed`，唯一两个失败仍为已冻结readiness closed-pair节点；任何第三失败、ERROR、timeout、意外全绿或拓扑变化立即STOP。

## Execution Order

1. 编制并验证本三文件草案；返回唯一canonical digest。
2. Owner精确确认digest后，物化正式approval，创建 `4002e766…` 的直接单亲三文件commit并普通快进。
3. 从前序拒绝执行证据重新派生新controller/verifier raw；只允许identity常量与本包冻结的v00d hook签名纠正。对两个精确candidate path重新完成syntax/diff、Code/Python/Security复审，并冻结path/mode/bytes/raw SHA/Git blob的closed identity record及其`identityRecordDigest`。
4. 在machine authority之前，由既有主线父进程从两个实际源FD分别重算raw SHA与Git blob、复制到sealed memfd并再次重算，从sealed verifier FD启动verifier；执行sealed-FD hash-to-execution、fresh challenge、同UID pathname/original-inode攻击以及18项独立fixture/receipt preflight。receipt必须绑定父进程独立计算的controller/verifier digests、identity schema version与identity record digest；全部PASS且无P0–P2才可继续。
5. 仅在父进程仍持有并再次复核同一两份sealed FD、preflight证据仍绑定同一冻结controller/verifier，且实时remote仍等于新approval commit时运行一次machine authority；STOP不得重试，任何前序authority不得使用。
6. 新authority GO后另经授权创建detached shadow、重物化exact10、运行完整矩阵和最终三审；本successor shadow阶段仍不形成candidate commit。
7. 之后另立readiness exact2 prerequisite，再基于届时最新ext-dev重签产品successor、全量验证、machine verify-candidate和普通快进。

## Stop Conditions

实时remote漂移、复用/重试/re-anchor前序authority、authority早于controller/verifier三审或sealed-FD/18-case preflight、controller/verifier任一路径未精确冻结、identity record缺少schemaVersion/path/mode/bytes/rawSha256/gitBlobSha1、Git blob算法不是冻结的SHA-1字节公式、父进程未从source FD和sealed FD双侧重算、receipt缺少或不匹配identitySchemaVersion/identityRecordDigest、verifier未从sealed FD启动、父进程未持有并复核两个sealed FD、receipt未绑定父进程独立计算的controller/verifier digests、preflight与authority之间controller/verifier identity漂移、schema或record canonical bytes/digest不一致、v00d只比较常量、`assert`/优化模式fail-open、controller digest与外层expected digest不一致、外层verifier未从实际源FD复制并复核sealed执行bytes、controller按可变pathname启动、hash-to-launch同UID替换能改变执行内容、challenge非fresh、controller可选择fixture/receipt通道、verifier未独立观察18项真实STOP/cleanup/sentinel、case缺失/重排/额外字段、controller raw循环绑定、self-test与生产函数分叉、任何case非目标STOP、cleanup失败、sentinel改变、source/snapshot identity漂移、网络或用户配置泄露、FD/path identity漂移、exact10第十一条路径、产品矩阵拓扑变化、任一关键验证失败、独立审查P0–P2、第二authority/事实源、candidate/commit/push、force-push、Pilot、Release或生产部署均立即STOP。

## Rollback

本轮只产生未提交三文件草案；删除新隔离工作区即可回到 `4002e766…`，但在Owner未明确授权前不得执行删除。未来正式approval若落地，只能通过新的forward-only successor撤回；禁止重写历史、force-push或修改前序证据。
