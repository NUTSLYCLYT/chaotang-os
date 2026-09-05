# 单品出海诊断融入正式主链：整改修正案草案

状态：DRAFT_ONLY / NOT_AUTHORIZING。本文是可审查的范围与验收契约，不是机器 approval manifest，不授予产品施工或 Git 外部动作权限。

## 1. 基线与授权事实

- 任务族：SINGLE-PRODUCT-EXPORT-CANONICAL-INTEGRATION-20260906。
- 仓库：gitee.com/msxn/chaotang-os；唯一目标分支：ext-dev。
- 已核对远程提交：91a74574d454420753d78d15d3edfa889a9e767e。
- 对应 tree：f94a23ac524b98b36487f13fd56492aad77b6651。
- 当前共享工作区：docs/r0-trusted-kernel-amendment-20260720；不作为产品施工基座，不携带其未知修改。
- 当前工作区旧 execution-authority.v1 --authorize 返回 STOP / AMENDMENT_APPROVAL_REQUIRED。
- ext-dev 使用 product-authority.m0.v1，按具体 task 选择审批；默认 STOP 不能被解释为所有 scoped task 永久不可施工。
- 已检查的 ProjectOrganization 旧 approval 针对另一工作包且 base 已过时；看板 A1/V4 批准也不能授权本草案的后端改动。
- 本轮未在一个有效的当前主线施工工作区运行 scoped authorize，不声明取得 GO。

## 1.1 本次基线更新

旧候选base 94c6aad62c325dc87134c0acc00eb80d033f91dc已过期。本次远端只读查询确认新base；其间仅合入5个看板V4前端文件，没有后端/authority变动。保留SceneBoardV4.module.css、TaskColumns布局、identityKey隔离、controller和普通上书房导航；真实性字段通过现有buildV4Presentation传入，不绕开投影重新拼装任务身份。新增精确路径仅为sceneBoardV4Presentation.ts及其测试，所以由12项变为14项。展示投影传递assessment的规则/未核实/legacy信息、riskAssessed与是否允许手动done，不将这些属性解释为执行授权。仅对本场景差异化标签和操作，其他场景不重新判定。

旧候选的独立审查不自动证明本次新增投影范围通过；本版本须再次复审。A1在本文指单品真实性整改，不是已经合入主线的看板体验A1。

## 2. 目标、假设与非目标

用户故事：我在单品出海页面整理产品资料，能看清哪些已知、哪些待核；主动请求拟旨并确认后，现有正式任务负责办理。我可以从同一场景结果追踪任务、案卷（存在时）和真实史馆回奏。

完成定义：资料预检→用户请求拟旨→用户确认正式下旨→现有异步 job→现有部门/司级处理→正式归档→场景看板读取关联状态。生成分析不等于实际出海成功。

假设：本轮使用结构化字段和用户粘贴的有界原文；原始文件上传/解析不冒充已经实现，另列后续任务。目标市场资料不足时，只交付缺口和核验任务，不承诺推荐三个市场或给出法规结论。

非目标：重写 LangGraph；新增 Agent 框架、任务引擎、能力注册库、项目组数据库、独立史馆 writer；新增外部 provider；自动报价/签约/付款/外联/部署；激活尚未获批的 claim-evidence sidecar；改造其余四个场景业务判断；修改 ADR0028；推送、合并或部署。

## 3. 已确认缺口

1. backend/app/scene_packs/storage.py 的单品函数返回固定 confidence=68、准备度72及预设市场列表；flow 名称仅为结果字符串。
2. SceneRun 与 BoardMission 真实存储，但 create_scene_run 不进入正式 job、案卷或史馆。
3. completed 被映射为 done，仍待执行的 nextActions 与完成状态矛盾。
4. 原始输入未完整保存在当前运行记录中，不能事后从裁决文本重建产品事实。
5. 前端仍有上传占位；现有 evidenceRefs 缺少精确原文位置与可用证据身份。
6. 主线已有拟旨授权、幂等异步 job、阶段恢复、owner 隔离和正式归档，应当复用。
7. 最新看板 A1 已处理身份匹配、失效会话、陈旧响应与不确定写入，后续必须保留。

