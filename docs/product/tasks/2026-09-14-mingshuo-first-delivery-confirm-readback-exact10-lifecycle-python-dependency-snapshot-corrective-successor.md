# 铭硕第一交付 · Confirm/Download/Archive/Readback exact10 Lifecycle Python Dependency Snapshot Corrective Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-LIFECYCLE-PYTHON-DEPENDENCY-SNAPSHOT-CORRECTIVE-SUCCESSOR-20260914`

冻结基线：`origin/ext-dev@c8b7e4a7e1001f9c5dba336d092f38c659c71aa1`；tree：`bac9faffad9d5d900770d50903cca7248b6692c5`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是 `MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-SHADOW-TOPOLOGY-CORRECTIVE-SUCCESSOR-20260914` 的独立、forward-only lifecycle Python dependency snapshot corrective successor。前序正式 approval commit `c8b7e4a7e1001f9c5dba336d092f38c659c71aa1` 曾由唯一 lifecycle controller 获得 `GO / APPROVED_FOR_ONE_CHILD`，随后 exact10 shadow 在运行其他产品测试前停止：v00、v00a、v00b、v00c 均通过，第一条 Python verification `v01` 在 pytest 收集前因 `/usr/bin/python3: No module named pytest` 退出。

唯一根因为 `LIFECYCLE_PYTHON_ENVIRONMENT_CONTRACT_MISMATCH`：machine verification 的最小环境没有用户 site-packages，而 user namespace 内 `HOME` 映射为 `/root`，故 `/home/ubuntu/.local/lib/python3.12/site-packages` 中的 pytest 及后端依赖不可见。该结果不是产品断言失败，也没有证明 focused、backend-full、Ruff 或后续矩阵通过。

