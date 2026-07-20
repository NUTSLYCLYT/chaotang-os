# R0 可信合同内核实施修正案

> Amendment ID：`R0-TRUSTED-KERNEL-AMENDMENT-01`
> 状态：`PROPOSED / PENDING_G0_HOSTED_MERGE / PENDING_OWNER_APPROVAL`
> 产品范围：`R0_INTERNAL_TRUSTED_KERNEL`
> 数据边界：仅合成数据，或经合法性复核且不可重新识别的去标识材料
> 当前草案基线：stacked on G0 evidence commit `bf99f6091a6a535ae4ef1e6d8534029c866f3419`
> 生效基线：`PENDING`；必须在 G0 合入后绑定新的 `origin/feature-chaotang-ext@<exact-sha>`
> 执行授权：`NOT_GRANTED_BY_THIS_DRAFT`

本修正案把产品宪法、R0/R1 PRD 与旧 M0–M10 宽平台计划收敛为一条合同纵切价值流。它在获得产品 Owner 对 exact amendment digest、exact integration base 和批准范围的明确确认，并由后续 execution-authority v2 绑定前，不授权修改产品 runtime。

## 1. 裁决

R0 只交付一件事：

> 一名内部用户在 `/shangshufang` 上传一份受支持的合同，确认精确任务版本，收到有原文锚点、保守裁决和可验证附件的 `ContractReviewPack`，对精确 `FinalMemorial` 作人工裁决，并能重新打开同一份归档。

第一条 golden slice 固定为：

```text
合成的中国大陆制造业/B2B采购合同
→ 我方角色：买方
→ 文件：可检索 DOCX
→ 预期裁决：REVISE_BEFORE_PROCEED
→ /shangshufang 单入口
→ PDF + DOCX + JSON + ArtifactManifest
→ 精确人工裁决
→ ArchiveReceipt 与史馆回读
```

R0 不以 Agent、页面、部门、分支或文档数量衡量完成，只以这一真实纵切和冻结退出门衡量。

## 2. 当前事实与红灯

| 事实 | 当前状态 | 影响 |
| --- | --- | --- |
| G0 inactive authority | `origin/task/r0-execution-authority-20260720@bf99f6091a6a535ae4ef1e6d8534029c866f3419` 已推送；Gitee PR/required check/merge 未完成 | 仍为 `NOT_ENFORCED` |
| v1 `--authorize` | 固定 `STOP / AMENDMENT_APPROVAL_REQUIRED` | 只能编制修正案，不能做 runtime |
| 产品 SSOT / R0 PRD | 已冻结；22 条 R0 REQ 完整 | 产品范围明确 |
| Direct 完成语义 | `direct_completed` 仍会被投影为 completed/report-ready | stop-ship：伪完成 |
| 幂等 runtime | 规格存在，运行实现缺失 | 重复任务/重试风险 |
| 合同摄取 | DOCX/PDF/OCR 安全流水线不存在；现有 IMA 是全局路径 | stop-ship：敏感数据和跨租户风险 |
| 合同核心协议 | `MissionContract`、`ContractReviewPack`、`ArtifactManifest` 仅存在于文档 | 无法形成正式产品闭环 |
| 前端 core | `cd frontend && pnpm test:core`：70 个测试文件中 53 通过、17 失败，exit 1 | 不得宣称前端 release-ready |
| evaluator / flows | `cd frontend && pnpm eval:court`：12 个文件 3 通过/9 失败；`cd backend && python3 scripts/validate_flows.py`：3 errors；均 exit 1 | 不得宣称质量闭环 |
| golden contracts | 30+ 集合与版本化 scorer 不存在 | 质量状态必须 `NO_DATA` |
| prod doctor | `cd frontend && pnpm prod:doctor`：STOP，http-health/true-chain 通过，其余 3 项失败，exit 2 | 不得部署或宣传上线 |

以上结果是 2026-07-20 的只读调查证据，不是未来 Packet 的可继承 PASS。每个 Packet 必须在自己的 exact HEAD 重新取证。

