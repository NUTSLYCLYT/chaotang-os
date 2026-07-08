# OpenClaw + Hermes 使用设计 ·「记忆飞轮 · 分层闸 · 诚实标源」三合一

> 状态：设计（未写码）。2026-06-24 由设计会审（3 套哲学 + 多维评判 + 收敛）沉淀。配套：`openclaw-hermes-integration-plan.md`（怎么接）。本文回答：**怎么用得好 + 多维度优缺点**。

## 0. 一句话定位
**默认轻**（秒级 dept + 记忆召回覆盖 ~95% 决策），**该重才重**（升级闸把 OpenClaw 分钟级算力只花在真缺证/真高风险/用户显式深挖），**做完必反写记忆**形成复利，**每条产出都带可审计源标**——越跑越快，但每次快都诚实。

## 1. 核心飞轮：memory → execution → memory（补 Karpathy 点出的断链）
- **① memory（召回先行）**：`flow_engine` 每次 run 入口已 0 步织进 `memory_store` 旧案检索 + 渐进画像，喂上书房拟旨/军机处会审——**能召回就不重算**，执行是召回未命中的兜底，不是默认动作。
- **② execution（该重才重）**：缺证且涉真实产线资产（报价/BOM/交期/交付）时，升级闸判定升级 → 前端 adapter→jiqun:8081→`openclaw_client.post_tasks` 批派庄园 6 组深执行。
- **③ memory（做完必记）**：史馆归档时把 OpenClaw 深结果**两层切**——「结论摘要进 `memory_store`（≤2000字，带真 trace_id + 资产类型 SSOT 检索键）+ 全文进史馆主库（taskId 指针）」反写回同一记忆库。**这条反写线是当前缺失、也是接 OpenClaw 的第一个必须做的 PR。**
- **防腐剂**：只有真 trace_id 经 `source-label.ts` 的 `assertLiveSwarmTrace` 校验才标 `LIVE_SWARM`、才进记忆库；脏案/降级案不进飞轮——**复利复的是真不是错**。

闭环成立后：同类真实深挖第二次起从记忆秒级命中、军机处无需重派 OpenClaw；每条归档带「当初是否升级/升级是否值得」元数据，反过来训练升级闸越来越敢降级。

## 2. 主闭环每段用法
| 段 | 用法 |
|---|---|
| **拟旨**（上书房·本地确定性） | Hermes 召回先行，OpenClaw 绝不出现（纯本地无副作用，守铁律13.2-9）。旧案高质量命中=直接降级走秒级草案、不进升级闸。源标只反映本地确定，**禁因注入记忆就冒充 LIVE_SWARM**。FTS5 退化 LIKE 时检索 key 用结构化 SSOT 枚举（部门码/客户/资产类型）把命中从「撞词」拉回「撞键」。 |
| **缺证检查** | 升级闸第一道输入，先问记忆（同客户上次报价/同 BOM 上次交期）→命中即回填标 MIXED。算缺证严重度（critical/major/minor）写 `routing_plan.review_depth`。上传文件按 **evidence** 而非 attachment。纯本地不碰上游。 |
| **军机处深挖**（swarm-deepen·**唯一 live 切点**） | OpenClaw 唯一落点，走 `swarm-deepen/route.ts`。无产线资产→前端 callLLM 咨询；涉报价/BOM/交期→必须 adapter→jiqun:8081→后端代理 OpenClaw（Path A 配 6 env 透明升级）。回包经 `normalizeLiveAdapterTrace`+`assertLiveSwarmTrace` 真 trace_id 才标 LIVE_SWARM，否则降 MIXED/FALLBACK。军机处对 OpenClaw output 加一道「缺证/风险/质门」校验再采信。**短板**：无长任务进度 UI，接入前先补进度回传+超时降级回本地 deep 档。 |
| **裁决** | 决策卡顶部强制展示源标 + trace 入口。奏折必含八要素。高风险（股权/合同/付款/对外报价/供应商锁定）强制过人工确认门 `governance/lib/gate.ts`（L0-L4 + blast-radius），禁一键静默采纳。**只有「被采纳且 quality 达标」的裁决**才标为可回写候选，驳回/废案不进飞轮。 |
| **史馆归档** | 飞轮回写闸门。quality≥4 → `memory_store` 存储 + 渐进画像（已在 flow_engine）。补线：动过 OpenClaw 则深结果两层切反写。归档前锦衣卫做可信度把关，脏情报挡门外；降级产出如实标注不洗白。 |