## 4. 分两个独立产品候选交付

不能把两个候选当成一个可连续消费的旧批准。A1先消除误导，A2在A1实际进入主线后重新固定base并取得对应授权。

### A1：单品预检真实性与待办状态

建议任务：SINGLE-PRODUCT-EXPORT-TRUTH-A1-20260906。

- 单品结果定位为“资料预检 / 待正式核验”；不再返回固定准备度、预设市场推荐或未经校准的可见置信度。
- 用现有 action_payload 增加版本化 assessment：method=rules、verificationStatus=unverified、score=null、riskAssessed=false、inputSnapshot、inputDigest、sourceLocations。
- 新单品公开响应 confidence=null。为兼容旧SQLite非空列，内部旧 confidence 列使用0占位，但不得被API、UI或新评分逻辑解释为真实0分。API必须按assessment版本输出null；迁移到真正可空列另行评估，不能隐式重建运行库。
- 无校准记录的历史单品固定分数同样标为legacy_unverified并在读取投影中隐藏；不改写历史裁决内容或批量重判旧任务。
- riskGrade保持现有枚举兼容；关键输入缺失为high/blocked，输入具备但未核验为medium并显示“待核”，不默认low。riskAssessed=false时颜色不能被标注为已评估风险。
- canProceed=false表示不可据此开展对外业务；“补充资料”仍可使用。A1不新增“请求拟旨”联动，显示“正式办理衔接待上线”或不展示该按钮；已有普通上书房导航不宣称自动关联，不让一个布尔值同时承担导航和执行授权。
- 新单品预检完成后，SceneRun.status=completed仅代表预检完成，BoardMission.stage=awaiting_input；缺字段为blocked。
- 历史记录保留来源和旧状态；UI明确为历史分析状态，不将历史done宣称为业务已验收。
- 单品看板的手动done标记不得覆盖正式执行状态，也不得标成业务成功；A1阶段对单品关闭“业务完成”式措辞/动作，其他场景兼容保持原样。
- inputSnapshot仅保存白名单业务字段及有界粘贴文本，不保存密钥、cookie、任意路径或远程下载内容；限制单字段长度与总大小，超限返回422并说明哪个字段超限，不静默截断。
- user_claim证据只能表明用户申报；sourceLocations绑定字段路径与原文摘录，不能因为存在输入就升级verified_fact。
- 未经确认的外部来源标记missing/unverified，不生成虚构URL、采集日期、证据ID或认证参数。

A1候选精确路径（14项；超出即需重新审查范围）：

1. backend/app/scene_packs/models.py
2. backend/app/scene_packs/storage.py
3. backend/app/api/scene_packs.py
4. backend/tests/test_scene_pack_api.py
5. backend/tests/test_scene_pack_truth.py（新增）
6. frontend/src/features/scene-packs/types.ts
7. frontend/src/features/scene-packs/client.ts
8. frontend/src/features/scene-packs/client.test.ts
9. frontend/src/features/scene-packs/ScenePackWorkspace.tsx
10. frontend/src/features/scene-packs/ScenePackWorkspace.test.ts
11. frontend/src/features/scene-packs/SceneBoard.tsx
12. frontend/src/features/scene-packs/SceneBoard.test.ts
13. frontend/src/features/scene-packs/sceneBoardV4Presentation.ts
14. frontend/src/features/scene-packs/sceneBoardV4Presentation.test.ts

共享类型和解析器必须兼容其他四个场景，不改变既有大殿结构、路由、看板controller、登录与会话逻辑。添加assessment不可另建注册表。

A1路径充分性依据（按已核对主线实现，实施时仍须失败测试确认）：

| 改动责任 | 已有落点 | 对应验证 |
| --- | --- | --- |
| 预检、快照、mission初始状态、人工PATCH阻断 | storage.py 的单品构造函数、create_scene_run、_build_mission、update_board_mission | test_scene_pack_truth.py、test_scene_pack_api.py |
| null评分契约、历史读取投影 | models.py、api/scene_packs.py 的 _run_json 及mission响应 | test_scene_pack_api.py |
| null解析与共享兼容 | types.ts、client.ts 的 runValue | client.test.ts |
| 预检文案、来源、操作开关与历史状态标签 | ScenePackWorkspace.tsx、SceneBoard.tsx及sceneBoardV4Presentation.ts的buildV4Presentation | 两组件及展示投影对应测试 |

