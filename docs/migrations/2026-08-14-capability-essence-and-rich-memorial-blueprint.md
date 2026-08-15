# ext-dev 能力精华、价值与融合蓝图

> 状态：`GOVERNANCE_BLUEPRINT_ONLY / EXECUTION_STOP`
>
> 证据快照：`ext-dev@ae64421053ff74a9368c2d704d1c74b94e1bb7e8`；旧 EXT 精华只读来源为固定提交
> `939186f0331d9784bc8c4ceee393aeb197230ed0`。旧来源中的运行状态、文件计数和验收结论都是历史证据，
> 不是当前产品事实。
>
> 执行边界：根 `execution-authority.v1` 当前且按设计返回
> `STOP / AMENDMENT_APPROVAL_REQUIRED`。本文只做能力提炼、价值评估和后续准入设计，不能授权产品施工、
> 生产晋级、外部副作用或历史数据迁移。
>
> 本轮允许路径仅为本文；不修改当前 Blocked 产品任务、施工蓝图、ADR、Harness 或任何前后端运行文件。

## 一、真正应该保留的精华

### 1. 可信运行与统一权威

保留 ext-dev 当前 46 个 RuntimeSkill（39 司、6 部、1 军机处）作为唯一权威运行注册表。它们当前仍是诚实降级的能力骨架，未获生产晋级，也没有 22 个能力族的业务成功证明。EXT、专业 Overlay、独立产品和历史知识库只能提供方法、算法、证据或评测，不能重新建立 Flow、Prompt、前端状态或侧车注册表来授予权限。

价值：防止同一任务由多套系统给出互相冲突的路由、权限和完成状态。

### 2. 专业确定性内核

优先吸收不能只靠语言模型保证的部分：

- PACK sizing、成本校验、跨模块一致性；
- 电池 P0/P1 物理安全门（旧线仅证明产生强制人签信号，新线还须补真实审批阻断）；
- 户部数字来源、勾稽、付款三闸；
- 刑部合同红线、法条依据和真值等级；
- 钦天监预测证伪、正式结算和反时间泄漏；
- 史馆 append-only outcome 与失败回填。

价值：把“模型建议”变成“模型负责解释、规则负责守底线”。

### 3. 专业工作流方法

保留各专业系统中已经经过实践的工作节奏：

- Battery R&D OS 的项目、样品、实验、失效、阶段门；
- Legal Agent 的独立意见、红蓝对抗和证据清单；
- 礼部影像台的分镜锁锚、候选选择、pHash、装配和终检；
- 采情牒的需求驱动采集、核查、无料诚实和使用回执；
- 专业会计的关账、管理复盘和扩张决策纵切；
- Companion 的 idempotency、delivery fencing 和候选记忆不自晋级。

价值：这些是“怎样把事情办完”的程序知识，比复制角色人设更有价值。

### 4. 证据、成果与结果闭环

统一采用：

```text
服务端身份/旨意
  → owner-scoped Evidence Spine
  → RuntimeSkill / deterministic gate
  → WorkProduct preview
  → Shiguan 自动归档唯一 REPLY
  → 本地受控成果可下载 / 独立 human confirmation
  → authenticated outcome settlement
  → Hanlin offline eval / promotion proposal
  → shadow / human approval / versioned promotion
```

这里有四条正交状态轴，不能互相冒充：

1. `REPLY` 是否已自动归档；
2. 本地受控成果是否可下载；
3. WorkProduct 是否获得人工确认；
4. 是否拥有外部行动授权。

价值：每项结论可以回答“依据什么、谁批准、生成了什么、当时怎样判断、后来结果怎样”；同时避免把
“文件已生成”“史馆已归档”误写成“用户已确认”或“现实动作已执行”。

### 5. 天道治理精华

天道不是第 11 个 Agent，而是统一控制面：

- `G`：准入、复杂度和产物门；
- `G1`：只读 shadow，对照但不影响用户结果；
- `E`：外部行动合同。当前继续禁用真实执行，只保留 Candidate→Risk→Approval→Mandate→Adapter→Receipt 的不可伪造设计和负向测试。

