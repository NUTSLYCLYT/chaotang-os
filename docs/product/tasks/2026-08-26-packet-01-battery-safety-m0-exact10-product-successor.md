# Packet 01 — Battery Safety M0 exact10 Product Successor

任务 ID：`PACKET-01-BATTERY-SAFETY-M0-EXACT10-PRODUCT-SUCCESSOR-20260826`

冻结基线：`origin/ext-dev@521108316e8609dbea03228d98f801a7c35b5776`

冻结基线 tree：`dd0aa8031b75dca96f1d4ca76bcbbaa6144e9424`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。
> proposed approval 中的 `APPROVED_FOR_ONE_CHILD` 是正式物化后供机器校验的闭合 schema 值；当前 proposed 路径、Task 和 Plan 不构成 approval、machine GO、candidate 或产品通过。

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

## Product Definition

- 目标用户：向朝堂提交电池、电芯、BMS、PACK 或储能柜事故描述的人，以及需要对安全判断负责的 Owner 与审核者。
- 用户行为：用户提交描述后，系统在模型、authority、job、数据库业务写入和部门调用前完成确定性电池安全分类与门控。
- 最终成果：一条不可被模型、marker、非法司名、非 Ready 状态或并发 authority 替换降级的安全链；对 P0/P1 输出确定性的立即行动、禁止动作、人工确认、非 LIVE 来源和未核验现场缺口；纯软件故障保持普通流程。
- 所属闭环：办事闭环；只覆盖 Battery Safety M0 exact10，不代表真实设备控制、现场核验、Pilot、Release 或部署。
- 当前成熟度：`SHADOW_EXACT10_EVIDENCE_FROZEN / NOT_A_CANDIDATE` 的 predecessor byte donor；本 successor 尚未批准。
- 目标成熟度：在新 approval、machine GO、byte-for-byte 重物化、完整新验证和独立双审后成为可供 Owner 验收的本地 candidate。

## Predecessor And Authority Boundary

旧 exact10 工作区：

`/home/ubuntu/Projects/chaotang-os/.worktrees/packet01-battery-safety-corrective-governance-20260825`

其固定身份为 HEAD `c939bc4dc5f759d52ca86424c725f8ac2baf2d19`、tree `a7ce87107ca4763c448183b1a21b467310a72443`，当前处置精确为：

`SHADOW_BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_AUTHORITY_INHERITANCE`

旧 product authority、candidate、nonce、验证通过结论和审查结论不得消费、恢复、继承或 re-anchor。旧 RED/GREEN evidence digest
`sha256:be2a644e6b1ff8e6213c81b9f65394b83635d736e74aef2b277d3f24e02af51d`
仅绑定 predecessor `c939bc4d… / a7ce8710…`，不能作为新基线 approval 或 candidate 证据。

## Forward-Only Lineage

从 predecessor base 到当前 base 的完整单亲 lineage 已机械确认：

| Commit | Parent | Tree | Changed paths | exact10 overlap |
| --- | --- | --- | --- | --- |
| `e698fdc7771445f1e6bf2084fa94dc52d9e4064d` | `c939bc4dc5f759d52ca86424c725f8ac2baf2d19` | `45aa9e2aeee722c8c9cbd295929dca3a52cc8f12` | 3 条 First Decree governance paths | 0 |
| `67cb1816dafcbf1558a0ff227dc3886fae02795e` | `e698fdc7771445f1e6bf2084fa94dc52d9e4064d` | `f672064439355715e5616d61eee9d872297130ce` | 3 条 readiness prerequisite lineage successor paths | 0 |
| `1e937ddc9e6063b330648a75ea8ff41dbed64ea6` | `67cb1816dafcbf1558a0ff227dc3886fae02795e` | `9f282a769bc749b5dd1d9468a2b5ace55587c3b3` | 3 条 governance-contract corrective successor paths | 0 |
| `eb1469b9a9e04804d218ec2840bf3b1f9630217f` | `1e937ddc9e6063b330648a75ea8ff41dbed64ea6` | `61baa914ab5a121b4c584fb8f702cb46d9d4dfff` | 1 条 lineage Task corrective path | 0 |
| `ba125c4f3f3c0ac1c9922c6b3facfc5156c8763f` | `eb1469b9a9e04804d218ec2840bf3b1f9630217f` | `c4ed3b45a02b50ca6245b08c9ed529f9198ceda0` | 3 条 readiness validator successor paths | 0 |
| `521108316e8609dbea03228d98f801a7c35b5776` | `ba125c4f3f3c0ac1c9922c6b3facfc5156c8763f` | `dd0aa8031b75dca96f1d4ca76bcbbaa6144e9424` | 2 条 readiness validator paths | 0 |