sceneBoardController负责身份和异步写入，不负责评分计算；继续复用，不修改其并发/会话语义。若实际测试证明14个文件无法覆盖边界，停止并重审路径，不用无关改动凑齐exact集合。机器验证要求实际改动集合精确匹配productPaths，并非允许路径上限。

A1状态真值表：

| 情况 | SceneRun.status | 新mission.stage / 历史处理 | 对用户的含义 | 可用动作 |
| --- | --- | --- | --- | --- |
| 新输入完整但未经核验 | completed | awaiting_input | 资料预检完成，未正式办理；medium/待核 | 补证、查看资料、导出预检 |
| 关键字段缺失/已检测结构化冲突 | blocked | blocked | 需补证；high | 补充/更正后创建新run |
| 已持久化运行失败 | failed | blocked | 预检失败，无业务结果 | 查看安全错误、显式重试 |
| 请求格式/大小不合法 | 无新run | 无新mission | 422校验失败 | 更正字段 |
| 历史completed/done | 不改写 | 保留旧值并标legacy | 历史分析状态，不是业务验收 | 查看；无“已成交/已出海”标签 |
| A1单品人工PATCH为done | 不变 | 拒绝写入、返回稳定错误 | 不允许用人工状态绕过正式验收 | 补证/阻断状态按原规则处理 |

输入快照v1仅允许字符串字段；单字段最多8000个Unicode码点，全部字段UTF-8编码合计不超过32768字节；数量/价格保留申报原文，不转换为已核实数值。摘要和来源摘录使用同一持久化原文，禁止在规范化过程中删除否定词或重写单位。inputDigest采用SHA-256，对RFC8785规范JSON的{schemaVersion,packSlug,demo,inputs}计算，inputs为通过白名单和大小校验的原始字符串映射；缺字段显式缺失而非臆测填补。v1之外值拒绝，不自定义第二种哈希算法。

### A2：SceneRun到正式下旨的关联

建议任务：SINGLE-PRODUCT-EXPORT-CANONICAL-LINK-A2。A2为设计草案，不能提前声称exact施工路径已冻结。

