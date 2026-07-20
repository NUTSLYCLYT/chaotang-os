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
| G0 inactive authority | 本地 exact-HEAD 已验证并推送；Gitee PR/required check/merge 未完成 | 仍为 `NOT_ENFORCED` |
| v1 `--authorize` | 固定 `STOP / AMENDMENT_APPROVAL_REQUIRED` | 只能编制修正案，不能做 runtime |
| 产品 SSOT / R0 PRD | 已冻结；22 条 R0 REQ 完整 | 产品范围明确 |
| Direct 完成语义 | `direct_completed` 仍会被投影为 completed/report-ready | stop-ship：伪完成 |
| 幂等 runtime | 规格存在，运行实现缺失 | 重复任务/重试风险 |
| 合同摄取 | DOCX/PDF/OCR 安全流水线不存在；现有 IMA 是全局路径 | stop-ship：敏感数据和跨租户风险 |
| 合同核心协议 | `MissionContract`、`ContractReviewPack`、`ArtifactManifest` 仅存在于文档 | 无法形成正式产品闭环 |
| 前端 core | 只读审计复跑 53/70，17 失败 | 不得宣称前端 release-ready |
| evaluator / flows | 4/4 evaluator 失败；flow validation 3 errors | 不得宣称质量闭环 |
| golden contracts | 30+ 集合与版本化 scorer 不存在 | 质量状态必须 `NO_DATA` |
| prod doctor | STOP，2/5 通过 | 不得部署或宣传上线 |

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

| 顺序 | ID | 目标 | 主责 REQ | 旧 M 映射 | 退出价值 |
| ---: | --- | --- | --- | --- | --- |
| 0 | R0-W00 | G0 hosted PR、required review、合后重验 | 治理前置 | G0 | 只有一条施工权威 |
| 1 | R0-W01 | 批准本修正案并建立 packet-scoped v2 authority | 追踪全部 REQ，不实现业务 | M0 | 每次只放行一个包 |
| 2 | R0-W02 | 合同、Mission、裁决、状态的共享 v1 契约 | 003–007、012、017 | M0/M1/M2 | 前后端说同一种语言 |
| 3 | R0-W03 | 安全文件摄取、OCR、tenant/object/purpose 权限 | 001、002、019 | M1/M2 | 客户材料不泄露、不静默漏读 |
| 4 | R0-W04 | idempotency、single writer、完成公式、恢复与全链 ID | 008、013、014、018、020、022 | M1/M3/M4/M6/M7 | 不重复、不伪完成、可恢复 |
| 5 | R0-W05 | 原文证据、五种裁决、最小刑部合同能力 | 009–011 | M5/M6；M8 仅最小合同能力 | 结果可复核、该拒答就拒答 |
| 6 | R0-W06 | PDF/DOCX/JSON、ArtifactManifest、下载与 PARTIAL | 015、016 | M7 | 从分析文本变成可验证成果 |
| 7 | R0-W07 | `/shangshufang` 一旨一卡一包真实闭环 | 021 | M7 前端消费者 | 普通用户能独立使用 |
| 8 | R0-W08 | 30+ goldens、scorer、10/10 real E2E、5 人测试 | 消费 001–022 | M0/M5/M6/M9 | 证明质量而非演示质量 |
| 9 | R0-W09 | immutable build、runtime identity、N-1 回滚 | release gate | M9 | 可判定的 R0 Go/No-Go |

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
| 016 | W06 | Delivery Formula | 附件失败仍 `DELIVERED` | PARTIAL、局部重试、不重跑分析 |
| 017 | W02 | Status Contract | 一个状态字段承载多个正交语义 | schema 与投影负例 |
| 018 | W04 | Execution Runtime | 超时/断线/取消/查单无终态 | 故障注入与恢复证据 |
| 019 | W03 | Authorization | tenant/user/object/purpose 任一缺失仍放行 | 越权矩阵、短时下载、审计 |
| 020 | W04 | Trace Identity | 任一链路丢 request/task/tenant/release/model | 全链 trace 断言 |
| 021 | W07 | Frontend Read Model | 浏览器自行推导 LIVE/完成 | real backend E2E、刷新同态 |
| 022 | W04 | Delivery Formula | ACK/direct/部分文本被标交付 | accepted/queued/running/delivered 反例 |

## 7. Packet 施工卡

### R0-W00：G0 托管合入

- 前置：`origin/task/r0-execution-authority-20260720@bf99f609`。
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

- 产物：`MissionContractV1`、`ContractSupportDecisionV1`、`ContractDecisionV1`、正交状态与 lineage 契约；后端 Pydantic/OpenAPI 为事实源，前端生成或契约验证。
- 范围：采购/销售/服务、中国大陆、中文、我方角色、五种裁决；未知/超范围 fail closed。
- 迁移：先 versioned additive schema + 兼容读；新合同路径禁止写旧无版本结构。
- 回滚：关闭 contract slice 新写，保留兼容读和审计。

### R0-W03：安全摄取与租户隔离