逐提交 changed paths 精确为：

- `e698fdc7771445f1e6bf2084fa94dc52d9e4064d`：`.harness/approvals/FIRST-DECREE-COCKPIT-V1-20260826.json`、`docs/product/tasks/2026-08-26-first-decree-cockpit-v1.md`、`docs/superpowers/plans/2026-08-26-first-decree-cockpit-v1.md`。
- `67cb1816dafcbf1558a0ff227dc3886fae02795e`：`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-lineage-successor.md`、`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-lineage-successor.packet.json`、`docs/superpowers/plans/2026-08-26-packet-01-readiness-compatibility-prerequisite-lineage-successor.md`。
- `1e937ddc9e6063b330648a75ea8ff41dbed64ea6`：`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-governance-contract-corrective-successor.md`、`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-governance-contract-corrective-successor.packet.json`、`docs/superpowers/plans/2026-08-26-packet-01-readiness-compatibility-prerequisite-governance-contract-corrective-successor.md`。
- `eb1469b9a9e04804d218ec2840bf3b1f9630217f`：`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-lineage-successor.md`。
- `ba125c4f3f3c0ac1c9922c6b3facfc5156c8763f`：`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-validator-successor.md`、`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-validator-successor.packet.json`、`docs/superpowers/plans/2026-08-26-packet-01-readiness-compatibility-prerequisite-validator-successor.md`。
- `521108316e8609dbea03228d98f801a7c35b5776`：`backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。

上述共 15 个 changed-path records 与 exact10 十路径集合交集精确为空；这只是 forward-only 零重叠证明，不把任何 intervening commit 的 authority 或 candidate 身份传给本 successor。

First Decree one-child authority 已由 Owner 处置为 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`，不得恢复。当前 readiness validators 已在最新基线原子接受第四 ordered pair：

`["sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e","sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"]`

## Frozen Findings

本 successor 必须重新证明并关闭：

| ID | 级别 | 不可回退的结果 |
| --- | --- | --- |
| `BAT-P0-01` | P0 | 任一客户端非 `user` role 使整请求 fail-closed；模型、authority、job、route、数据库业务写入和部门调用均为零。 |
| `BAT-P0-02` | P0 | 电池燃烧、冒烟、泄漏及等价中英文/ASCII/Unicode 分隔表达优先判为 P0，软件语境不能压制物理 P0。 |
| `BAT-P1-01` | P1 | marker 只能收紧，不能把可信用户文本中的 P0 降为 P1 或 NOT_APPLICABLE。 |
| `BAT-P1-02` | P1 | 所有用户可见字段与 fallback 均经确定性后置门；`NEEDS_INPUT`、`PARTIAL`、`ISSUE_BLOCKED` 等非 `DRAFT_READY` 也不能绕过安全投影；非法司名 + P0 必须优先返回 canonical P0。 |
| `BAT-P2-01` | P2 | 同步/异步门早于 store 构造、恢复、reserve、consume、job、authority、业务数据库和部门调用；真实 registry 的 lookup→replacement→mutation 窗口必须失败关闭。 |
| `BAT-P2-02` | P2 | 纯软件/APP/BMS 软件故障不误报物理事故，但与电芯燃烧或冒烟并存时仍为 P0。 |

附加安全合同：MinistryReport/CouncilReport 的 `input_refs`、`data_sources`、`evidence_refs`、`audit_refs` 不得把危险模型动作带入案件或 immutable runtime report canonical JSON；电池安全投影固定表达“仅用户文本规则、非 LIVE、现场未经核验”，不得保留误导性的 `SUFFICIENT / COMPLETED`。两个真实 Registry TOCTOU 用例若在未修字节首次通过，应如实记录 `PROOF_GAP_NOT_IMPLEMENTATION_DEFECT`，不得伪造 RED。

## Frozen Donor Identity

exact10 结构固定为 `2 ADD + 8 MODIFY`，模式全部 `100644`：