1. 用户从场景点击“请求丞相拟旨”，前往现有/study；URL只携带不透明sourceSceneRunId，不携带产品正文、报价或认证资料。
2. /study通过认证后的既有SceneRun查询读资料，服务端再次验证user、tenant、slug、demo和inputDigest；错误或跨用户统一不可用。
3. 用户显式发起拟旨。扩展现有chancellor-drafts请求支持可选sourceSceneRunId，输入由服务端从原始快照获取；不可采用客户端声称的完整度、通过状态或关联身份。
4. 拟旨授权上下文冻结sourceSceneRunId、inputDigest和既有路由/拟旨版本。用户查看草案后显式下旨；不新增第二个正式执行POST入口。
5. 正式decrees/chancellor受理验证当前来源仍匹配已冻结授权后，交现有幂等job。禁止只在浏览器提交后补写job关联。
6. 关联唯一权威放在既有decree_jobs存储的可空来源字段source_tenant_id/source_scene_run_id/source_input_digest中。来源字段必须全有或全无；对非空来源建立(可信tenant, owner, sourceSceneRunId)部分唯一索引，tenant来自服务端认证和场景归属校验，不接受客户端指定。旧job来源全空，不受该索引约束；这是来源关联作用域，不是全系统租户迁移。scene库不另存一份可变job状态。正常重复提交返回同一job，冲突输入返回409。
7. 本轮每个不可变SceneRun最多对应一次正式办理。再次办理必须显式生成新SceneRun；不允许在旧记录上覆盖历史关联。模型失败重试走现有job机制。
8. 沿用既有reserve→job staging→授权commit→acceptance标记/activate的状态机。job staging与来源字段在同一个job库事务写入；不能宣称内存授权消费与SQLite天然分布式原子。A2冻结前须逐个证明：reserve后未入库的失败释放；staging已写但授权未消费的恢复须核对原用户、租户、指纹和来源；消费后未激活不得重复消费或生成第二job；激活后响应丢失返回原job。所有accepted staging均纳入对账，无法证明安全恢复的断点保持blocked，不凭source id重建授权或新增恢复账本。具体函数/可恢复证据仍是A2待审门，不能凭本设计宣称已解决。
9. SceneRun原始快照不可变；A2拟旨再次校验A1版本化inputDigest并冻结原文、tenant、owner、slug、demo和digest。旧run没有快照/digest时必须重新录入生成run，不能从历史裁决反推原文。原始数据读取失败时阻断新受理；已受理任务从自身冻结上下文恢复，不依赖再次访问可变浏览器状态。
10. 场景GET读投影通过来源字段查询job，返回canonicalExecution={jobId,state,stage,replyId,caseId,archiveStatus}。reply/case必须查询真实存在且owner匹配的对象；单部无案卷时caseId=null，不制造占位案卷。
11. 正式REPLY继续由现有executor/史馆路径归档，一次job一个回奏；场景层不自行写史馆。历史规则卡只能叫预检，不能被重新包装成正式回奏。
12. 已关联卡片状态从job派生，PATCH stage不得覆盖。nextMilestone按执行、补证或归档真实状态投影；正式办理成功仍不等于出海业务成功。
13. 保留超时、预算、撤权、归档失败、取消的现有语义。模型阶段恢复仍可能重跑整图，不能宣称任意节点恢复。
14. 新接口不启用任意URL采集或外网开关。demo=true只走隔离的合成验收运行器；没有隔离运行器时阻断正式下旨，不把演示资料混入真实运行或触发付费provider。
15. 现有正式旨意正文有2000字符限制；超出时提示用户收窄问题/资料并重新确认，不静默裁剪关键事实，也不绕开该限制。后续长文附件摄取另立契约。

A2待精查的候选模块：scene_packs models/storage与新桥接service；现有draft authority及chancellor-drafts/decrees API；decree_jobs models/storage；现有前端draft/decree BFF、backendClient、/study拟旨/下旨状态与Scene结果看板；对应API、幂等、恢复和跨层测试。原则上不改worker拓扑、史馆schema和部司提示词。只有在A1候选落地后对新基线做逐路径精查，才能形成A2机器manifest。

## 5. API与数据兼容要求

- 复用GET /api/v1/court/scene-runs/{run_id}及其同源BFF；增量返回真实性说明，A2增加canonicalExecution读投影。
- 复用POST /api/v1/chancellor-drafts与POST /api/v1/decrees/chancellor；只在A2添加可选来源契约，不改变无来源的老请求行为。
- 复用GET /api/v1/decree-jobs/{id}和史馆/案卷GET；客户端不可指定owner或任意job绑定。
- A1只扩展现有JSON载荷和读投影，不重建SQLite表。A2新增job来源列/唯一索引必须有事务化、重复执行无副作用的schema升级及旧库兼容测试。
- A2升级前备份；不得在活跃任务中执行数据回退。应用回退保留新增列/索引和历史关联，旧程序是否忽略新增列须用实际旧版本证明；不能依靠删除新数据回退。
- 不进行跨SQLite物理外键声明；跨域引用由服务端身份校验与可核对的job关联保证。

## 6. 验收矩阵