价值：允许系统学习和试验，同时不让候选能力、模型或 Prompt 自我晋级、自我授权。

## 二、不要吸收的内容及原因

| 内容 | 原因 | 处理 |
| --- | --- | --- |
| 旧 FlowEngine、双 registry、旧 API | 会形成第二运行时，且存在静默 fallback | 退役，只提取算法和案例 |
| 重复 Agent/Skill/Prompt | 同能力多份复制，版本和权限会漂移 | 按 digest 去重，蒸馏为一项能力 |
| 前端 CourtOS 第二大脑 | 前端不能成为路由、决策和账本权威 | 只吸收只读 view-model |
| CourtOS-Brain 全库 | 大量 stub、个人材料、CoT、日志、vendor 和备份 | 严格白名单；最新 492-file vault 另做增量审计 |
| 历史真实 BOM、报价、案件、运行日志 | 来源、许可、时效、隐私和真实性未完成证明 | 隔离，不进入 RAG/史馆/训练集 |
| Hermes/OpenClaw 自进化控制面 | 广泛 shell/network/memory 权限，和项目治理冲突 | 仅参考工程模式 |
| certification/release 输出 | 是旧环境证据，不是 ext-dev 当前成功证明 | 只保留索引，当前版本重跑 |

## 三、整合架构

### 联邦专业系统，不做“大仓吞并”

```text
Battery R&D OS     Legal Agent     Libu Studio     Intel
      │                 │               │            │
      └──── owner-scoped read-only evidence/work-product adapters ────┘
                                      │
                              Evidence Spine
                                      │
               deterministic domain kernels + safety gates
                                      │
                        46 RuntimeSkills（唯一 registry）
                                      │
                        Tiandao G / G1（E disabled）
                                      │
                   WorkProduct → Confirm → Shiguan → Outcome
```

专业系统继续拥有专业事实和工具；朝堂拥有身份、路由、跨部会审、权限、证据绑定、成果确认和归档。这样既保留深度，又不产生第四条主线。

### 融合优先级

1. `P1`：电池安全黑门、PACK 确定性内核、Battery R&D OS 只读证据接口、修复 PACK 资产漏分。
2. `P2`：刑部确定性法律核、史馆 outcome、时间化决策结算、天道 G/G1、专业会计纵切。
3. `P3`：法律/影像/情报侧车适配、前端只读投影、安全摄入负测和设计系统参考。

## 四、上书房现在是怎样工作的

当前 `/study` 链路是：

1. 用户输入最多 2000 字的旨意；可先“拟旨”，再由用户主动“下旨”。
2. 同源 BFF 转发到后端；owner 从登录会话取得，不接受浏览器指定。
3. 丞相先判断 single/multi 路由；司级、部级、必要时军机处依次生成结构化意见。
4. 回奏严格包含：丞相判断、流转路径、各司意见、各部部议、可选军机处结论、丞相总结、恰好三项建议。
5. 成功旨意按 ADR 0028 自动归档且最多归档一条史馆 `REPLY`，保留原旨、参与部门、办理过程、结论、
   时间、责任主体和被明确采纳的证据快照；归档不等待成果确认。
6. 当前唯一完整成果附件类型是会计管理报告 XLSX。`ArtifactState.PUBLISHED` 只表示归档后本地受控下载
   可用；WorkProduct 在 receipt 前仍是 `PENDING`，二者都不授予付款、过账、通知或对外发布权限。
7. 每日奏折是 39 司→6 部→丞相的受控事实汇总；用户确认后归档为 `MEMORIAL`。
8. 当前史馆 `ReviewStatus` 是单条可变复盘状态，不是 append-only outcome ledger；不得把它计作真实业务
   结果闭环或用它训练/晋级 RuntimeSkill。

当前视觉上使用卷轴、背景图和分层排版，但业务内容仍是文字。页面的“上传附件”目前只记录本地文件名，并明确提示提交接口不会上传。

## 五、图文并茂能否实现

能，而且不需要改变 46 个 RuntimeSkill 注册表。需要新增的是一个受控的 `RichMemorial WorkProduct` 投影与渲染合同。