前序 one-child authority 已被停止的 shadow 尝试消费，状态固定为 `CONSUMED_BY_STOPPED_SHADOW_ATTEMPT / NO_RETRY / NO_REANCHOR / REISSUE_REQUIRED`。不得直接重试、恢复、继承或重新锚定。现有 exact10 十文件仍保持 `10 MODIFY / ALL 100644`，仅作为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE` 保留。

本 successor 不修改产品、验证器或 readiness policy，只为每条 Python verification 建立内容寻址、私有、只读、无用户配置的依赖快照环境。它保持现有 exact10 业务目标：确认后的方案与报价草案可下载、归档并从项目详情回读，且 tenant、owner、project、draft、artifact、work-product、binding 与 terminal receipt 身份闭合。

## Acceptance Criteria

- [ ] 正式 approval commit 必须是 `c8b7e4a7… / bac9faff…` 的直接单亲子，只含正式 Approval、Task、Plan 三条 `100644` 路径；proposed 临时路径不得进入提交。
- [ ] Machine authority 只能在实时 `origin/ext-dev` 精确等于正式 approval commit 时运行一次；前序 authority 不得重试或消费。
- [ ] 现有 controller 文件 `sha256:72e016f57f6d5a80f5ba793595ef6163131f4a6ad93c4fae98f2475f93aae5dc` 只作为 `REJECTED_MECHANISM_SOURCE_DONOR / DO_NOT_EXECUTE`。它仍绑定前序 task/commit/digest，且独立复审确认 verification count、失败清理、复制前源检查、网络隔离、临时HOME路径TOCTOU与pytest实际插件集合六类缺口，不能直接运行于本 successor。
- [ ] 正式 approval 落地后，派生 controller 只允许两类差异：第一类是 task、approval path、approval commit/tree/digest、authority/shadow 根、local config digest与verification digest等冻结identity常量；第二类精确为六项机制纠偏：将verification-count guard从20更新为21并锁定v00d；统一所有可处理STOP/exception路径的临时HOME清理；在mount/copy前执行源snapshot完整身份预检；增加独立network namespace且loopback保持down，并设置`PIP_NO_INDEX=1`、`PIP_DISABLE_PIP_VERSION_CHECK=1`后机械证明socket与pip解析均fail-closed；使用目录FD绑定或等价的`openat2/openat`、`O_NOFOLLOW`、device/inode重验机制保护HOME与target祖先，在每次mkdir/mount/copy/remount/cleanup立即前重验并对替换fail-closed；锁定pytest实际插件边界为固定pytest内建插件、`anyio.pytest_plugin@4.14.2`及唯一`backend/tests/conftest.py@sha256:d11ae7b6e7618e37aead57e1cbfb88f7b0be907bbb44309ae7009c971c32f6c5`，拒绝额外`-p`、`PYTEST_ADDOPTS`、conftest或外部插件。除冻结identity常量与上述六项外，DONOR_FILES、bundle、full-index diff、snapshot身份、降权、stdin协议和其余状态转换不得改变。
- [ ] 派生 controller 必须重新计算raw SHA、执行语法检查、精确diff allowlist审计并完成独立 Code、Python 与 Security Review后才能启动本successor的唯一authority；任一非允许差异或P0–P2立即STOP。
- [ ] Python 依赖源身份必须精确为 `15302` 个普通文件、`309250828` bytes，byte-sorted manifest digest 为 `sha256:b1e3dd18b41406f9728ed198b2d260f556f796ceae4346d23bb0583b37e080ca`。出现 symlink、特殊文件、计数、字节或摘要漂移立即 STOP；不得安装、下载、解析或升级依赖。
- [ ] 每条 Python verification 都必须在独立 user/PID/mount/network namespace 中运行，loopback不得启用；controller 创建权限 `0700` 的临时 HOME，以目录FD绑定的方式将依赖复制到私有 `tmpfs`，对复制结果重算完整身份后 remount 为 `ro,nosuid,nodev`，仅将该只读路径作为 `PYTHONPATH`。任一祖先路径symlink或device/inode替换立即STOP。
- [ ] Python 进程必须保持 PID 1，启用 `no-new-privs`，清空 bounding/inheritable/ambient capabilities，设置 `PYTHONNOUSERSITE=1`、`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`、`PIP_NO_INDEX=1`、`PIP_DISABLE_PIP_VERSION_CHECK=1`；pytest只允许固定内建插件、`anyio.pytest_plugin`与唯一冻结conftest，不得通过命令、环境或配置载入其他插件；`PIP_CONFIG_FILE`、npm user config 与 Git global config 指向 `/dev/null`。
- [ ] 不得将真实 `/home/ubuntu` 作为 HOME，不得读取、复制或输出用户凭据、Git 配置、pip/npm 配置或其他用户配置。临时 HOME 清理失败必须返回 `VERIFICATION_HOME_CLEANUP_FAILED`，不得报告 controller finished。
- [ ] 新 verification `v00d-python-dependency-snapshot-contract` 必须机械证明 PID、临时目录、HOME mode、目录FD/device/inode身份、只读 mount flags、network namespace无可用路由、socket与pip解析fail-closed、配置隔离、实际pytest插件/conftest清单以及`pytest==9.1.1 / anyio==4.14.2 / FastAPI==0.141.1 / Pydantic==2.13.4`。派生controller必须内建与生产路径绑定函数同源的屏障同步自测，以同UID helper在mkdir的HOME祖先及mount/copy/remount/cleanup的HOME祖先与target分别执行rename-directory-replacement与symlink-replacement，共18个精确case均必须返回`VERIFICATION_PATH_IDENTITY_DRIFT`、完成安全清理且不修改外部路径。自测结果记录按RFC 8785的期望摘要为`sha256:8390a2e851f60406c49e7956121b11bf553526753579a791052ae646c67780d5`；自测源码绑定新controller raw，必须在authority与v01前独立运行并由v00d核对该attestation digest。
- [ ] Shadow 重物化后仍必须精确只有原 exact10 十条未暂存 `M / 100644`，无暂存、未跟踪、第十一条路径、增删改名复制、mode 或 submodule 漂移；bundle 必须为 `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`，combined full-index diff 必须为 `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。
- [ ] Focused、exact10 Ruff、Harness self-test、Doctor、hook、authority regression、V2 与 diff check 必须完成；不得继承前序未运行矩阵的任何通过身份。
- [ ] Backend-full 仍必须精确得到 `5164 passed, 4 skipped, 5 warnings, 2 failed`，且唯一两个失败为现有 readiness closed-pair 节点；JUnit 必须结构化证明 `5170 tests / 2 failures / 0 errors / 4 skipped`。第三失败、ERROR、timeout、不完整结果或意外全绿立即 STOP。
- [ ] Governance、Python 与 Security 三个独立只读审查均须 `GO / P0=0 / P1=0 / P2=0`；任何 P0–P2 立即停止。
- [ ] 三审 GO 后只冻结 exact10 身份、验证证据、65-path runtime fingerprint、2-path successor fingerprint 与唯一 proposed ordered pair；不得创建 product candidate commit、运行 machine verify-candidate或推送产品字节。