| ID | 路径 | 必须证明 |
| --- | --- | --- |
| T01 | 单品完整输入 | 预检可完成；无固定准备度/推荐市场/可见置信度；显示待核 |
| T02 | 缺关键字段 | blocked，缺口具体且canProceed=false |
| T03 | 用户声明冲突 | 对明确结构化重复/冲突样例保留双方原文并阻断；自由文本未检测不等于无冲突，不宣称穷尽自然语言冲突检测 |
| T04 | 历史单品记录 | 可读取、标legacy，固定分数不伪装校准值，不改历史业务事实 |
| T05 | 其他四场景 | 原API结构/入口可用，共享解析器支持兼容 |
| T06 | 拟旨与确认分离 | 预检不触发模型；请求拟旨不触发正式执行；明确下旨才受理job |
| T07 | 跨owner/tenant与ID篡改 | 不泄露资料、不绑定任务、拒绝冒用授权 |
| T08 | 原文/摘要注入 | 资料中的指令不能授予工具、路由或外部权限 |
| T09 | 双击、超时重试与多标签页 | 同一来源唯一job；不同内容同幂等键409；陈旧响应不覆盖当前任务 |
| T10 | 模型阶段失败 | 按既有重试和预算限制恢复，明确重跑范围 |
| T11 | 结果持久化后中断 | 继续归档发布、不重复模型、不重复回奏 |
| T12 | 归档不可用 | 不显示已归档或业务完成，恢复后真实关联可追溯 |
| T13 | 手动状态修改 | 不能覆盖已关联正式job的执行状态或越过验收 |
| T14 | schema升级与回退 | 旧库可读、重复升级安全、旧版本兼容或明确禁止回退 |
| T15 | demo与真实隔离 | demo无付费调用、不进入真实任务；隔离合成链的每层都保留demo标记 |
| T16 | 桌面/360px浏览器 | 预检→拟旨→确认→任务详情→真实回奏可导航，无阻塞控制台错误 |

分期归属：A1机器验收T01–T05、T13的未关联单品人工done拒绝和T15的预检demo隔离。A1追加输入大小/非法字段、快照哈希稳定性、null评分全链兼容测试。T06–T12、T14、T13已关联job部分、T15正式链隔离和T16完整下旨链属于A2，不在A1提前声明通过。A1不调用模型，也不形成正式任务或史馆归档。

A1另设UX-A1独立人工/浏览器工具验收门，不属于本manifest机器verification的覆盖声明：桌面与360px分别完成完整/缺失合成输入→显示无评分的预检结果→打开场景看板详情；核对待核文案、无业务完成按钮、历史标签、可点击性与控制台错误，并保存绑定候选SHA/tree的截图及操作记录。现有manifest schema没有浏览器工具字段，禁止伪造命令或用npm test冒充该证据。只有机器PASS与UX-A1实际通过才能对Owner称“A1已验收”；若工具或隔离本地服务不可用，停在“代码候选通过，UX未验收”，不请求作为已验收产品并入主线。此门不删减为构建烟雾，也不授权安装浏览器框架。

## 7. 验证命令与证据要求

A1先建立能失败的行为测试，再实施。以下命令仅作为待执行要求，本轮未运行：

- backend: python3 -m ruff check app/scene_packs app/api/scene_packs.py tests/test_scene_pack_api.py tests/test_scene_pack_truth.py
- backend: python3 -m pytest -q tests/test_scene_pack_api.py tests/test_scene_pack_truth.py
- backend: python3 -m pytest（最终受影响全矩阵）
- frontend: npm test；npm run typecheck；npm run lint；npm run build
- root: node scripts/check_harness.mjs；node scripts/check_harness.mjs --self-test
- root: node scripts/harness-doctor.mjs --check；node --test scripts/product-authority.test.mjs
- diff: git diff --check
- A2追加拟旨授权、decree_jobs受理/恢复、史馆归档、案卷、租户与数据库升级测试，命令随exact路径冻结。
- 浏览器使用已有浏览器工具/项目允许的合成验收方式，不擅自安装Playwright依赖。A1覆盖预检和待办语义，A2覆盖完整链路。
- 测试只用临时SQLite、合成材料、注入假模型和受控本地端口；真实模型与外部来源验收必须有明确预算和权限，单独报告，不与合成证据混淆。
- 独立复审覆盖后端身份/授权、跨库一致性、前端状态和历史兼容。P0/P1未解决不提交产品候选。
- 所有证据绑定最终candidate SHA/tree与运行模式；历史PASS不能替代新候选验证。

## 8. 实施与批准边界

Owner当前已确认整改方向并要求进入下一轮；本文件据此准备，不把方向确认伪装成机器GO。

