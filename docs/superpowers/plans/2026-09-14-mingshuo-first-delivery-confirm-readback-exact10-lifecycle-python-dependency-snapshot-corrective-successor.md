# Mingshuo Confirm/Readback exact10 Lifecycle Python Dependency Snapshot Corrective Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-LIFECYCLE-PYTHON-DEPENDENCY-SNAPSHOT-CORRECTIVE-SUCCESSOR-20260914`

Base: `c8b7e4a7e1001f9c5dba336d092f38c659c71aa1 / bac9faffad9d5d900770d50903cca7248b6692c5`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

在不改变 exact10 产品字节、readiness policy或验证阈值的前提下，关闭前序 machine verification 最小环境无法导入pytest及后端依赖的确定性契约缺口。所有 Python verification必须从经过完整内容寻址的私有只读快照执行，不能读取用户HOME配置、在线安装依赖或执行未冻结的用户可写site-packages。

## Frozen Boundary

- Base：实时 `origin/ext-dev@c8b7e4a7e1001f9c5dba336d092f38c659c71aa1`；tree `bac9faffad9d5d900770d50903cca7248b6692c5`。
- Approval paths：本轮正式 Approval、Task、Plan三文件；proposed临时文件只作字节donor，不进入提交。
- Product paths：原 exact10十路径，精确 `10 MODIFY / ALL 100644`。
- Predecessor authority：`CONSUMED_BY_STOPPED_SHADOW_ATTEMPT / NO_RETRY / NO_REANCHOR / REISSUE_REQUIRED`。
- exact10 donor：`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；bundle `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`；full-index diff `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。
- Controller mechanism donor：raw `sha256:72e016f57f6d5a80f5ba793595ef6163131f4a6ad93c4fae98f2475f93aae5dc`；状态为`REJECTED_MECHANISM_SOURCE_DONOR / DO_NOT_EXECUTE`，其task/commit/digest仍绑定前序且含六类已确认缺口，不得直接运行或继承审查身份。
- Python dependency snapshot：`15302`普通文件、`309250828` bytes、byte-sorted manifest digest `sha256:b1e3dd18b41406f9728ed198b2d260f556f796ceae4346d23bb0583b37e080ca`；不允许symlink、特殊文件、安装或网络解析。
- Readiness：十三pairs、四exclusions、69/65 counts、historical review identity、两条successor-content paths和`path + NUL + bytes + NUL`算法全部不变。

## Environment Contract

1. Controller为每条Python verification创建新的`0700`临时HOME和独立user/PID/mount/network namespace；loopback保持down，不得存在可用路由。
2. `HOME`、XDG目录均指向临时路径；Git global、pip与npm user config指向`/dev/null`，禁止真实用户配置和凭据进入子进程。
3. 依赖复制目标是临时HOME下的私有`tmpfs`；复制前后均拒绝symlink与特殊文件。HOME及目标祖先必须以目录FD绑定或等价的`openat2/openat` + `O_NOFOLLOW`机制操作，并在每次mkdir/mount/copy/remount/cleanup立即前重验device/inode；替换即STOP。
4. 对复制结果按UTF-8路径byte-order排序，冻结每个普通文件path、mode、bytes、raw SHA，机械校验`15302 / 309250828 / b1e3…`。
5. 身份通过后将tmpfs remount为`ro,nosuid,nodev`，随后设置唯一`PYTHONPATH`、`PYTHONNOUSERSITE=1`、`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`、`PYTEST_PLUGINS=anyio.pytest_plugin`、`PIP_NO_INDEX=1`和`PIP_DISABLE_PIP_VERSION_CHECK=1`，并清除`PYTEST_ADDOPTS`。
6. 使用`setpriv --no-new-privs --bounding-set=-all --inh-caps=-all --ambient-caps=-all`后exec`/usr/bin/python3`；Python保持namespace PID1。
7. 成功与失败路径都必须清理；成功路径清理后仍存在临时HOME时返回`VERIFICATION_HOME_CLEANUP_FAILED`，禁止输出finished。

## Controller Derivation Contract