## Delivery Constraints

- approvalCommitPaths 精确为本轮正式 Approval、Task、Plan；productPaths 精确保持原 exact10 十路径。
- 不得修改 `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`、历史 readiness 报告、四项 exclusions、69/65 计数、历史 review identity、两条 successor-content paths、fingerprint 算法或现有十三个 ordered pairs。
- 不得修改 exact10 donor、Mingshuo 数据库 schema v2、三态 delivery intent、Fact Pack evaluator、Claim-Evidence policy、runtime registry、backup、release contract、frontend、V4、ScenePack 或 DecisionTask。
- 不得新增第二 confirmation ledger、artifact store、archive type、truth source、authority、Harness 或 Agent runtime。
- 不得访问真实客户数据、真实外部渠道、付费或生产系统；不得持久修改系统、用户、Git、Node、Python、pip 或 pytest 配置。
- 本轮只编制三文件治理草案；不授权 authority、approval 正式物化、产品实施、产品测试、commit、push、merge、rebase、fetch、pull、force-push、Pilot、Release 或部署。

## Affected Modules

- 模块：铭硕第一交付 exact10 shadow 的 Python 验证依赖隔离合同与 successor product-authority manifest。
- 允许路径：`backend/app/accounting_reports/storage.py`、`backend/app/api/mingshuo.py`、`backend/app/api/report_artifacts.py`、`backend/app/api/shiguan.py`、`backend/app/mingshuo/models.py`、`backend/app/mingshuo/service.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_mingshuo_delivery.py`、`backend/tests/test_report_artifacts_api.py`、`backend/tests/test_shiguan_storage.py`。

## Technical Plan

1. 在独立治理工作区编制本 Task、Plan 与 proposed approval；对 proposed 单独执行 strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest` 与 RFC 8785 canonical，对 Task 执行 `productTaskErrors=[]`。当前 Harness 会正确拒绝位于 `.harness/approvals/` 的 `*.proposed.json`，因此完整 Harness 必须在同基线隔离验证副本中只排除 proposed、保留 Task/Plan 原字节运行；不得修改或放宽 Harness。另执行路径/模式/差异、raw SHA、三文件 bundle和独立三审。
2. Owner 精确确认 canonical digest后，才能将 proposed 相同 JSON bytes 物化为正式 approval、创建 `c8b7e4a7…` 的直接单亲三文件提交并普通快进；漂移立即 STOP。
3. 正式 approval commit/digest确定后，从 controller donor只机械替换冻结 identity常量并实施Acceptance Criteria冻结的六项机制纠偏，加入本包 verification digest，重新冻结派生 controller raw并独立复审。目录FD对抗自测必须复用controller生产路径绑定函数，其18-case规格与PASS attestation digest一并纳入controller raw审查。外部调用者必须在进入 controller 前核对该 raw并先运行该自测，controller再自行核对自身与 authority/shadow Git identity。
4. 新 controller只运行一次 machine authority。GO 后创建唯一 detached shadow，从现有 donor逐文件重物化 exact10，依次运行 scope、donor、approval lineage、remote、Python snapshot、focused、backend-full exact-two、Ruff、Harness、Doctor、hook、authority regression、V2、diff及最终身份锁。
5. 每条 Python verification由controller创建独立私有快照：复制前对源目录执行完整identity扫描并拒绝symlink/特殊文件及`15302 / 309250828 / b1e3…`漂移；进入独立无网络namespace，通过目录FD绑定的操作复制并在每次mkdir/mount/copy/remount/cleanup前重验祖先device/inode；复制后对private tmpfs再次重算相同身份，remount read-only，降权后exec`/usr/bin/python3`；任何漂移立即STOP。所有由controller正常处理的成功、验证失败和异常终止路径都必须尝试删除临时HOME；清理失败覆盖为`VERIFICATION_HOME_CLEANUP_FAILED`并保留原始失败上下文。
6. 完整矩阵符合冻结拓扑后执行独立 Governance/Python/Security 三审；GO 后冻结身份与后续 readiness prerequisite所需 proposed pair并停止，不形成产品 candidate。

## Implementation Report

只读诊断确认实时 `origin/ext-dev`、前序 authority worktree与 exact10 shadow HEAD均为 `c8b7e4a7e1001f9c5dba336d092f38c659c71aa1`，tree为 `bac9faffad9d5d900770d50903cca7248b6692c5`。前序 controller已运行唯一 machine authority并得到GO；shadow中的 v00、v00a、v00b、v00c通过，v01在13ms内于pytest收集前失败，stdout为空，根因为隔离环境无法导入pytest。未运行后续产品矩阵，也未形成candidate、commit、push或部署。

当前 exact10 shadow仍精确保留十路径，bundle为 `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`，combined full-index diff为 `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。