## 3. 唯一用户旅程与页面边界

```text
一旨：合同、角色、法域、目标、底线、最担心项
→ 安全摄取与支持范围检查
→ 一卡：输入版本/摘要、读取范围、禁止动作、唯一阻塞、预算、成果
→ 用户确认精确 MissionContract
→ 最小刑部合同能力进入 canonical 主链
→ 原文证据、门下/御史硬门、唯一 FinalMemorial
→ 一包：五种裁决、Top 3–5、最大未知、风险表、PDF/DOCX/JSON/Manifest
→ 用户对 final_memorial_id + content_hash + version 裁决
→ ArchiveReceipt
→ 史馆按同一 lineage 回读
```

- 普通用户入口只使用 `/login|/enter → /shangshufang`。
- `/junjichu` 与 `/shiguan` 是可选只读下钻，不成为第二状态机。
- `/dadian` 保持冻结。
- 不新增 BFF、合同中心或 `/reports/[id]`；成果留在上书房任务内。
- 现有 IMA 上传、localStorage 报告和 `window.print()` 不得用于合同 R0。

## 4. 权威、Owner 与执行纪律

| 权威问题 | 唯一事实源 / Owner |
| --- | --- |
| 产品身份、Offer、发布层级 | `docs/product/PROJECT_PRODUCT.md` / Product Owner |
| 22 条 R0 需求与退出门 | R0/R1 PRD / Product Owner |
| 本修正案、顺序与授权范围 | 本文件 / Product Owner + Program Owner |
| API/Pydantic/OpenAPI | 后端 API Contract Owner |
| canonical 状态与写入 | Canonical Runtime Owner |
| tenant/data/security | Security & Data Owner |
| 浏览器体验 | Frontend Owner |
| 黄金集与 scorer | QA + Legal Evaluation Owner |
| release identity 与回滚 | Release Owner + Security Owner |
| 独立复审 | Claude Code，只读、非写入者 |

具名人选必须在批准证据中填写；批准前，除用户为 Product Owner、Codex 为 amendment 起草者外，其余角色均为 `UNASSIGNED`，不得用角色名假装人员已经到位。

执行纪律：

1. 同时最多 `1 个实现 Packet + 1 个独立复审窗口`。
2. 每个 Packet 从最新受保护 EXT exact SHA 创建；禁止从历史 task/candidate 整支合并。
3. 每个 Packet 必须 RED → GREEN → 专项/回归/doctor → exact-H Claude Code review → hosted PR → merge 后复验。
4. execution-authority v2 每次只激活一个 `activeWorkPackage`；修正案批准不等于所有 Packet 同时开工。
5. 前一 Packet 未 `MERGED_AND_VERIFIED`，后一依赖 Packet 保持 `BLOCKED_DEPENDENCY`。
6. 任何 stop-ship、未关闭 release P0/P1 或证据 `NO_DATA` 都不得被文档豁免。

## 5. R0 工作包与依赖

```text
W00 G0 托管合入
  → W01 amendment 批准 + execution-authority v2
    → W02 共享合同契约
      ├→ W03 安全摄取与租户隔离
      └→ W04 幂等、single-writer、真实完成与恢复
            ↓
          W05 合同证据与 ContractReviewPack
            ↓
          W06 ArtifactManifest 与真实交付
            ↓
          W07 一旨一卡一包真实前端
            ↓
          W08 黄金集、真实 E2E、无陪同测试
            ↓
          W09 不可变发布与运行身份
```

W03 与 W04 只有在不共享迁移、canonical writer 或状态事实源时才可并行。W08 的 fixture/scorer 骨架可在 W02 后开始，但不得在运行链未完成时制造 PASS。

PRD open question 不是笼统的 W01 前置，而是按最晚时点阻断对应 Packet：