- 产物：对象级 secure ingest、MIME/加密/损坏/宏/病毒/zip bomb/注入检查、OCR 状态、immutable input version/digest、purpose authz、短时下载票据、删除传播。
- 首刀只支持合成采购 DOCX；随后在同一 schema 扩搜索 PDF、扫描 PDF/OCR。
- 禁止：合同正文进入全局 IMA/shared RAG、localStorage、日志、trace 或截图。
- 回滚：feature flag 关闭摄取；保持 fail closed，绝不回退到 IMA。

### R0-W04：canonical 完成与恢复

- 产物：`CANON-IDEMPOTENCY-01` runtime、CourtReview single writer、服务端 `DELIVERED` 公式、取消 fencing、局部重试、UNKNOWN 查单、全链 identity。
- 首个 RED：`direct_completed`/worker ACK/部分文本/部分附件不得显示完成。
- 历史 source-only：只复用 `wip/canon-court-01a-red` scanner 思想，不整支合并。
- 回滚：关闭新 writer/状态投影；兼容读保留；禁止恢复伪完成写入。

### R0-W05：证据与合同成果内容

- 产物：`EvidencePacketV1`、`ContractRiskItemV1`、`ContractReviewPackV1`、最小刑部合同能力接线。
- 每项风险：file version、page/clause、raw excerpt、riskLevel、explanation、missingEvidence、recommendedRevision、sourceLabel、engineTier。
- 未激活能力：正文、附件、token、工具权限均为零。
- 回滚：关闭合同分析 flag，保留原始输入、候选和审计。

### R0-W06：成果附件与交付

- 产物：PDF、DOCX、JSON、`ArtifactManifestV1`、hash/version/authz/expiry、独立附件状态和局部重试。
- 公式：必需附件全部 READY 且授权用户可取回前不得 `DELIVERED`。
- 回滚：保留 `FinalMemorial`；停止新产物生成；已有问题产物标 `UNAVAILABLE/UNDER_REVIEW`。

### R0-W07：一旨一卡一包前端

- 在现有 `/shangshufang` 内新增 feature-flagged contract slice，不大重构 5k 行页面。
- 一卡仅三个动作：确认办理、修改计划、取消。
- 裁决必须绑定 `task_id + final_memorial_id + content_hash + version`；由服务端 `allowed_actions` 决定按钮。
- 只有真实 `ArchiveReceipt` 才显示已归档；文案明确裁决不授权签约、付款或发送。
- 回滚：关闭 contract slice，回到只读入口；不得恢复 mock success。

### R0-W08：质量与用户验证

- 30+ 合成/不可重新识别合同，覆盖采购/销售/服务；双人标注，分歧第三人裁决；模板族隔离 holdout。
- scorer 分母为零、标签未裁决或版本不匹配时必须 `NO_DATA`。
- 门：critical recall 100%，high recall ≥90%，critical/high precision ≥80%，原文引用覆盖 100%，伪条款/伪来源/错完成/越权/跨租户均为 0。
- 浏览器：10/10 real backend 旅程可终止；mock 只作开发反馈。
- 用户：5 名未参与开发的目标用户中至少 4 名无工程师帮助完成。

### R0-W09：发布身份与 Go/No-Go

- 产物：immutable build、release SHA/digest/schema/runtime identity、required checks、独立 review、N-1 回滚演练、prod doctor 全绿。
- Go 仅代表 R0 内部可信内核；不接真实可重新识别客户合同，不进入公众自助。
- 任一 release P0/P1、foreign port、JWT identity、schema/digest 或回滚证据不一致即 No-Go。

## 8. 明确冻结与 source-only

R0 前冻结：41 司全量、每日朝会、皇帝单屏、evolve、六项外部能力全收编、部门大重构、resource census、世界杯/金融第二 Offer、公众自助、支付、LangGraph 主链接入、真实客户材料。

只允许选择性重包：

- `integration/ext-court-loop-contracts-20260719`：校真闸和对抗测试思想；
- `task/backend-runtime-wiring-r1`：只取合同最小 registry/projection/adapter 思想；
- `wip/canon-court-01a-red*`：single-writer scanner 思想；
- 本地旧 EXT、governance WIP、resource census：只读素材。

禁止整支 merge/cherry-pick；所有代码必须在最新 EXT 上以新的 RED 和新证据重制。

## 9. 批准与生效协议

本修正案只有同时满足以下条件才可从 `PROPOSED` 变为 `APPROVED_FOR_W01`：

1. G0 已由 hosted PR 合入 `feature-chaotang-ext`，并记录新的 exact integration SHA。
2. 本文件在该 SHA 之上完成 rebase/re-pin，计算 exact SHA-256。
3. Product Owner 明确回复：Amendment ID、digest、effective base、批准 W01、明确未批准 W02–W09 runtime。
4. Authority、Security、Git/Evidence 三路 Claude Code 审查绑定同一 amendment H/tree/diff。
5. root doctor、文档链接、22/22 映射 validator 全绿。

W01 合入 v2 后，Product Owner 再按 v2 激活的 `activeWorkPackage` 逐包放行。任何笼统的“全部同意”“继续”“立刻做”只表达方向，不替代对未来 exact digest/base 的批准证据。

## 10. 给 Codex 的执行指令

```text
目标：按 R0-TRUSTED-KERNEL-AMENDMENT-01 交付 R0 内部可信合同内核。

硬约束：
1. 每次先运行 execution-authority --authorize；只领取输出中的 activeWorkPackage。
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