首个环境方案曾通过设置 `HOME=/home/ubuntu` 暴露真实用户配置，独立审查判定NO-GO；第二个方案直接执行用户可写site-packages，同样被判定NO-GO。后续机制改为私有tmpfs复制、完整内容寻址、只读重挂、空临时HOME、插件白名单和降权执行。实际隔离探针已证明 `/usr/bin/python3`、PID1、`/tmp`、禁用user-site、pytest 9.1.1、FastAPI 0.141.1、Pydantic 2.13.4均符合预期。

controller donor raw为 `sha256:72e016f57f6d5a80f5ba793595ef6163131f4a6ad93c4fae98f2475f93aae5dc`。早期Code与JS增量Review曾为GO，但本治理包独立复审最终确认六类阻断：verification数量锁为20而新manifest为21；普通`stop()`没有清理临时HOME；依赖复制前没有执行源身份预检；未创建network namespace且pip未锁死offline；临时HOME与target的pathname操作存在同UID替换TOCTOU；pytest实际插件及conftest集合未被机械证明。因此该raw被明确降级为`REJECTED_MECHANISM_SOURCE_DONOR / DO_NOT_EXECUTE`；它只能为上述精确六项纠偏后的派生controller提供源码基线，不能继承此前GO或执行身份。

草案校验已证明 proposed 通过 strict JSON、重复键拒绝、Draft 2020-12 schema和 `validateApprovalManifest`，本 Task 的 `productTaskErrors=[]`。草案工作区中的完整 Harness 精确只拒绝 proposed 的两项预期控制面错误：`根 Harness 含未授权 control-plane 路径` 与 `M0 approval manifest 文件名与 task 不一致`；在同一 `c8b7e4a7…` 基线的隔离副本中保留 Task/Plan原字节并排除 proposed 后，完整 Harness 为 `agentic-check: 通过 (159 个基线文件)`。这证明未增加 Harness 豁免，正式物化前必须先移除 proposed。

## Acceptance Review

等待本三文件严格校验与独立 Governance/Python/Security Review。本 Task 的 `Draft` 与 `DRAFT / NON_AUTHORIZING` 明确表示它不是正式 approval、machine GO、产品 candidate、readiness pair或部署授权。proposed manifest中的schema状态即使为`APPROVED_FOR_ONE_CHILD`，也必须经Owner确认canonical digest、相同字节正式物化、直接单亲三文件commit落地并由新派生controller执行一次machine authority后才能生效。Product authority不得发现或消费`*.proposed.json`；Harness对该临时控制面路径的拒绝必须保留，并通过同基线、同Task/Plan字节但排除proposed的隔离验证副本证明其余完整Harness全绿。
