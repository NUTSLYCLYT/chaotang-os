# ext-dev 能力精华、价值与融合蓝图

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
  → human confirmation
  → Shiguan archive
  → authenticated outcome settlement
  → eval/promotion evidence
```

价值：每项结论可以回答“依据什么、谁批准、生成了什么、后来结果怎样”。

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
5. 成功后可归档为史馆 `REPLY`，保留原旨、参与部门、办理过程、结论、时间、责任主体和证据引用。
6. 当前唯一完整成果附件类型是会计管理报告 XLSX，支持 owner-scoped 下载和人工确认。
7. 每日奏折是 39 司→6 部→丞相的受控事实汇总；用户确认后归档为 `MEMORIAL`。

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

### 开发时使用的工程 Skills

- `api-and-interface-design`：冻结富奏折输入输出和稳定错误；
- `frontend-design`：卷轴内的图表、图像、层级和移动端体验；
- `security-and-hardening`：上传、媒体、外链、XSS、SSRF、租户/owner 边界；
- `test-driven-development`：先写 block parser、附件攻击、证据/示意混淆和跨 owner 失败测试；
- `e2e-testing`：验证下旨→回奏→图表/图片→确认→史馆召回的真实浏览器链；
- `imagegen`：仅用于生成示意图和设计资产，不生成事实证据。

## 六、推荐的图文上书房实施顺序

1. 定义 closed `RichMemorialEnvelope` schema 与 text-only 向后兼容；
2. 先实现 `metric/table/chart`，用确定性数据即可图文增强，风险最低；
3. 接 secure attachment ingest，只支持受控图片/PDF/DOCX，默认不进入模型上下文；
4. 加 evidence image 与 illustration 的强制视觉标签和来源抽屉；
5. 接礼部影像侧车的 preview-only 产物和人工确认；
6. 史馆只保存 manifest、digest 和 owner-scoped artifact refs；
7. 完成跨 owner、XSS、SSRF、恶意图片/Office、篡改 digest、旧链接、缺 alt text 等对抗测试；
8. 先 shadow，再小范围启用，不授权自动发布或外部写入。

## 七、验收标准

- text-only 旧回奏继续无损展示；
- 图表只能引用 bundle 中已采纳的事实；
- 证据图、分析图和示意图在数据与视觉上不可混淆；
- 附件未上传成功、hash 不符、跨 owner、来源过期或许可缺失时失败关闭；
- 没有图片时仍能形成完整、可访问、可打印的奏折；
- 所有成果在人工确认前均为 preview；
- 史馆召回能够重放同一 manifest/digest，不能因前端升级改变历史含义；
- 任何图像或图表都不能扩大工具、发布或外部写权限。