### 富奏折块模型

每份奏折/回奏由有序 block 组成，只允许固定类型：

- `heading` / `paragraph`：正文；
- `fact_callout`：关键事实与引用；
- `metric` / `table`：指标和表格；
- `chart`：从受信数据确定性生成的图表规范；
- `evidence_image`：原始证据图，保留 hash、来源、时间和许可；
- `illustration`：生成或设计图片，必须显著标记“示意图，不作为证据”；
- `risk` / `conflict` / `missing_evidence`：风险、冲突和缺证；
- `decision` / `next_action`：裁决与下一步；
- `artifact_link`：XLSX、PDF、DOCX 或受控媒体成果。

禁止模型直接返回任意 HTML、脚本、外链图片或本地路径。每个 block 均需 `block_id/type/content_digest/source_refs/sensitivity/caption/alt_text/renderer_version`；图片还需 `media_digest/mime/license/generated_or_evidence`。

### 三种“图”必须分开

1. **证据图**：附件原图或调查截图，不得美化篡改，必须可回溯。
2. **分析图**：由受信数值生成的图表，图表规范和数据摘要均需绑定 digest。
3. **示意图**：由礼部或图像模型生成，只用于解释和审美，永远不能支撑事实结论。

### 需要的产品能力

| 能力 | 复用/新增方式 |
| --- | --- |
| 事实与引用 | 复用锦衣卫 + Evidence Spine |
| 内容结构与文案 | 复用礼部 `analyze-content-quality`、品牌/公关方法 |
| 数字和图表 | 复用户部技能；新增确定性 `ChartSpecCompiler`，模型只建议图型 |
| 技术示意与交付物 | 复用工部产品/技术/质量方法与 WorkProduct |
| 附件摄入 | 吸收 secure-ingest 的 MIME、大小、压缩炸弹、OOXML、hash 和 owner 隔离负测 |
| 图片生产 | 礼部影像工作台作为独立侧车；只接预览成果，不授予自动发布权限 |
| 人工确认 | 复用 WorkProduct/ConfirmationReceipt |
| 归档与召回 | 扩展史馆保存富奏折 manifest 与不可变媒体引用，不复制媒体正文 |
| 前端呈现 | 新增 closed block renderer、图表 renderer、图片灯箱、引用与无障碍 alt text |

本表描述远期能力全集。当前获准设计的最小纵切只覆盖 `metric/table/chart`，不覆盖附件摄入、证据图、
示意图或影像侧车；媒体能力必须等待独立安全任务、精确允许路径和新机器权威。

### 开发时使用的工程 Skills

- `codebase-design`：冻结富奏折深模块接口、事实源和稳定错误；
- `frontend-design`：卷轴内的图表、图像、层级和移动端体验；
- `security-review`：上传、媒体、外链、XSS、SSRF、租户/owner 边界；
- `test-driven-development`：先写 block parser、附件攻击、证据/示意混淆和跨 owner 失败测试；
- `playwright`：验证下旨→回奏→图表/图片→确认→史馆召回的真实浏览器链；
- `verification-loop`：冻结候选、命令矩阵、完整轮次与验收证据；
- `imagegen`：仅用于生成示意图和设计资产，不生成事实证据。

## 六、推荐的图文上书房实施顺序

1. 先获得独立 successor authority：精确任务 ID、基线提交、允许路径、外部签名、required check 和
   fail-closed CLI 缺一不可。
2. 定义 closed `RichMemorialEnvelope v1` 与 text-only 向后兼容；冻结跨语言 canonical digest vectors。
3. 只实现户部 `metric/table/chart` 确定性投影；模型文本不得生成或修改数字事实。
4. 史馆随唯一 `REPLY` 保存可重放 rich manifest 快照；rich 失败时丢弃全部富块，以同一幂等键降级为
   text-only `REPLY`，不能重试出第二条档案。
5. 保持成果可下载、人工确认、自动归档和外部授权四轴分离；只用脱敏合成 fixture 证明 OutcomeEvent
   的 append-only 语义，不计为业务成功。
