# Mingshuo Confirm/Readback exact10 Path-Binding Attestation Contract Corrective Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-PATH-BINDING-ATTESTATION-CONTRACT-CORRECTIVE-SUCCESSOR-20260914`

Base: `b648f61368c2861a535de102ef44bfed16f7f2ba / 1f0e86c84ae751f3eacbad3149ad8bf2e2422180`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

关闭前序正式 approval 中 path-binding self-test 只有固定摘要、没有可复算 preimage/schema 的治理矛盾。新包必须把18个同UID目录替换case的closed schema、完整RFC 8785 canonical PASS record、字节数、摘要和v00d复算规则冻结为单一合同；不得通过比较controller提供的常量来冒充真实attestation。

## Frozen Boundary

- 当前基线：`origin/ext-dev@b648f61368c2861a535de102ef44bfed16f7f2ba`；tree `1f0e86c84ae751f3eacbad3149ad8bf2e2422180`。
- 前序 `b648f613…` approval：`STOPPED_BEFORE_AUTHORITY / PATH_BINDING_ATTESTATION_PREIMAGE_UNBOUND / AUTHORITY_NOT_RUN / HISTORICAL_EVIDENCE_ONLY / NO_REANCHOR`。
- 更早 `c8b7e4a7…` authority：`CONSUMED_BY_STOPPED_SHADOW_ATTEMPT / NO_RETRY / NO_REANCHOR / REISSUE_REQUIRED`。
- Approval paths：本轮正式 Approval、Task、Plan三文件；proposed临时路径不进入未来提交。
- Product paths：原 exact10 十路径，保持 `10 MODIFY / ALL 100644`。
- exact10 donor：`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；bundle `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`；full-index diff `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。
- Python dependency snapshot：`15302`普通文件、`309250828` bytes、manifest `sha256:b1e3dd18b41406f9728ed198b2d260f556f796ceae4346d23bb0583b37e080ca`。
- Controller mechanism donor：`sha256:72e016f57f6d5a80f5ba793595ef6163131f4a6ad93c4fae98f2475f93aae5dc`，仍为 `REJECTED_MECHANISM_SOURCE_DONOR / DO_NOT_EXECUTE`。
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

## Independent Lifecycle Verifier Provenance Contract

本包不把controller自报的PASS当作执行证据。既有authority之前的唯一外层lifecycle verifier只是deterministic preflight gate：它不签发GO、不持久化第二事实源、不修改产品字节，也不替代`product-authority.m0.v1`。

外层verifier必须：

1. 从三审冻结的精确controller candidate path使用`O_RDONLY|O_NOFOLLOW`打开文件；拒绝symlink、非普通文件、路径/FD identity漂移并读取FD实际bytes。把相同bytes复制到`memfd_create(MFD_ALLOW_SEALING)`，施加`F_SEAL_WRITE|F_SEAL_GROW|F_SEAL_SHRINK|F_SEAL_SEAL`，复核sealed memfd bytes与源FD bytes完全相同并计算SHA-256；该值是不可由controller提供或覆盖的expected digest。verifier必须通过继承的sealed FD及`/proc/self/fd/<n>`启动Node controller，禁止重新解析candidate pathname，并保留源FD和sealed FD直至controller与`v00d`结束。平台不支持、seal失败、复制或复核不一致、FD漂移或路径式回退均立即STOP。
2. 从kernel CSPRNG生成至少256-bit fresh challenge，仅保留在verifier私有内存和受控只读FD；每次尝试仅使用一次，结束后销毁challenge与fixture。
3. verifier自己创建并持有18项fixture、攻击barrier、外部sentinel与单向receipt通道；controller不能选择fixture根、攻击时机、sentinel或最终receipt写端。
4. verifier按冻结顺序各执行一次case，独立观察实际`VERIFICATION_PATH_IDENTITY_DRIFT`、安全cleanup和sentinel unchanged；controller仅执行与生产path-binding同源的被测操作，不能把自报JSON当作观察值。
5. verifier根据独立观察构造，或对独立观察逐字段核对，strict canonical receipt：`challenge`、`controllerDigest`、`recordDigest`、`schemaDigest`及有序18-case结果；拒绝重复键、额外字段、缺项、重排、重复case、错误digest或非fresh challenge。
6. 只有receipt与本包record/schema完全一致后，verifier才启动`v00d`，通过controller不可改写的FD/进程边界注入actual record/schema，并从sealed执行bytes独立注入相同的controller digest与expected digest；`v00d`通过后才释放既有machine authority barrier。controller不得设置或覆盖上述环境，也不得自行启动`v00d`、回显challenge或直接注入冻结PASS bytes，否则立即STOP。
7. 必须有独立hash-to-launch负向测试：在源FD已读取和哈希、但controller尚未spawn的精确窗口，由同UID helper执行candidate pathname rename/replacement并尝试写改原inode；实际controller仍只能从已复核且sealed的FD bytes启动。若实际执行bytes不能由verifier证明等于sealed digest，或任何pathname/原inode变化能够改变执行内容，立即STOP。