| Open question | 必须在何时冻结 | 未冻结时 |
| --- | --- | --- |
| OQ-01：R0/R1/R2 与 M0–M10 唯一映射 | 本修正案批准前 | 本修正案不得批准；本文件 §5.1/§6 负责关闭 |
| OQ-02：文件/OCR 阈值 | W03 RED 前 | W03 保持 `BLOCKED_INPUT` |
| OQ-03：支持/拒答 taxonomy | W02 契约冻结前；W08 golden freeze 前复核 | W02/W08 保持 `BLOCKED_INPUT` |
| OQ-09：基础/附加成果格式 | W06 schema 前 | W06 保持 `BLOCKED_INPUT` |
| OQ-10：120 份数据来源/标注预算 | W08 从 R0 30+ 扩展到 R1 数据前 | 不阻断合成 R0；阻断 R1 数据扩展 |
| OQ-04～OQ-06 | 任何真实客户材料或 R1 前 | R1/真实数据保持 STOP |

| 顺序 | ID | 目标 | 主责 REQ | 历史输入说明（非所有权） | 退出价值 |
| ---: | --- | --- | --- | --- | --- |
| 0 | R0-W00 | G0 hosted PR、required review、合后重验 | 治理前置 | inactive authority guard | 只有一条施工权威 |
| 1 | R0-W01 | 批准本修正案并建立 packet-scoped v2 authority | 追踪全部 REQ，不实现业务 | 事实源与执行权威 | 每次只放行一个包 |
| 2 | R0-W02 | 合同、Mission、裁决、状态的共享 v1 契约 | 003–007、012、017 | task/capability 契约输入 | 前后端说同一种语言 |
| 3 | R0-W03 | 安全文件摄取、OCR、tenant/object/purpose 权限 | 001、002、019 | tenant/provider 安全输入 | 客户材料不泄露、不静默漏读 |
| 4 | R0-W04 | idempotency、single writer、完成公式、恢复与全链 ID | 008、013、014、018、020、022 | trace/gate/receipt 输入；不含通用 adaptive/lazy-load | 不重复、不伪完成、可恢复 |
| 5 | R0-W05 | 原文证据、五种裁决、最小刑部合同能力 | 009–011 | evidence/conflict gate 输入 | 结果可复核、该拒答就拒答 |
| 6 | R0-W06 | PDF/DOCX/JSON、ArtifactManifest、下载与 PARTIAL | 015、016 | outcome/artifact 输入 | 从分析文本变成可验证成果 |
| 7 | R0-W07 | `/shangshufang` 一旨一卡一包真实闭环 | 021 | 前端消费者 | 普通用户能独立使用 |
| 8 | R0-W08 | 30+ goldens、scorer、10/10 real E2E、5 人测试 | 消费 001–022 | golden/KPI 证据生产者 | 证明质量而非演示质量 |
| 9 | R0-W09 | immutable build、runtime identity、N-1 回滚 | release gate | release/observability 消费者 | 可判定的 R0 Go/No-Go |

### 5.1 R0/R1/R2 与旧 M0–M10 的唯一权威处置

旧 M0–M10 从本修正案批准后不再作为可直接领取的并行执行包；每个旧 M 只允许下面一个处置。R0 使用 W00–W09 为唯一施工图；R1 只在 R0 内核上增加 Paid Pilot 的数据、人工复核、运营和收费门；R2 只在 R1 退出门后增加邀请制发布门。R1/R2 均需新 amendment，不能重新激活旧 M 名称开工。

