# 铭硕第一交付 · Confirm/Download/Archive/Readback exact10 Shadow Verification Topology Corrective Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-SHADOW-TOPOLOGY-CORRECTIVE-SUCCESSOR-20260914`

冻结基线：`origin/ext-dev@d25e301e29bc8cec16b8eabf86d5be12d7737793`；tree：`55d392bd61b4496c0fecd27e4182321a1c8670ef`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是 `MINGSHUO-FIRST-DELIVERY-CONFIRM-DOWNLOAD-ARCHIVE-READBACK-V1-SUCCESSOR-20260914` 的独立、forward-only verification-topology corrective successor。前序 approval commit `d25e301e29bc8cec16b8eabf86d5be12d7737793` 曾返回 `GO / APPROVED_FOR_ONE_CHILD`，但 exact10 shadow 在完整 backend 的冻结验证合同处停止：产品功能与非-readiness 回归通过，现行 Python readiness 合同却对同一未知 ordered pair 产生两个节点，而前序 approval 只允许第一个节点失败。

Owner 已确认前序任务状态为 `STOP / APPROVAL_VERIFICATION_TOPOLOGY_CONTRADICTION / UNCOMMITTED_BYTE_EVIDENCE_ONLY`，并将该 one-child authority 处置为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR / REISSUE_REQUIRED`。前序 authority、候选、验证或通过身份均不得恢复、消费、继承或重新锚定。

当前 exact10 精确为十条 `M / 100644`，无第十一条路径。定向恢复测试 `5 passed`，focused `234 passed, 2 warnings`，exact10 Ruff 与 `git diff --check` 通过；backend-full 为 `5164 passed, 4 skipped, 5 warnings, 2 failed`。两项失败必须作为一个闭合集合解释，均只证明同一 ordered pair 尚未获 readiness 接受：

- `backend/tests/test_six_ministry_readiness_report.py::test_readiness_evidence_is_bound_to_current_implementation`
- `backend/tests/test_six_ministry_readiness_report.py::test_successor_content_rejects_third_state_drift`

本 corrective successor 不修改 readiness validators，也不放宽它们；它只纠正 shadow 验证包装器，使本轮能够在新 machine GO 下 byte-for-byte 重物化 exact10，严格接受且只接受上述两个失败，完成产品三审并冻结后续 readiness prerequisite 所需的真实身份。诊断阶段计算的 runtime `sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365` 与 successor `sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34` 仅为 provisional evidence；三审前不得作为 compatibility pair、candidate 或通过身份。

## Acceptance Criteria

- [ ] 正式 approval commit 只含 manifest 冻结的 Task、Plan、Approval 三路径，直接单亲绑定 `d25e301e… / 55d392bd…`；proposed 临时路径不得进入提交。
- [ ] Machine authority 必须在实时远端精确等于正式 approval commit时返回 `GO / APPROVED_FOR_ONE_CHILD`。唯一受控 lifecycle-controller 进程必须直接启动这一次 authority、严格解析其唯一 JSON 行，并在不可由子验证命令覆盖的进程内状态中冻结 `taskId / decision / canExecuteProductWork / approvalDigest / approvalCommit / remoteHead`；它必须从该 `approvalCommit` 的 Git object 读取正式 approval、重算 RFC 8785 digest，并在每条 shadow verification 前后机械证明当前 HEAD、实时 remote、正式 manifest digest 均等于冻结 GO 身份。不得经环境变量、工作树临时文件或子进程回显接收这些期望值。v00c/v12d 另在矩阵端点直接只读查询远端；结合 v00b/v12c 的直接单亲、三治理路径和模式锁，拒绝本地 sibling、已观测远端漂移或同父替换。现有远端不提供可证明 ref 从未 move-and-return 的单调历史，因此本包只声称所有 authority 与逐项验证观测点一致；不得把端点查询冒充连续历史证明。
- [ ] Shadow 运行任何产品验证前及完整矩阵结束后，都必须机械确认当前 HEAD 是 `d25e301e… / 55d392bd…` 的直接单亲子，且该 HEAD 只新增正式 Approval、Task、Plan 三路径、模式均为 `100644`；同时只存在原 exact10 十条未暂存 `M / 100644`，无暂存、未跟踪、第十一条路径、增删改名复制、模式或 submodule 漂移。十文件 raw SHA、Git blob、bytes、bundle `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee` 与 combined full-index diff `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37` 必须逐项一致。
- [ ] Finalize、terminal receipt、史馆 MEMORIAL/REPLY、专用下载与项目 readback 保持同一 tenant/owner/project/draft/artifact/work-product/binding 身份；重复、并发、commit-then-error、进程恢复和文件/回执/档案篡改全部 fail closed，且不产生第二回执、第二档案或第二文件。
- [ ] Generic report-artifact 与 Shiguan API 不得绕过 Mingshuo 专用边界；非 `CONFIRMED` 终态不得发布、下载或归档。
- [ ] Focused、exact10 Ruff、Harness self-test、Doctor、hook、authority regression、V2 与 diff check 全绿。
- [ ] Backend-full 必须精确为 `5164 passed, 4 skipped, 5 warnings, 2 failed`；唯一 POSIX `/tmp` JUnit XML 必须结构化证明 `5170 tests / 2 failures / 0 errors / 4 skipped`，且上述两个 readiness node 的 failure element 各自绑定自己的 assertion evidence。不得出现 deselect/xfail/xpass/rerun、第三失败、ERROR、timeout、不完整结果或意外全绿。完整 Harness 仍只允许现有单一 readiness diagnostic。
- [ ] Governance、Python 与 Security 三个独立只读审查均为 `GO / P0=0 / P1=0 / P2=0`；任何 P0–P2 立即停止。
- [ ] 三审 GO 后重新计算并冻结 exact10 raw/blob/mode/bytes、bundle、combined full-index diff、RED/GREEN evidence、verification evidence、65-path runtime fingerprint、2-path successor fingerprint 与唯一 proposed ordered pair，然后立即停止。
- [ ] 本 shadow 不创建 product candidate commit、不运行 machine verify-candidate、不推送产品字节；后续必须先独立落地 readiness exact2 prerequisite，再基于最新 ext-dev 重签 exact10 Product Successor并从冻结 donor重物化、全量复验和三审。

## Delivery Constraints

- approvalCommitPaths 精确为本轮正式 Approval、Task、Plan 三路径；productPaths 精确保持原 exact10 十路径。
- 不得修改 `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`、历史 readiness 报告、四项 exclusions、69/65 计数、历史 review identity、两条 successor-content paths、fingerprint 算法或现有十三个 ordered pairs。
- 不得把两个 readiness failures 改写成两个独立事实；它们必须精确绑定同一 provisional runtime/successor pair。不得接受第三失败、其他 assertion、ERROR、timeout 或测试未完成。
- 不得修改 Mingshuo 数据库 schema v2、三态 delivery intent、Fact Pack evaluator、Claim-Evidence policy、runtime registry、backup、release contract、frontend、V4、ScenePack 或 DecisionTask。
- 不得新增第二 confirmation ledger、artifact store、archive type、truth source、authority、Harness 或 Agent runtime。
- exact10 donor 必须保持 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；不得删除、提交、推送或继续在旧 authority 下修改。
- 本轮不授权 candidate commit/push、force-push、merge、rebase、fetch、pull、Pilot、Release 或生产部署。

## Affected Modules

- 模块：铭硕第一交付确认、下载、史馆归档与项目详情回读的后端 exact10 shadow，以及只用于验证拓扑纠偏的 product-authority manifest。
- 允许路径：`backend/app/accounting_reports/storage.py`、`backend/app/api/mingshuo.py`、`backend/app/api/report_artifacts.py`、`backend/app/api/shiguan.py`、`backend/app/mingshuo/models.py`、`backend/app/mingshuo/service.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_mingshuo_delivery.py`、`backend/tests/test_report_artifacts_api.py`、`backend/tests/test_shiguan_storage.py`。

## Technical Plan

1. 冻结本三文件治理包；执行 strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、路径/模式/差异、RFC 8785 canonical、raw SHA、bundle、完整 Harness 与独立 Governance/Security Review。
2. 等待 Owner 精确确认唯一 canonical digest；在远端仍为 `d25e301e…` 时物化相同 JSON bytes 为正式 approval，移除 proposed 临时文件，创建一次三文件直接单亲治理 commit并普通快进。
3. 在干净 authority 工作区只运行一次 machine authority；GO 后创建唯一 detached shadow，从当前 exact10 donor逐文件重物化并先核对十文件 raw/blob/mode/bytes与 bundle。
4. 唯一 lifecycle-controller 进程直接启动一次 authority，严格解析唯一 JSON 行，在自身内存冻结 GO task/digest 与同一流程核验的 commit/remote；它从冻结 commit object 重算正式 manifest digest，不把调用者环境、工作树文件或子进程回显当作 authority provenance。controller 在每条验证前后比较当前 HEAD、实时 remote、正式 manifest digest与冻结 GO身份，再依次运行 approval HEAD 单亲 lineage、三治理路径、exact10 全范围、模式、blob、bundle、full-index diff锁、定向 RED/GREEN、focused、Ruff、backend-full JUnit exact-two wrapper、Harness single-diagnostic wrapper及其余冻结矩阵；不得修改 validator或验证器输出。矩阵结束后必须再次运行同一 identity、lineage、范围和内容锁。任何观测点漂移立即 STOP；本包不声称证明两次远端查询之间从未发生 move-and-return。
5. 完整矩阵符合预期后执行独立 Governance/Python/Security 三审；三审 GO 后冻结 exact10 和 proposed pair身份并 STOP，不创建 candidate commit。
6. 后续另立最窄 readiness exact2 protected-path prerequisite；pair 落地后基于最新 ext-dev 重签产品 successor、重物化 exact10并重新完成全绿矩阵、三审、machine verify-candidate与普通快进。

## Implementation Report

只读诊断和治理草案已开始。实时 `origin/ext-dev`、前序 approval 工作区和 exact10 donor HEAD 均为 `d25e301e29bc8cec16b8eabf86d5be12d7737793`，tree 为 `55d392bd61b4496c0fecd27e4182321a1c8670ef`。Python 与 Node readiness validators 当前精确一致，含十三个 ordered pairs、四项 exclusions、69/65 文件计数与两条 successor-content paths。

exact10 donor 当前 provisional bundle 为 `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`，combined full-index diff 为 `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。这些摘要只用于后继重物化一致性检查，不构成 candidate、通过、readiness compatibility 或验证继承身份。