## 3. 八维度优缺点
| 维度 | 优点 | 缺点/风险 | 设计取舍 |
|---|---|---|---|
| **体验** | 默认秒级覆盖 ~95% 几乎无感；熟客熟料越用越快；分钟级只在真缺证触发、升级前明示「约几分钟值得等」，延迟从「卡顿」变「郑重」 | OpenClaw 无长任务进度 UI，分钟级期间用户只能看「进行中」灰态 | 接前先补轻量进度轮询/SSE + 超时降级回本地 deep 档；UI 做预期管理 |
| **成本** | Hermes 记忆层本地零成本已在用先吃满；升级闸默认拒绝+旧案命中降级，OpenClaw 重算力只花在少数决策，**调用量随归档增长而下降（越用越省）** | 反写飞轮+两层切+升级闸是新增工程量+出错面；OpenClaw 网关维护单点税 | OpenClaw 暂不接=不为未验证加速付税；记忆命中率/升级调用量做监控指标用数据证明（Deming） |
| **可靠可观测** | 复用 review_depth 状态机 + `source-label.ts` 真 trace_id 守门 + reality-state 归一；「又慢又最终降级」灰态可埋点为时延/降级率指标+秒级告警 | 源标诚实靠每调用点自觉，任一新 route 漏标 trace→LIVE_SWARM 被污染；网关单点+拆错下游全错 | nodetest 回归断言持续把关漏标；军机处 output 质门校验；fallback spawn + 降级回本地 |
| **数据飞轮** | memory→execution→memory 闭合是核心增量与**真护城河**；归档带「升级是否值得」元数据让闸自校准 | **反写线尚未建**（最关键最未落地）；FTS5 退化 LIKE+2000字上限，召回精度有天花板；有「复利复错」风险 | 接 OpenClaw 第一个 PR 必是反写线；两层切绕 2000字；结构化键；后续上 hybrid_retrieval 语义检索根治 |
| **前沿能力** | OpenClaw Path A 透明升级即得秒级→分钟级重执行；Hermes 38 专家会诊网关 key 解除后即插即用 | Hermes 会诊网关 **key blocker 是硬先决**（/v1 invalid_api_key、无 hermes_client）；OpenClaw 实质只用到 /tasks 批派、flow 流式未真实压过 | 会诊网关维持标签态不强上不拖主闭环；OpenClaw 接入前先有真实产线需求样本 |
| **可维护架构** | 严守铁律13.2-9 前端 adapter→jiqun:8081→后端代理；源标/类型/状态全 import 唯一真相源（铁律2 SSOT），禁平行枚举 | 引擎边界「是否触碰真实产线资产」需人工逐入口判断，模糊地带易误判；升级闸是新 SSOT，阈值拍错则该升不升/乱升 | 模糊处评审兜底+落地前必答「走前端咨询还是转后端产线」；阈值用真实归档数据回归校准 |
| **上线节奏** | 完全贴合 5 大神裁决：先上线主闭环、Hermes 免费先吃满、OpenClaw 需求拉动再 Path A；升级闸先用本地 deep 档占位，接谁都是配置 | 升级闸冷启动期无真实数据校准阈值；反写线在接 OpenClaw 前是规划态 | 分期：先铺三护栏+吃满记忆→需求拉动且反写线就绪才开 Path A；冷启动保守偏不升级+人工复核 |
| **安全证据可信** | 源标诚实从口号变全链护栏；产线资产强制后端代理；高风险过人工确认门；脏情报锦衣卫挡门外；降级如实标注不洗白 | 自动升级 vs 手动升级权责边界不清→自动闸误判把咨询升成产线深挖、触碰真实资产却没过人工确认门（踩铁律13.2-5/9） | 写死「自动闸只能升咨询级，触碰真实产线资产的升级强制人工确认门」；reverify nodetest 让 CI 替你复核 |