| 旧里程碑 | 唯一处置 | 发布归属 | 边界 |
| --- | --- | --- | --- |
| M0 | R0-W01 | R0 | 事实源、amendment 与执行权威；黄金/质量由 W08 独立度量，不再保留第二个 M0 owner |
| M1 | R0-W04 | R0 | task/trace/idempotency 的 canonical runtime；输入 schema 由 W02 提供 |
| M2 | R0-W02 | R0 | 只做合同 slice 最小 Capability/Support/Mission 契约 |
| M3 | FROZEN_POST_R0 | R2+ 条件项 | 通用 adaptive/shadow routing 冻结；若重启必须新 amendment 和真实瓶颈证据 |
| M4 | FROZEN_POST_R0 | R2+ 条件项 | 通用 lazy-load/budget 平台冻结；R0 仅由 W04 提供确定性硬上限 |
| M5 | R0-W05 | R0 | 合同原文证据与缺证语义 |
| M6 | R0-W05 | R0 | 门下/御史确定性证据与冲突门；与 M5 合并为一个合同内容包 |
| M7 | R0-W06 | R0 | ArtifactManifest、交付附件和回执；W07 只消费 read model |
| M8 | FROZEN_POST_R0 | R2+ 条件项 | 41 司/六部宽度冻结；W05 最小刑部合同能力不构成 M8 完成 |
| M9 | R0-W09 | R0 | 只做 R0 release identity/Go-No-Go；W08 生产质量证据 |
| M10 | CONDITIONAL_POST_R0 | R2 后条件 PoC | M0–M9 所代表的已批准能力出现可测瓶颈前不启动；不进入主链 |

因此 OQ-01 的唯一答案是：`R0=W00–W09`；`R1/R2=消费 R0 内核并分别等待新 amendment`；旧 M 只能按上表吸收或冻结，不能与 W 图并存。这个关闭不授权 R1/R2，也不把冻结项视为完成。

## 6. 22 条 R0 REQ 唯一映射

| REQ | 唯一实现包 | Canonical owner | 必须先出现的 RED | 主要退出证据 |
| --- | --- | --- | --- | --- |
| 001 | W03 | Secure Ingest | DOCX/搜索 PDF/扫描 PDF 任一被假成功 | 格式矩阵、真实 MIME、页数/加密/损坏状态 |
| 002 | W03 | Security & Data | 宏/病毒/zip bomb/注入/低 OCR 未阻断 | 攻击 fixture 全 fail closed |
| 003 | W02 | Support Contract | 缺法域/语言/类型/角色仍输出放行 | 支持/拒答 schema 与 fixture |
| 004 | W02 | MissionContract | 目标/约束/禁止动作/成果字段可缺 | Pydantic/OpenAPI/TS 契约一致 |
| 005 | W02 | Mission Confirmation | 旧版本或错误 digest 可确认 | version+digest 绑定、409 冲突 |
| 006 | W02 | Capability Contract | 非硬需求能力仍被激活 | 最小覆盖与拒答 fixture |
| 007 | W02 | Capability Security | 未激活能力仍获正文/token/tool | 权限为零的负例 |
| 008 | W04 | DecisionTask Kernel | 创建第二 Mission/任务事实源 | canonical chain DB 断言 |
| 009 | W05 | ContractRiskItem | 风险无版本/页码/条款/原文仍通过 | 100% 原文锚点门 |
| 010 | W05 | Evidence Gate | 非空 URL/文本/模型自述自行晋升 | 对抗 fixture 全阻断 |
| 011 | W05 | Evidence Status | 缺失/过期/冲突在跨端显示不一致 | API/UI/export 契约测试 |
| 012 | W02 | Decision Contract | 第六种裁决或“可签”文案出现 | 五枚举跨端一致 |
| 013 | W04 | Menxia Gate | 最大轮次后仍自动准奏 | fail-closed 状态转移测试 |
| 014 | W04 | FinalMemorial Writer | 多份/被替代/未过门奏折可裁决 | unique+lineage+quality DB 断言 |
| 015 | W06 | Artifact Service | 任一必需格式/Manifest 缺失却交付 | 三格式可打开、hash 可复算 |
| 016 | W06 | Artifact Readiness Input | 附件失败仍被报告为 READY | PARTIAL、局部重试、不重跑分析；向 W04 完成公式提供只读输入 |
| 017 | W02 | Status Contract | 一个状态字段承载多个正交语义 | schema 与投影负例 |
| 018 | W04 | Execution Runtime | 超时/断线/取消/查单无终态 | 故障注入与恢复证据 |
| 019 | W03 | Authorization | tenant/user/object/purpose 任一缺失仍放行 | 越权矩阵、短时下载、审计 |
| 020 | W04 | Trace Identity | 任一链路丢 request/task/tenant/release/model | 全链 trace 断言 |
| 021 | W07 | Frontend Read Model | 浏览器自行推导 LIVE/完成 | real backend E2E、刷新同态 |
| 022 | W04 | Server Delivery Formula | ACK/direct/部分文本被标交付 | accepted/queued/running/delivered 反例 |