本阶段只允许编制与审查三文件草案；未修改 exact10 donor、两个 validators、Harness、authority或产品运行时，未创建 commit、未 push、未部署。首轮 Governance/Security Review 发现验证包装器未机械拒绝 exact10 外路径/模式漂移、未完整锁定 blob/bundle/diff，且 backend-full 拓扑计数与 assertion 归属不够严格；后续复审又识别 current-HEAD 基线、JUnit 结构化归属，以及调用者可伪造的环境变量不能充当 machine-GO provenance。本草案已依次补入前后范围/内容锁、approval HEAD 单亲/三路径锁、JUnit failure-element 绑定和端点实时远端锁，并冻结由单一外部 lifecycle-controller 直接解析 authority、从 commit object重算 digest、在每条验证前后比较 GO identity的机械契约；同时如实将未提供的连续 remote ref history attestation 排除在完成声明外，不将任何前序 NO-GO 冒充通过。

## Acceptance Review

等待修正后 strict validation 与独立 Governance/Security 复审。本 Task 的 `Draft` 与 `DRAFT / NON_AUTHORIZING` 明确表示草案不是正式 approval、machine GO、产品 candidate 或 readiness pair授权。proposed JSON 即使为 schema 要求的 `APPROVED_FOR_ONE_CHILD` 状态，也只有在 Owner 确认 digest、相同字节物化到 manifest 精确 `approvalPath`、形成绑定基线的直接单亲三文件 commit且 machine authority 验证后才可能授权；任何工具不得扫描或消费 `*.proposed.json`。Owner 精确确认最终 canonical digest前不得物化或提交。