6. 完成真实浏览器、跨 owner、XSS/SSRF、digest 篡改、旧回执、离线无公网和本地状态回收验证。
7. 再建设最小 Hanlin 离线 evaluator，消费冻结的档案/证据/确认/真实 outcome 数据集，只输出候选改进
   与晋升建议，不直接改线上版本。
8. secure ingest、证据图、示意图、礼部影像侧车和全量知识控制面均后置到独立阶段。

## 七、验收标准

- text-only 旧回奏继续无损展示；
- 图表只能引用 bundle 中已采纳的事实；
- 证据图、分析图和示意图在数据与视觉上不可混淆；
- 附件未上传成功、hash 不符、跨 owner、来源过期或许可缺失时失败关闭；
- 没有图片时仍能形成完整、可访问、可打印的奏折；
- 人工确认前 WorkProduct 决策状态必须是 `PENDING`；本地受控成果可以在唯一 `REPLY` 归档后标记
  `ArtifactState.PUBLISHED`，但 UI 不得称其已确认或已对外发布；
- 史馆召回能够重放同一 manifest/digest，不能因前端升级改变历史含义；
- 任何图像或图表都不能扩大工具、发布或外部写权限。

## 八、史馆精华：从“存档页面”升级为制度记忆

### 当前已成立的事实

- 史馆只有 `MEMORIAL` 与 `REPLY` 两种公开文种；一次成功旨意自动形成且最多形成一条 `REPLY`。
- 身份由服务端认证上下文注入，list/detail/recall/statistics/decision/review 均按 owner 隔离；跨 owner 对象
  按不存在处理。
- 被采用的锦衣卫证据以不可变快照、顺序和 digest 绑定到 `REPLY`，未采用证据不能混入归档。
- 旧案召回是确定性、可解释、失败可区分的只读上下文；“没有匹配”与“史馆不可用”不会混淆。
- 当前候选的八个史馆后端测试文件新鲜运行结果为 `271 passed`。

### 必须保留的精华

史馆的核心不是“收藏更多内容”，而是保留决策发生时的不可变语境：原旨、服务端身份、批准路由、
RuntimeSkill 版本、采用证据、结论、成果引用和当时状态。后来发生的确认、纠错和真实结果只能追加，
不能改写“当时为什么这样判”。

### 当前缺口

| 缺口 | 当前事实 | 正确补法 |
| --- | --- | --- |
| 富奏折重放 | 只有 text-only 归档和证据快照 | 保存 versioned manifest/digest/ref，不复制 artifact 二进制或外部正文 |
| 真实结果 | `ReviewStatus` 通过 upsert 覆盖旧值 | 新建 append-only `OutcomeEvent`；先 synthetic 验语义，真实结果另行授权 |
| 知识处置 | 本地 SQLite 只定义当前产品数据 | 以后按 source/version/license/retention/deletion contract 扩展，不把 Vault 当数据库 |
| 生产边界 | owner-only、本地单实例 SQLite | tenant authority、备份恢复、legal hold、保留/删除均需独立 ADR 和迁移 |

结论：**史馆不迁移、不重建第二套；在当前事实源上按版本增量深化。** 旧史馆、旧 Vault、旧 Qdrant
只能作为隔离的迁移输入，不能成为并行写者。

## 九、翰林院精华：不是通用执行器，而是离线改进院

### 对旧资产的裁决

固定旧 EXT 提交中的翰林接口主要是 `FALLBACK` 空数组；所谓 experiment 只是把 truth ledger 的确定性
条目映射成列表。旧 `hanlin-dispatch` 又通过 `--yolo` 调用 Hermes，授予 terminal、browser、network、
GitHub、memory 和自动化能力。前者没有真实学习闭环，后者会建立第二执行权威；二者都不能直接迁入。

应吸收的只有以下方法：

1. 冻结 dataset、baseline、candidate、metric、owner 和版本；
2. 对传话失真、引用接地、缺证、门禁原因和真实 outcome 分别评测；
3. 失败样本进入待标注池，不自动成为真值；
4. 候选必须先 shadow，对安全指标零回退，平手不晋级；
5. 只生成 `PromotionProposal`，由人和外部 authority 决定是否晋升；
6. 每次晋升绑定 release identity，并能演练回滚。