## 7. R0 退出门反向映射

REQ 映射证明能力归属；下表从 PRD §8.1 反向证明“由谁量、用什么证据决定 Go”。W09 只能消费这些门，不得自行把缺失指标解释为通过。

| Gate | 唯一度量包 | 冻结门槛 | 必须先出现的 RED | 退出证据 |
| --- | --- | --- | --- | --- |
| G01 | W08 | 30+ 合成/不可重新识别黄金合同，采购/销售/服务覆盖 | 数量/合同族/合法性任一不足仍 PASS | versioned dataset manifest、双人标注与仲裁 |
| G02 | W08 | 10/10 real-backend 浏览器主流程可终止且同 lineage 归档可回读 | mock、任一旅程无终态或跳过 archive readback 仍 PASS | browser traces、API/DB lineage、ArchiveReceipt/readback、console/404=0 |
| G03 | W08 | 5 名非开发目标用户中至少 4 名无帮助完成 | 开发人员代操作仍计成功 | 受控 usability protocol 与逐人结果 |
| G04 | W08 | G02 同一 10 条旅程中，上传确认到首条有原文锚点 critical/high 风险可见的时间中位数 ≤ 3 分钟 | 少于 10 条、无计时、无有用风险或分母为零仍 PASS | server timestamps、10 条样本明细、未产出按 FAIL 计、median 复算 |
| G05 | W08 | critical/high 原文引用覆盖率 100%，对冻结 golden 真值的缺证显式标记率 100% | 无锚点、golden 未标 expectedMissingEvidence 或漏标仍 PASS | scorer 明细、expectedMissingEvidence 标注与原文定位抽检 |
| G06 | W08 | critical recall 100%，high recall ≥90%，critical/high precision ≥80% | 分母为零/holdout 未冻仍 PASS | versioned scorer、冻结 holdout、匹配审计 |
| G07 | W08 | 伪条款、伪来源、错完成、未授权动作、跨租户泄露均为 0 | 任一零容忍事件被平均分掩盖 | adversarial suite 与 incident ledger |
| G08 | W08 | 断线、取消、冲突、过期、附件失败、UNKNOWN 均不显示完成 | 任一失败被投影为 completed | fault-injection traces 与刷新/重连 E2E |
| G09 | W09 | exact integration HEAD、required checks、独立 review、回滚说明齐全 | 任一身份/证据缺失仍 Go | release evidence、hosted checks、N-1 演练 |

## 8. Packet 施工卡

### R0-W00：G0 托管合入

- 前置：`origin/task/r0-execution-authority-20260720@bf99f609`。
- 授权来源：用户已明确批准本次 G0 治理实施；不来自本修正案，也不授权产品 runtime。
- 完成：目标分支必须是 `feature-chaotang-ext`；hosted required check 和非提交者复核可验证；合入后重跑 authority 与三层 doctor。
- 阻断：平台门未配置时状态只能 `PASS_LOCAL / NOT_ENFORCED`。
- 回滚：整包 guard-preserving revert；不得通过删除 guard 恢复施工。

### R0-W01：修正案与 v2 执行权威