| Path | Status | Bytes | Raw SHA-256 | Git blob |
| --- | --- | ---: | --- | --- |
| `backend/app/agents/chancellor/graph.py` | M | 33762 | `sha256:e3de7ae1890cf0dddeca34effd93eb1e42505e4063c4af30ca48e1c4ea90646b` | `c93d981d026a903682ea171ac8d9fddde78b8367` |
| `backend/app/agents/chancellor_draft/battery_safety.py` | A | 18467 | `sha256:a72600acd04d1f594cd7728696cb4df623db012af60a243a5ccc02fe8fd1ad0b` | `71376b60666d8996afe97094bfa0ea6557a0ef88` |
| `backend/app/agents/chancellor_draft/graph.py` | M | 31904 | `sha256:6c9ae4146b14f906470ff230d8bbe521f1eaf404b6b2ea9adbc6f78bc03c0881` | `f75736043b2e70df959c4954955e2659f82590db` |
| `backend/app/api/chancellor_drafts.py` | M | 9671 | `sha256:463ace8cf8c1c759aa875d24c403c10909c0348feb443dbefbd3c8e5c9fb4b17` | `2e5a4da46dcc032cb7ee455e9a1d7f317a1ae6cf` |
| `backend/app/api/decrees.py` | M | 61013 | `sha256:e499fa324b69441050d31a4030b5380cda7b152426ca0739e963a7ce4e2348fc` | `6aeddb5f29e9dcfa71daf9eded3fca5de1c840d2` |
| `backend/tests/test_battery_safety.py` | A | 3449 | `sha256:77b620520aad1218a019254ba5fc99e286bbb5690adc93742c8d6b8c48d078ef` | `fbab5692b29400a6aef1f32cf6876601872ef843` |
| `backend/tests/test_chancellor_draft_graph.py` | M | 53248 | `sha256:b5e37026aef6ea05379b9a807eb159fb20b5167f1db3912f6857b1fda7a89ecf` | `2aed168c169fff61155222dea7e36fbc7363744c` |
| `backend/tests/test_chancellor_drafts_api.py` | M | 32784 | `sha256:4224deb135c9dcc05e8ea128dd0300c76c914fc77f5cd7af26e1fa514dae9c6d` | `d8820f4477b2cc0dd0bd7e3828df46acf1f0d9f9` |
| `backend/tests/test_chancellor_graph.py` | M | 74925 | `sha256:ec1bde5779373ad3259331b6ac6da9c602e482248d96a26f566d9469d2472e75` | `3b671f3b100f0e5a5f09babe400e7347d1dbd05d` |
| `backend/tests/test_decrees_api.py` | M | 94485 | `sha256:c67d8e3d592b40022d3ba4ab3dfde413e3b93c30e3ebd059443d849e79ae688c` | `0436d1d6b982d15fff18acf455385d0c220b407e` |

- exact10 bundle：`sha256:df3bb9e9d099433468191457b9e554dc59980aea45724f2bedb4b628305b400a`。
- combined exact10 full-index diff：`sha256:cd181a1c51161a269784ffe224ca54ff610be142b7d92c3dfa85233556781db8`。
- combined diff 算法：按 path 字典序，tracked 路径使用相对 donor HEAD 的 full-index binary diff，untracked ADD 路径使用 `/dev/null` 到文件的 full-index binary diff；逐路径原始 diff bytes 无分隔串联后做 SHA-256。只含 tracked 路径的普通 `git diff` 摘要不得冒充该值。
- runtime fingerprint：`sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e`。
- successor fingerprint：`sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`。

这些值只证明 donor bytes。未来 candidate 必须从新 approval commit 的干净子工作区 byte-for-byte 重物化并重新计算；任何不一致立即 STOP。

## Acceptance Criteria