翰林院输入只允许使用冻结且可核验的 `ShiguanArchive + adopted evidence + WorkProduct/Confirmation +
authenticated OutcomeEvent`。任一链路缺失时数据集状态必须是 `UNUSABLE/NO_DATA`。翰林院不得进入实时下旨
拓扑，不得直接调用生产工具、改 Prompt/规则/知识、写史馆或授权外部动作。

结论：**翰林院不做旧代码迁移；按当前契约重建一个最小、只读、离线 evaluator。** 奖项、排行、孵化、
出海等旧 UI 只有在存在真实 experiment/promotion 事件后，才可作为只读投影恢复。

## 十、知识内核精华：只保留可信引用原则，暂不扩建平台

旧知识飞轮蓝图中最值得保留的是：

- 原文、元数据与向量索引分层；向量库永远只是可删除、可重建投影；
- source/owner/scope/version/hash/license/retention 是知识进入系统的最小身份证；
- Citation 必须解析到不可变版本，Claim 必须显式绑定 supports/contradicts/context；
- Q&A、自评分、模型摘要和历史日志默认是 `derived_untrusted`，不得自动回流为真值；
- 删除、许可撤销和 legal hold 必须覆盖正文、chunk、vector、cache、export 与历史引用处置。

当前不建设通用 Knowledge Platform。户部黄金纵切只需要类型化 `source_refs`、不可变摘要和历史可用性
语义。只有出现第二个真实、重复的跨部门用例后，才评估把这些局部契约提升为共享知识控制面，避免先造
一个庞大但没有业务燃料的平台。

## 十一、统一价值飞轮

```text
用户旨意
  → 服务端身份与批准路由
  → Evidence Spine / deterministic gates
  → 部议、回奏与 WorkProduct
  → 史馆唯一 REPLY + immutable rich snapshot
  → 独立人工确认
  → authenticated OutcomeEvent（后来真实发生什么）
  → 翰林冻结数据集与离线评测
  → PromotionProposal
  → shadow + 安全门 + 人工/机器 authority
  → versioned release / rollback
```

这个飞轮有三个不可替代的事实源：运行方法来自唯一 RuntimeSkill registry；当时事实来自史馆；后来结果
来自 append-only authenticated outcome。翰林只连接三者并提出改进，不拥有任何一者。

首批价值指标固定为：

1. `evidence_coverage`：关键结论有受信引用的比例；
2. `unsupported_claim_rate`：无证结论比例，安全目标为 0；
3. `human_revision_rate` 与 `confirmation_rate`：用户需要改多少、愿意确认多少；
4. `archive_replay_digest_match`：历史重放摘要一致率，目标 100%；
5. `outcome_completeness`：到期案件拥有认证结果的比例；
6. `decision_lead_time`：从旨意到可审阅成果的时间；
7. `candidate_delta`：候选相对 baseline 的真实提升，且安全指标不得回退。

内部测试、synthetic outcome、模型自评分和文件数量只能证明工程质量，不能计入业务成功。

## 十二、全面进度与价值评估

### 评分方法

每项按五个维度各 `0–2` 分：契约、实现、主链接入、本地验证、真实价值证据。`0` 为不存在，`1` 为部分，
`2` 为完整。该分数衡量成熟度，不授予执行或生产权限；机器 authority 是独立硬门。