- 前置：W00 已合入，记录新 EXT exact SHA。
- 产物：本修正案 exact digest、具名 Owner、批准证据、execution-authority v2 schema/manifest/resolver/tests。
- v2 最小语义：一个 amendment、一个 `activeWorkPackage`、一个 effective base、一个 approval evidence；未知字段、SHA 漂移、依赖未完成或 review 非 GO 均 STOP。
- RED：批准摘要/基线/包 ID 任一不匹配；同时激活两个包；试图从旧 P/PKT/S 领取任务。
- 回滚：撤销 v2 activation 后恢复 STOP，不回退到无 guard。

### R0-W02：共享合同契约

- 前置：W01 已 `MERGED_AND_VERIFIED`；OQ-03 已冻结；OQ-09 至少确认 PDF/DOCX/JSON 是 R0 基础成果。
- RED：unknown enum、缺法域/角色、旧确认版本、状态语义重载、未激活能力获权必须失败。
- 产物：`MissionContractV1`、`ContractSupportDecisionV1`、`ContractDecisionV1`、正交状态与 lineage 契约；后端 Pydantic/OpenAPI 为事实源，前端生成或契约验证。
- 范围：采购/销售/服务、中国大陆、中文、我方角色、五种裁决；未知/超范围 fail closed。
- 迁移：先 versioned additive schema + 兼容读；新合同路径禁止写旧无版本结构。
- 回滚：关闭 contract slice 新写，保留兼容读和审计。

### R0-W03：安全摄取与租户隔离

- 前置：W02 已 `MERGED_AND_VERIFIED`；OQ-02 已冻结。
- RED：跨租户/用户、对象替换、purpose 缺失、伪 MIME、恶意文件、低 OCR、内部运营默认读取正文、未在 allowlist/provider policy 内的模型出站必须全部失败。
- 产物：对象级 secure ingest、MIME/加密/损坏/宏/病毒/zip bomb/注入检查、OCR 状态、immutable input version/digest、purpose authz、短时下载票据；内部运营和平台人员默认不可读取合同正文；模型 provider 必须 allowlist、绑定区域/retention/no-training/subprocessor 声明并逐次记录 tenant/task/input digest/provider/model/policy version，未知或降级 provider 禁止获得正文。
- 首刀只支持合成采购 DOCX；随后在同一 schema 扩搜索 PDF、扫描 PDF/OCR。
- 禁止：合同正文进入全局 IMA/shared RAG、localStorage、日志、trace 或截图。
- 回滚：feature flag 关闭摄取；保持 fail closed，绝不回退到 IMA。

### R0-W04：canonical 完成与恢复

- 前置：W02 已 `MERGED_AND_VERIFIED`；与 W03 并行时不得共享迁移、writer 或状态事实源。
- 产物：`CANON-IDEMPOTENCY-01` runtime、CourtReview single writer、服务端 `DELIVERED` 公式、取消 fencing、局部重试、UNKNOWN 查单、全链 identity，以及每任务确定性的 wall-clock/token/tool-call/retry 硬上限。
- 首个 RED：`direct_completed`/worker ACK/部分文本/部分附件不得显示完成；任一硬上限超出时必须进入明确终态或人工接管，不得继续执行、静默重试或显示完成。
- 历史 source-only：只复用 `wip/canon-court-01a-red` scanner 思想，不整支合并。
- 回滚：所有新写入记录 `delivery_formula_version`；关闭新 writer/投影后，新公式期间写入的行继续按原版本派生或进入 `UNDER_REVIEW` 隔离，禁止用旧公式重新解释为完成；兼容读保留，禁止恢复伪完成写入。

### R0-W05：证据与合同成果内容

- 前置：W03/W04 已 `MERGED_AND_VERIFIED`。
- RED：非空 URL/文本/模型自述晋升、无页码原文、冲突/过期不显示、超范围未升级律师必须失败。
- 产物：`EvidencePacketV1`、`ContractRiskItemV1`、`ContractReviewPackV1`、最小刑部合同能力接线。
- 每项风险：file version、page/clause、raw excerpt、riskLevel、explanation、missingEvidence、recommendedRevision、sourceLabel、engineTier。
- 未激活能力：正文、附件、token、工具权限均为零。
- 回滚：关闭合同分析 flag，保留原始输入、候选和审计。