`72e016…` donor保留私有tmpfs、目标快照身份检查、namespace、降权和状态机源码，但冻结的是前序task/approval identity且不能通过本manifest。正式approval落地前无法知道新approval commit/tree与最终canonical digest，因此派生controller必须在落地后替换authority root、shadow root、task ID、approval path、approval commit、approval tree、approval digest、local config digest及verification digest等identity常量。

此外只允许六项确定性机制纠偏：

1. 将verification-count guard由前序`20`更新为本manifest精确`21`，并把新增`v00d-python-dependency-snapshot-contract`纳入verification digest与有序策略检查。
2. 将所有controller可正常处理的STOP/exception路径统一到终端cleanup；退出前删除临时HOME并用`existsSync`确认，失败时返回`VERIFICATION_HOME_CLEANUP_FAILED`且保留原失败上下文，不得继续输出finished。
3. 在mount/copy前使用与target相同的递归identity函数扫描source，拒绝symlink、特殊文件或`15302 / 309250828 / b1e3…`漂移；copy后仍须对private target重新扫描并通过后才能remount只读和exec Python。
4. 在现有namespace参数中增加独立network namespace，loopback保持down；同时锁定pip offline环境，并通过socket连接与不存在包的pip解析负向探针机械证明fail-closed。
5. 将HOME、python-site及其祖先的生命周期改为目录FD绑定或等价的`openat2/openat`安全操作；禁止跟随symlink，在每个mkdir/mount/copy/remount/cleanup立即前对预期device/inode执行重验，并增加同UID替换对抗测试。
6. 锁定pytest实际加载集合：允许固定pytest 9.1.1内建插件、`anyio.pytest_plugin@4.14.2`和唯一`backend/tests/conftest.py@sha256:d11ae7b6e7618e37aead57e1cbfb88f7b0be907bbb44309ae7009c971c32f6c5`；拒绝额外`-p`、`PYTEST_ADDOPTS`、conftest或第三方插件，并在收集之前出具插件inventory attestation。

目录FD绑定纠偏必须包含一个内建、与生产函数同源的屏障同步自测模式。同UID helper在controller完成初始identity/open并发出barrier后，对mkdir的HOME祖先以及mount/copy/remount/cleanup的HOME祖先与target分别施加rename-directory-replacement与symlink-replacement，共18个case。每个case必须证明`VERIFICATION_PATH_IDENTITY_DRIFT`、安全清理且外部路径未被修改。按RFC 8785冻结的PASS记录期望摘要为`sha256:8390a2e851f60406c49e7956121b11bf553526753579a791052ae646c67780d5`；自测源码、case集和结果算法全部受新controller raw绑定，必须在authority与v01前独立通过。

除identity常量和上述六项外，DONOR_FILES、bundle、full-index diff、Python snapshot身份、降权、stdin协议与其余状态转换不得修改。

派生后必须重新执行raw SHA、`node --check`、精确diff allowlist审计、完整Code/Python/Security Review。调用者在启动前核对派生raw；controller内部再从Git object重算approval digest并在每条verification前后检查HEAD、remote与manifest。新controller未冻结、任一非允许代码差异或P0–P2均立即STOP。

## Verification Matrix

- v00/v00a：exact10范围、状态、模式、raw/blob/bytes、bundle与full-index diff。
- v00b/v00c：新approval commit直接单亲、三治理路径与实时remote。
- v00d：Python snapshot的PID1、`/tmp`、临时HOME mode与FD/device/inode身份、只读mount flags、无网络路由、socket/pip负向探针、user-site/config隔离、实际pytest插件/conftest inventory及`pytest 9.1.1 / anyio 4.14.2 / FastAPI 0.141.1 / Pydantic 2.13.4`。它还必须核对18-case同UID替换自测的PASS attestation digest `sha256:8390a2e851f60406c49e7956121b11bf553526753579a791052ae646c67780d5`；该自测必须在authority与v01前通过。
- v01：Mingshuo finalization、download、archive、readback focused测试。
- v02：backend-full JUnit exact-two readiness closed-pair拓扑。
- v03：exact10 Ruff。
- v04/v05：Harness唯一readiness diagnostic及self-test。
- v06–v08：Doctor与hook。
- v09：仅进程级POSIX temp的authority regression。
- v10/v11：V2 convergence check/tests。
- v12与v12a–v12d：diff、最终exact10身份、approval lineage与实时remote锁。
- Governance Review检查authority生命周期、no-reanchor、路径与后续prerequisite顺序。
- Python Review检查snapshot可复现性、pytest插件、子进程继承、backend-full包装器与依赖版本。
- Security Review检查HOME/凭据隔离、TOCTOU、symlink/special-file、readonly mount、capability drop、PID1、cleanup和fail-closed。