## 4. 使用场景（何时用谁）
| 场景 | 用谁 | 源标 |
|---|---|---|
| 熟客问同类咨询（无新产线资产） | **纯 Hermes 记忆**：召回旧案+画像→秒级出草案，不进升级闸、不动 OpenClaw（最高频最省钱） | LIVE/MIXED |
| 新问题、缺证 minor、不涉产线资产 | **秒级 dept + 前端 callLLM 补证**，不烧 OpenClaw | MIXED |
| 缺证 critical / 高金额高风险 / 涉真实产线资产 / 用户点深挖 | **分钟级 OpenClaw**：swarm-deepen→jiqun:8081→批派庄园 6 组；深结果反写记忆；高风险过人工确认门 | LIVE_SWARM（真 trace）|
| 同类真实深挖**第二次**（上次已反写） | **纯 Hermes 命中**：召回上次深结果摘要→军机处秒级出结论，无需重派 OpenClaw（**飞轮复利兑现点**） | MIXED（引用旧案）|
| OpenClaw 挂/超时/拆错 | **降级兜底**：fallback spawn 或降级回本地 deep 档，灰态秒级告警显形，绝不伪装 | FALLBACK |

## 5. 分期 rollout
0. **阶段0（立即·零新代码）**：把 Hermes 记忆层吃满（确认检索注入+画像+quality≥4 存储全链在转；检索 key 改结构化 SSOT 枚举绕 FTS5 退化）。同时铺三护栏：源标诚实、灰态/时延/降级率监控、史馆可引用可重放。
1. **阶段1（主闭环优先）**：先上线纯本地主闭环，OpenClaw 不接、军机处用本地 deep 档占位。升级闸建为单一真相状态机（复用 `review_depth`），阈值保守偏不升级+人工复核，积累校准数据。
2. **阶段2（反写线先行）**：OpenClaw 真接**之前**先做好 execution→memory 反写并测通（两层切 + reverify-swarm-trace nodetest）。这是接 OpenClaw 第一个必须就绪的 PR。
3. **阶段3（需求拉动·按需接 OpenClaw）**：仅当主闭环跑出真实需求才开 Path A（配 6 个 `OPENCLAW_*_URL`，0 前端代码）；先补长任务进度回传+超时降级，军机处 output 加质门校验。写死「自动闸只能升咨询级，触碰真实产线资产必过人工确认门」。
4. **阶段4（可选·前沿增强）**：Hermes 38 专家会诊网关 key blocker 解除后作军机处可选「加挂会诊席」接入；不解除则维持标签态不拖主闭环。后续上 hybrid_retrieval 语义检索根治召回精度。

## 6. 顶级风险（提前钉死）
1. **反写线未建是最大单点**——接 OpenClaw 必须以反写线为第一个 PR，否则飞轮单向漏气、复利不成立。
2. **源标诚实靠自觉会塌**——必须 nodetest 回归断言让 CI 每次替你复核（铁律4，Deming：拿数据不靠信）。
3. **升级闸阈值冷启动空窗**——保守偏不升级+人工复核，用真实归档数据回归校准。
4. **OpenClaw 网关单点+拆错下游全错**——fallback spawn + 降级回本地 deep 档 + output 质门校验；无进度 UI 必须接入前补齐。
5. **引擎边界误判踩红线**——写死「自动闸只能升咨询级，真实产线资产升级强制人工确认门」。
6. **记忆召回精度天花板**——结构化键 + 两层切 + 后续 hybrid_retrieval；摘要质量直接决定复利质量需把关。
7. **Hermes 会诊网关 key blocker 未解**——刻意不依赖它（只吃免费记忆层），军机处深度暂受限于现有 swarm，可接受但须明示。

## 7. 真实锚点
- 前端切点：`src/app/api/court/shangshufang/tasks/[taskId]/swarm-deepen/route.ts:84`；adapter 契约 `src/core/courtos/runtime/live-swarm-adapter.ts`；jiqun 范式 `jiqun-live-swarm-adapter.ts:118`；源标守门 `src/core/courtos/source-label.ts`（assertLiveSwarmTrace）；reality 归一 `src/lib/reality/reality-state.ts`；人工确认门 `src/features/governance/lib/gate.ts`。
- 后端 jiqun：记忆层 `src/memory_store.py`/`memory_tool.py`（已织进 flow_engine）；OpenClaw `src/openclaw_client.py` + `flow_engine.py` openclaw step + `manor_groups.py:26` resolved_runtime；6 env `OPENCLAW_{INTEL,CONTENT,FINLAW,RND,EXEC,REVIEW}_URL`；Hermes 会诊网关 `:8644`（需 API key）。