### R0-W06：成果附件与交付

- 前置：W05 已 `MERGED_AND_VERIFIED`；OQ-09 已冻结；W06 引入的新 `delivery_formula_version` 必须由 Canonical Runtime Owner 会签，并在 W06 exact HEAD 重新运行 W04/REQ-022 全部反例。
- RED：必需附件失败却 READY、hash 不一致、过期/越权下载、附件重试复制奏折必须失败。
- 产物：PDF、DOCX、JSON、`ArtifactManifestV1`、hash/version/authz/expiry、独立附件状态和局部重试。
- 公式：必需附件全部 READY 且授权用户可取回前不得 `DELIVERED`。
- 回滚：保留 `FinalMemorial`；停止新产物生成；已有问题产物标 `UNAVAILABLE/UNDER_REVIEW`。

### R0-W07：一旨一卡一包前端

- 前置：W06 已 `MERGED_AND_VERIFIED`；只消费服务端 read model。
- RED：浏览器本地推导 LIVE/完成、旧奏折裁决、无 ArchiveReceipt 显示归档必须失败。
- 在现有 `/shangshufang` 内新增 feature-flagged contract slice，不大重构 5k 行页面。
- 一卡仅三个动作：确认办理、修改计划、取消。
- 裁决必须绑定 `task_id + final_memorial_id + content_hash + version`；由服务端 `allowed_actions` 决定按钮。
- 只有真实 `ArchiveReceipt` 才显示已归档；同一 lineage 必须可从任务内或 `/shiguan` 只读下钻重新打开，G02 不得把 readback 当可选；文案明确裁决不授权签约、付款或发送。
- 回滚：关闭 contract slice，回到只读入口；不得恢复 mock success。

### R0-W08：质量与用户验证

- 前置：W02 后可建立 fixture/scorer 骨架；正式判门必须等待 W03–W07 `MERGED_AND_VERIFIED`。
- RED：任一门分母为零、数据集/模型版本漂移、零容忍事件非零或 mock 冒充 real E2E 必须 `NO_DATA/FAIL`。
- 30+ 合成/不可重新识别合同，覆盖采购/销售/服务；双人标注，分歧第三人裁决；模板族隔离 holdout；标注 schema 必须包含 expected risk、原文锚点与 `expectedMissingEvidence` 真值。
- scorer 分母为零、标签未裁决或版本不匹配时必须 `NO_DATA`。
- 门：G02 同一 10 条 real-backend 旅程的首个有用风险时间中位数 ≤3 分钟；critical recall 100%，high recall ≥90%，critical/high precision ≥80%，原文引用覆盖 100%，对 golden 真值的缺证显式标记率 100%，伪条款/伪来源/错完成/越权/跨租户/未授权 provider 出站均为 0。
- 浏览器：10/10 real backend 旅程可终止；mock 只作开发反馈。
- 用户：5 名未参与开发的目标用户中至少 4 名无工程师帮助完成。

### R0-W09：发布身份与 Go/No-Go

- 前置：W08 的 G01–G08 全部由可复算证据 PASS；任一 `NO_DATA` 都阻断。
- RED：foreign port、缺 build/digest、JWT/runtime identity、schema mismatch、N-1 恢复失败或 G01–G08 任一未通过必须 STOP。
- 产物：immutable build、release SHA/digest/schema/runtime identity、required checks、独立 review、N-1 回滚演练、prod doctor 全绿。
- Go 仅代表 R0 内部可信内核；不接真实可重新识别客户合同，不进入公众自助。
- 任一 release P0/P1、foreign port、JWT identity、schema/digest、回滚证据或“首个有用风险中位数 ≤3 分钟”等 G01–G08 不一致即 No-Go。

## 9. 明确冻结与 source-only