- [ ] Owner 精确确认 proposed approval 的 RFC 8785 canonical digest；raw SHA 和三文件 bundle 仅作字节传输与包身份校验。
- [ ] 正式 approval commit 是 `521108316e8609dbea03228d98f801a7c35b5776` 的直接单亲子，仅含正式 approval、Task、Plan 三条路径。
- [ ] 远端精确等于 approval commit 后，machine authority 返回 `GO / APPROVED_FOR_ONE_CHILD`；否则产品保持 STOP。
- [ ] 新候选仅在唯一写入者、干净隔离工作区中从 donor byte-for-byte 重物化 exact10，并重新核对十文件、`2 ADD + 8 MODIFY`、模式、bundle 与 combined diff。
- [ ] 20 个冻结安全负向节点、focused、完整 backend、exact10 Ruff、结构、Harness、doctor、authority regression、V2 convergence 与 `git diff --check` 全部重新通过。
- [ ] backend-full 及依赖 Python/Node 临时仓语义的验证仅做进程级 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp` 归一化；不得持久修改系统、用户、Git、Python、pytest 或 Node 配置。
- [ ] Python Review 与 Security Review 均为 `GO / P0=0 / P1=0 / P2=0`，且不继承 predecessor 结论。
- [ ] 候选提交、推送、Pilot、Release、发布与部署分别等待 Owner 新授权。

## Delivery Constraints

- 当前授权只允许本 Task、Plan、proposed approval 三份治理草案和只读验证/复审；不得物化正式 approval、运行 authority、修改 exact10、运行产品测试、commit 或 push。
- future product candidate 的唯一修改范围是 proposed approval 的 exact10；需要第十一条路径、validator、Harness、数据库 schema、前端或其他事实源立即 STOP。
- donor 工作区必须保持不动。可以按冻结身份读取 bytes，不得从旧分支 checkout、merge、cherry-pick、提交或继承身份。
- 新 candidate 的每项通过证据必须绑定新 base、approval digest、candidate SHA/tree 和新 evidence digest。
- 不得用删测、skip、放宽 safety guard、独立 allowlist、伪造 RED、假 LIVE 证据或局部伪修复换取通过。

## Affected Modules

- 模块：中书省 draft 输入信任边界与电池分类；draft marker/状态/非法司名优先级；decree 同步/异步执行前门、真实 authority registry 并发绑定、案件与 runtime report 安全投影；丞相最终回复安全后置门；对应测试。
- 允许路径：`backend/app/agents/chancellor/graph.py`、`backend/app/agents/chancellor_draft/battery_safety.py`、`backend/app/agents/chancellor_draft/graph.py`、`backend/app/api/chancellor_drafts.py`、`backend/app/api/decrees.py`、`backend/tests/test_battery_safety.py`、`backend/tests/test_chancellor_draft_graph.py`、`backend/tests/test_chancellor_drafts_api.py`、`backend/tests/test_chancellor_graph.py`、`backend/tests/test_decrees_api.py`。
- 依赖模块：已落地的 readiness validator ordered-pair 合同，以及现有 authority、job、case/report storage 接口；本任务只复用，不修改。

## Technical Plan

未来执行固定为：治理冻结 → 正式 approval commit/push → machine GO → 新隔离工作区 byte-for-byte 重物化 exact10 → 身份核对 → 负向/focused/backend-full/Ruff/治理矩阵 → 新 Python/Security 双审 → candidate evidence 冻结 → 等待本地 candidate commit 授权。详细命令和停止条件见配套 Plan。

## Implementation Report

- 已完成：最新 `origin/ext-dev`、tree、完整单亲 lineage、零重叠、readiness pair 落地、旧 exact10 十文件 bytes/raw/blob/mode、bundle、combined diff、runtime/successor fingerprint 的只读机械核验。
- predecessor 事实：`SHADOW_EXACT10_EVIDENCE_FROZEN / NOT_A_CANDIDATE`；曾得到 Python/Security `GO / P0=0 / P1=0 / P2=0`，但所有验证和审查只作 predecessor evidence。
- predecessor full backend 事实为 `4172 passed, 4 skipped, 1 readiness closed-pair failed`；readiness prerequisite 随后已 forward-only 落地并在 validator successor 验收中形成 `4132 passed, 4 skipped, 3 warnings`。两者都不能替代新 candidate 的从零复验。
- TOCTOU 两个真实 Registry 测试在 predecessor 首次即通过，正确结论为 `PROOF_GAP_NOT_IMPLEMENTATION_DEFECT`；provenance/status 测试形成真实 RED→GREEN。不得改写历史。
- 未完成：Owner digest 确认、正式 approval、machine GO、exact10 重物化、新验证、新双审、candidate commit/push、Pilot、Release 或部署。

## Acceptance Review

- 治理包：等待 strict JSON/schema、`productTaskErrors`、Harness、摘要和独立 Governance/Security Review 完成后冻结给 Owner 确认。
- 产品：`PRODUCT_STOP`；无新 candidate、无新 authority、无通过结论。
- 任一远端漂移、身份不一致、第三类事实源、第十一路径、测试失败或独立 P0–P2 立即 STOP；不得 re-anchor。