下一项具体批准仅针对A1：同目录提供approval-manifest.candidate.json，按现有consumer计算canonical digest并离线验证schema。候选中的APPROVED_FOR_ONE_CHILD是待批准的schema固定字节，不代表本轮已有批准或GO；候选不写入仓库.harness。Owner须确认该manifest digest和本文SHA-256后，按现有流程独立提交两个审批文件：manifest及本文（目标docs/product/tasks/2026-09-06-single-product-export-truth-a1.md）。A2章节仅是后续设计，不属于此manifest施工范围。

当前consumer要求审批commit成为远端ext-dev头后才能authorize；因此创建审批提交和仅推送审批提交都需明确授权。产品候选不自动推送，仍在对应task authorize返回GO后实施。若远端base移动，重新生成digest并确认，不把旧批准自动转移到新base。

本文件SHA-256仅标识本文内容，不能用作M0 manifest canonical digest；也不等于产品commit SHA或tree。不得把这几种标识混用。

本轮交付为草案与审查结果；没有产品修改、提交、推送、合并、部署或真实模型验收。

## Status

Ready

## Product Definition

- 用户确认：用户已批准A1业务范围；本治理格式补正仍须单独批准exact digest，不自动继承推送权。
- 问题：单品预检的固定评分、误导性风险和完成状态。
- 目标用户：产品资料准备与出海负责人。
- 目标：按本文A1原范围实现真实标记、快照和待办。
- 非目标：A2正式下旨关联、模型/外网调用、产品推送、merge、deploy。

## Acceptance Criteria

- [ ] A1原有T01–T05及分期指定测试通过；保留历史原文，不产生当前GO误导。
- [ ] 同一最终候选的manifest机器门禁和独立UX-A1浏览器门均完成，不以单测代替浏览器。
- [ ] 保留14项精确产品路径；不改controller、CSS、authority或其他业务事实源。

## Delivery Constraints

- 范围：原14项产品路径及原A1验收边界不变。
- 兼容性：其他四场景与V4布局/身份/会话机制保持。
- 技能计划：codex-engineering-workflow；缺失第三方技能采用项目允许的原生等价门禁。
- Codex-only：是；禁止Claude CLI/runner。
- 本次只补任务模板章节与审批base绑定，不能修改护栏规则使失败消失。

## Affected Modules

- 模块：Scene Pack单品预检、API读投影、共享结果解析、军机处V4展示。
- 允许路径：本审批manifest列出的14项productPaths，详见原A1精确文件列表。
- 依赖模块：复用既有认证与场景存储；不新增A2依赖。

## Technical Plan

- 本次治理补正base：5c1520286557804ca3ecfaf2cfeb738852d72918。
- base tree：92a72d092b8d47eee576a623b58e77023b2f01f7。
- 上文91a74574基线是首轮产品代码基线；5c152028只增加两项审批文件，产品源码未变。
- 先独立提交/推送更正审批；只在新task authorize GO后把保留的14项本地产品差异应用于审批单亲子候选。
- 不修改过去审批commit；保持完整Git历史，不force、不merge。
- 验证计划：原manifest矩阵不变，另按项目规范完成同一最终候选10轮完整门禁及UX证据。
- 风险：远端推进会使审批失效；届时停止回报，不自动迁移旧批准。

## Implementation Report

- 当前状态：A1代码仅在隔离工作区保留，未创建产品commit。
- 实际使用的skill：codex-engineering-workflow，原生worktree/TDD/审查/验证等价流程。
- 验证：曾完成后端4578通过/4跳过及前端773通过；随后legacy修正仅完成19项定向回归，先前全量不代表最终候选验收。
- 自审与独立审查：风险色和legacy当前GO文案问题已修正；Python、TypeScript、通用代码与安全复审无P0/P1代码阻断。
- 未通过项：原审批文档缺8个必需章节，根check_harness失败；本补正专门解决该原因，不放宽检查。
- 未运行项：最终候选10轮、完整UX-A1浏览器验收及verify-candidate。
- 本报告是治理补正时的历史状态，不作为后续产品完成证据；最终报告须绑定实际候选SHA/tree。

## Acceptance Review

- 验收结果：Pending。
- 本治理补正候选未被批准，不产生GO。
- 产品验收仍未完成；合成服务仅验证登录可用，未完成场景浏览器全链。