## Expected Product Evidence

- Focused、Ruff、Harness self-test、Doctor、hook、authority regression、V2与diff check按新successor重新生成，不能继承前序未运行证据。
- Backend-full必须自然完成且只接受：
  1. `tests/test_six_ministry_readiness_report.py::test_readiness_evidence_is_bound_to_current_implementation`
  2. `tests/test_six_ministry_readiness_report.py::test_successor_content_rejects_third_state_drift`
- JUnit精确为`5170 tests / 2 failures / 0 errors / 4 skipped`，stdout summary精确为`5164 passed, 4 skipped, 5 warnings, 2 failed`；不得接受第三失败、ERROR、timeout、deselect、xfail/xpass/rerun或意外全绿。
- 三审后才可重新计算65-path runtime fingerprint、2-path successor fingerprint和唯一proposed pair；旧provisional fingerprint不得继承。

## Governance Draft Validation

- Proposed manifest：strict JSON、重复键拒绝、Draft 2020-12 schema与`validateApprovalManifest`均须PASS。
- Task：`productTaskErrors=[]`。
- 草案工作区完整Harness必须精确只拒绝proposed的两项控制面错误：未授权control-plane路径及manifest文件名与task不一致。
- 同基线隔离副本保留Task/Plan原字节、仅排除proposed后，完整Harness必须全绿；当前证据为`agentic-check: 通过 (159 个基线文件)`。
- 该拆分不构成Harness豁免：正式三文件物化前必须删除proposed，正式approval路径由manifest精确绑定。

## Execution Order

1. 对proposed单独执行strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest`和canonical；对Task执行`productTaskErrors=[]`。完整Harness在同基线隔离副本中保留Task/Plan原字节并排除proposed运行，因为当前Harness必须拒绝`.harness/approvals/*.proposed.json`；不得增加豁免或放宽门禁。完成路径/模式/摘要检查与Governance/Python/Security三审后返回唯一Approval RFC 8785 canonical digest。
2. Owner精确确认digest后，才可物化正式approval、创建`c8b7e4a7…`的直接单亲三文件commit并普通快进。
3. 由正式commit/digest机械派生新controller，冻结raw并复审；先用其内建的屏障同步模式执行18-case同UID路径替换自测，核对PASS attestation digest，再允许controller运行一次machine authority。STOP不得重试或规避。
4. GO后创建唯一detached shadow，byte-for-byte重物化exact10并运行完整矩阵；每条Python命令使用独立私有只读依赖快照。
5. 完整矩阵通过冻结合同后执行独立三审；GO后只冻结exact10与proposed pair证据并停止。
6. 另立readiness exact2 prerequisite；其落地后再基于最新ext-dev重签产品successor、全量复验、machine verify-candidate和普通快进。

## Stop Conditions

实时remote漂移、machine STOP或重复authority、controller raw/identity/状态机越界、正式manifest digest不一致、Python源或私有快照出现symlink/特殊文件/计数/bytes/digest漂移、HOME/target祖先device/inode或FD绑定漂移、真实HOME或用户配置暴露、network namespace或pip offline策略缺失、socket/pip负向探针未fail-closed、tmpfs非只读或缺少nosuid/nodev、PID1/namespace/capability/no-new-privs漂移、插件/conftest inventory漂移、同UID替换对抗验证失败、临时HOME清理失败、exact10第十一条路径或content漂移、backend拓扑变化、任一关键验证失败、独立审查P0–P2、第二authority/事实源、candidate commit/push、force-push、Pilot、Release或生产部署均立即STOP。

## Rollback

本轮草案未提交，保留三文件即可，不影响远端。后续正式approval若落地只能通过新的forward-only successor撤回；禁止删除donor、重写历史或force-push。Shadow不提交，停止时保留隔离工作树和内容摘要。