| 能力 | 契约 | 实现 | 接入 | 验证 | 真实价值 | 合计 | 证据与判断 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Harness / 治理 | 2 | 2 | 1 | 2 | 1 | 8/10 | 能阻断伪授权并有自测；但 `ext-dev` 尚无受管 successor authority / 外部 trust root |
| 46 RuntimeSkills | 2 | 2 | 1 | 2 | 0 | 7/10 | 1,777 旧资产收敛为 23 族、22 活动族并覆盖 46 Skill；仍诚实降级，业务成功 0/22 |
| Evidence Spine | 2 | 2 | 1 | 2 | 0 | 7/10 | owner/route/skill/evidence 服务端重载与六部投影已实现；多数真实 authority source 未接 |
| 史馆 | 2 | 2 | 2 | 2 | 0 | 8/10 | 唯一 REPLY、owner 隔离、证据快照、召回/API/UI 已接；本轮后端 `271 passed`，但无真实 outcome |
| WorkProduct / Confirmation | 2 | 2 | 2 | 2 | 0 | 8/10 | 会计 XLSX、本地受控发布、append confirmation receipt 已存在；未证明业务结果 |
| RichMemorial | 2 | 0 | 0 | 0 | 0 | 2/10 | 只有任务契约和施工蓝图，无 schema/compiler/runtime/renderer |
| 翰林离线学习 | 1 | 0 | 0 | 0 | 0 | 1/10 | 只有历史参考原则；当前树无 Hanlin 运行文件 |
| Outcome 飞轮 | 1 | 0 | 0 | 0 | 0 | 1/10 | 当前可变 ReviewStatus 不能替代 append-only authenticated OutcomeEvent |

由此得到三组不混淆的结论：

- **可信底座成熟度：38/50 = 76%**。身份、运行技能、证据、史馆和成果确认已有较强本地工程基础。
- **下一阶段价值闭环成熟度：4/30 = 13%**。富奏折、翰林和 outcome 仍主要停留在契约/蓝图。
- **综合受管成熟度：42/80 ≈ 53%**。它不是产品完成率，更不是生产可用率；当前产品施工授权仍为 0。

已兑现的价值主要是安全和工程价值：减少第二运行时、跨 owner 泄漏、无证成功、重复归档和状态混淆；
让一条会计旨意拥有可追踪成果和人工决定。尚未兑现的是最重要的商业价值：是否节省决策时间、降低错误与
返工、提升采纳率或带来更好经营结果。机器报告的 `businessSuccessMeasuredFamilies=0` 必须继续保持，直到
真实、经认证、可归因的 outcome 形成。

## 十三、下一阶段优先级与收口条件

### P0：恢复合法施工入口

- 独立 successor authority；exact task/base/pathspec；仓外签名与 required check；clean candidate；fail-closed。
- 退出条件：新 Ready 任务对 exact scope 返回 `GO`。本文和聊天确认都不能替代它。

### P1：只做一条户部黄金纵切

- `RichMemorialEnvelope v1` → 确定性 `metric/table/chart` → 唯一 `REPLY` rich snapshot → 既有 XLSX/Confirmation。
- 不接图片、通用知识平台、真实公网、provider、付款、发布或第二 RuntimeSkill。
- 退出条件：同一冻结候选完成真实浏览器正反链、强制 egress-deny、安全负测和连续 10 轮完整门禁。

### P2：补史馆 OutcomeEvent

- 先证明 append-only、owner/run/decree/archive 绑定和历史不可改写；synthetic 只证明语义。
- 真实 outcome 采集、真实性等级、保留/删除和业务指标必须另获授权。
- 退出条件：真实 outcome 仍未接入时保持 `NO_DATA`，不得把 ReviewStatus 或 synthetic 数据漂白为成功。

### P3：建立最小翰林离线 evaluator

- 只实现 dataset builder、五类 eval、baseline/candidate、PromotionProposal、shadow/reject/rollback 证据。
- 先无 UI；API 与页面必须等真实 read model 存在后再建。
- 退出条件：至少一次坏候选被拒、一次合格候选在授权下晋升并成功回滚；无真实 outcome 时不得评业务提升。

### P4：按需求扩知识与媒体

- 第二个真实跨部门用例出现后再抽共享 Knowledge/Citation 控制面。
- secure ingest、证据图、示意图和影像工作台分别建独立安全包，不与 P1 混做。

最终裁决：**不迁移军机处、史馆、锦衣卫或旧翰林运行时；保留当前三层事实源，在其上增加最小投影、
追加事件和离线评测。** 当前可以把治理设计评为 `CONDITIONAL PASS`，但产品闭环、真实业务价值和生产晋级
都必须维持 `FAIL / NOT PROVEN`，直到上述硬门产生新鲜证据。