R0 前冻结：41 司全量、每日朝会、皇帝单屏、evolve、六项外部能力全收编、部门大重构、resource census、世界杯/金融第二 Offer、公众自助、支付、LangGraph 主链接入、真实客户材料、M3 通用 adaptive/shadow routing、M4 通用 Agent lazy-load/budget 平台。R0 只实现 W02 的最小能力授权和 W04 的确定性时间/token/工具/重试硬上限，不宣称完成 M3/M4。

只允许选择性重包：

- `integration/ext-court-loop-contracts-20260719`：校真闸和对抗测试思想；
- `task/backend-runtime-wiring-r1`：只取合同最小 registry/projection/adapter 思想；
- `wip/canon-court-01a-red*`：single-writer scanner 思想；
- 本地旧 EXT、governance WIP、resource census：只读素材。

禁止整支 merge/cherry-pick；所有代码必须在最新 EXT 上以新的 RED 和新证据重制。

## 10. 批准与生效协议

本修正案只有同时满足以下条件才可从 `PROPOSED` 变为 `APPROVED_FOR_W01`：

1. G0 已由 hosted PR 合入 `feature-chaotang-ext`，并记录新的 exact integration SHA。
2. 本文件在该 SHA 之上完成 rebase/re-pin；唯一绑定命令为 `git diff --binary <B>..<H> | sha256sum`，不得加入 `--full-index` 或改变 diff 规范化参数。
3. Product Owner 明确回复：Amendment ID、digest、effective base、批准 W01、明确未批准 W02–W09 runtime。
4. Authority、Security、Git/Evidence 三路 Claude Code 审查绑定同一 amendment H/tree/diff。
5. `node scripts/r0-amendment-check.mjs`、其 Node 测试、root doctor 与文档链接全绿；checker 只读 canonical amendment 路径，输出的 `sourceDigest` 必须等于该文件精确字节的 SHA-256，并与同一 H 的审查证据一起记录。

条件按 1 → 2 → 4 → 5 → 3 顺序执行；三路 review 必须发生在 rebase/re-pin 后，Product Owner 最后批准同一 exact H/tree/diff/digest。OQ-01 必须由本修正案关闭；OQ-02/03/09/10 按 §5 的 Packet 前置逐项关闭，不能被 W01 批准提前豁免。

W01 合入 v2 后，Product Owner 再按 v2 激活的 `activeWorkPackage` 逐包放行。任何笼统的“全部同意”“继续”“立刻做”只表达方向，不替代对未来 exact digest/base 的批准证据。

## 11. 给 Codex 的执行指令

```text
目标：按 R0-TRUSTED-KERNEL-AMENDMENT-01 交付 R0 内部可信合同内核。

硬约束：
1. 每次先运行 execution-authority --authorize；只有 `decision === GO` 且 activeWorkPackage 与计划领取包完全一致才可继续；`decision != GO`、字段缺失或包不一致立即 STOP。
2. 只从最新受保护 origin/feature-chaotang-ext exact SHA 开分支。
3. 一次只做一个 Packet；先 RED，再最小 GREEN，再专项/回归/doctor。
4. 后端 Pydantic/OpenAPI 是跨端契约事实源；前端不得新增 BFF 或第二状态机。
5. 不整支合并历史 WIP；只能按当前代码重新实现经过证明的最小思想。
6. 不碰 /dadian，不扩 41 司，不接真实客户合同，不做现实副作用。
7. ACK、Direct、部分文本、部分附件、最大轮次均不得推出完成。
8. 证据、权限、lineage、artifact、release identity 任一未知即 fail closed。
9. Claude Code 只读复审；Codex 是唯一写入者。
10. 任一 HIGH/MEDIUM 未关闭、required check 不可验证或 exact HEAD 漂移，STOP。

执行顺序：W00 → W01 → W02 → (W03, W04) → W05 → W06 → W07 → W08 → W09。
完成声明：只能使用 PACKET_VERIFIED、R0_INTERNAL_GO 或 NO_GO；不得称 R1、R2、GA、生产上线。
```