## Controller Derivation Contract

正式approval落地后，派生controller才可创建。除新task、approval path、approval commit/tree/digest、authority/shadow根、local config digest与verification digest等identity常量外，只允许前序已冻结的六项机制纠偏，以及本successor对attestation record/schema传递与v00d复算的精确替换。不得改变DONOR_FILES、exact10 bundle/full-index diff、snapshot identity、降权、stdin协议或其余状态转换。

Self-test必须复用生产path-binding函数，而不是复制一份测试专用判定。每个case在生产函数完成初始FD/open和identity锁后发出barrier；同UID helper替换对应HOME ancestor或target；生产操作在mkdir/mount/copy/remount/cleanup立即前重验FD与path的dev/inode及symlink状态。测试只能在全部18项真实观察目标STOP、清理安全、sentinel不变后生成冻结PASS record。

Controller raw不参与固定record的hash，避免自引用；其绑定方式为：

1. 派生后冻结controller raw SHA；外层verifier从`O_NOFOLLOW`打开的实际源FD读取bytes，再复制到sealed memfd并复核两份bytes一致，从sealed执行bytes独立重算expected digest。
2. `node --check`、精确diff allowlist和Code/Python/Security Review绑定该raw。
3. controller只从verifier继承的sealed FD通过`/proc/self/fd/<n>`启动，不得再次解析candidate pathname；外层verifier从该sealed执行bytes计算并注入controller digest与expected digest，`v00d`再次要求两值相等。controller自报digest不构成证据。
4. 在source hash与spawn之间执行同UID pathname replacement及原inode写改负向测试；只有sealed FD执行身份保持不变才可继续。
5. 18-case必须由外层verifier拥有fixture并独立观察，在machine authority之前完成；authority之后不得重新生成或替换attestation。

## Governance Validation

- Proposed manifest：strict JSON、重复键拒绝、Draft 2020-12 approval schema、`validateApprovalManifest`、RFC 8785 canonical。
- Task：`productTaskErrors=[]`。
- Contract：提取Task两个canonical代码块，验证字节数、strict JSON、schema闭合、record按schema逐项通过、record/schema canonical SHA。
- Manifest：verification精确21项；仅v00d相对前序发生attestation-contract变化；其余产品verification语义不放宽。
- Paths：工作区精确三份新增治理草案，模式 `100644`，无第四路径。
- Harness：草案工作区允许且只允许proposed路径的既定两项控制面拒绝；同基线临时副本保留Task/Plan原字节、排除proposed后必须全绿。
- Digests：三文件raw SHA、Packet/Approval RFC8785 canonical、三文件bundle。
- Reviews：Governance、Python、Security独立只读审查；任一P0–P2立即STOP。

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
2. Owner精确确认digest后，物化正式approval，创建 `b648f613…` 的直接单亲三文件commit并普通快进。
3. 从controller donor派生新raw，实施六项原机制纠偏与本包closed attestation合同；完成syntax/diff、外层verifier provenance、18-case独立观察及Code/Python/Security复审。
4. 仅在外层verifier从实际controller FD重算identity、fresh challenge与18项独立fixture/receipt全PASS，且实时remote等于新approval commit时运行一次machine authority；STOP不得重试。
5. GO后另经授权创建detached shadow、重物化exact10、运行完整矩阵和最终三审；本successor shadow阶段仍不形成candidate commit。
6. 之后另立readiness exact2 prerequisite，再基于届时最新ext-dev重签产品successor、全量验证、machine verify-candidate和普通快进。

## Stop Conditions

实时remote漂移、前序authority重试/re-anchor、schema或record canonical bytes/digest不一致、v00d只比较常量、`assert`/优化模式fail-open、controller digest与外层expected digest不一致、外层verifier未从实际源FD复制并复核sealed执行bytes、controller按可变pathname启动、hash-to-launch同UID替换能改变执行内容、challenge非fresh、controller可选择fixture/receipt通道、verifier未独立观察18项真实STOP/cleanup/sentinel、case缺失/重排/额外字段、controller raw循环绑定、self-test与生产函数分叉、任何case非目标STOP、cleanup失败、sentinel改变、source/snapshot identity漂移、网络或用户配置泄露、FD/path identity漂移、exact10第十一条路径、产品矩阵拓扑变化、任一关键验证失败、独立审查P0–P2、第二authority/事实源、candidate/commit/push、force-push、Pilot、Release或生产部署均立即STOP。

## Rollback

本轮只产生未提交三文件草案；删除新隔离工作区即可回到 `b648f613…`，但在Owner未明确授权前不得执行删除。未来正式approval若落地，只能通过新的forward-only successor撤回；禁止重写历史、force-push或修改前序证据。
