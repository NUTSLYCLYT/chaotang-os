# 规格说明：docs-chancellor-junjichu-orchestration-design-20260713

丞相→军机处→部→司→蜂群→回奏 编排重构方案

## 背景

现状(2026-07-13 逐行核对代码得出,不是文档臆测)：

- 丞相只做 direct/council 二选一(`ChancellorRoutingService.decide()`),没有"润色"这一步。
- "council"约等于"军机处"，但不是一个真实的评议/选参环节——参与部门靠关键词匹配自动定，没有人或 agent 真的"讨论"过。
- **谁参与是记录的**(`shangshufang_loop.infer_departments()`，写入审计)和**谁真的被执行**(`swarm_execution_loop.route_swarms()`，蜂群实际读)是两套互不知道对方存在的独立关键词表。这是回奏内容"文不对题"的第一根因。
- 蜂群调用没有超时。ThreadPoolExecutor 并发跑部门，单个 future 卡死会无限等，没有边界。这是回奏"可能压根不返回"的根因。
- 御史(设计中的质量闸)完全没接进 outbox→蜂群这条自动链路，是个需要人工调用的孤立端点。回奏从没被这道设计出来的质检卡过。
- "司"这一级，除户部付款审批(会计司→出纳司→预算司三道确定性闸，`hubu_payment_preview.py`)外，全部只是前端文案(`bureau-page-specs.ts`)，没有对应的后端执行/蜂群。
- 部门引擎真假状态：7 个部门(户/兵/吏/刑/礼/锦衣卫/钦天监)有真引擎(确定性优先，失败诚实回退)，工部和御史没有，命中即退化成通用 LLM 角色扮演——但角色扮演和真引擎产出的字段结构完全一样，只有 `source_label` 一个标签能区分(`LIVE_ENGINE`/`LIVE_SWARM`/`FALLBACK`)。
- 本仓库的蜂群执行引擎(`backend/src/`下的 `swarm_execution_loop.py`/`real_department_engines.py`/`ModelAdapter`/`SWARM_DEFS` 注册表，即 jiqun_ai 后端本体)已经是能用的编排底座——本方案是在这套底座上**加一层军机处选参/定标准入口 + 把司级颗粒度接进现有 SWARM_DEFS 模式**，不是另起一套编排系统。
- **(2026-07-13 架构复审补充)** 部门选择的覆盖入口其实已经存在，只是没接上：`run_swarm_execution_loop(params)` 早就接受 `params["department_ids"]`，一旦传入就完全绕开 `route_swarms()` 的关键词扫描(`swarm_execution_loop.py:856-876`)。真正的缺口是调用方 `outbox_worker._execute_council()` 从来没把这个参数传进去(`outbox_worker.py:105-113`)，而它需要的部门列表(`draft_payload["recommended_departments"]`，来自 `infer_departments()`)其实已经在作用域里。也就是说"两套独立关键词表"这个 bug，修复入口比原以为的更小、更精确——不是给 `route_swarms()` 加参数，是给 `_execute_council()` 补一行调用。
- **(复审补充)** 元蜂群(证据审计/红蓝对抗/冲突检测/综合简报/质量闸)不在 `SWARM_DEFS` 里，`route_swarms()` 对它们的关键词匹配结果会被过滤掉，从不参与实际执行——它们在 `run_swarm_execution_loop` 里是硬编码无条件调用(`quality_gate`/`evidence_audit`/`critic_report`/`synthesize_brief` 恒跑，`detect_conflicts` 只看 `council` 开关，不看关键词)。所以军机处不需要替元蜂群做选择。但这也意味着一个已存在的审计记录漏洞：`department_ids` 覆盖生效时，`selected_swarms` 被整体重写成只含被覆盖的部门列表，元蜂群的名字从审计记录里消失——即便它们仍然照常执行。军机处派单会直接继承这个"记录与实际执行不一致"的漏洞，需要单独一个任务去对齐，不能假装它不存在。
- **(复审补充)** 户部付款审批的三道闸(会计/出纳/预算)不是三个可以独立并发调用的司，是三个纯函数共享同一份结构化 `case` 输入、由 `build_hubu_memorial()` 统一做跨闸综合判定(`hubu_payment_preview.py:278-327`)。而且 `adapt_hubu_payment` 要求这份结构化 case 已经嵌在文本里(`_extract_payment_case`)，自由文本的圣旨/refined_edict 拿不到——所以"部→司→蜂群"这条链路如果让户部三司各自独立调用引擎，需要先补一个 case 拆分器，再在部门汇总层重写跨司综合判定逻辑，这是净新工程，不是"包一层就行"。吏部的任免/招聘两条引擎吃自由文本(`adapt_libu_appointment`/`adapt_libu_recruit`)，没有这层耦合，是更干净的试点起点。

## 设计原则(顶尖大神做法，逐条落到本方案的具体机制)

1. **单一事实源**(Google Borg/K8s 调度器模式 + Stripe 幂等决策记录)——军机处的选参/定标准输出是唯一权威记录。落地方式：`_execute_council()` 把军机处产出的 department_ids 传进 `run_swarm_execution_loop(params={"department_ids": ...})`，走已经存在的覆盖入口(见"背景"复审补充)，`route_swarms()` 本身不用改。杀掉现在两套独立推断中的一套，不是新增第三套——同时要顺手补上"覆盖生效时元蜂群从审计记录消失"这个已存在的次生漏洞。
2. **质量内建于流程，不是事后抽查**(丰田 Andon 绳/Jidoka)——御史校验做成 outbox 链路里的默认节点，不是可选旁路端点。
3. **风险分级自动闸，不是一刀切**(Stripe Radar)——`route_department_task()` 算出的复杂度分数接一个真实下游动作：低风险自动放行，高风险(命中付款/合同/对外承诺关键词或分数超阈)强制过御史。
4. **先 shadow mode 再真拦截**(Uber/LinkedIn 灰度)——御史新增的强制节点先"只记录判断，不阻断"，跑一段时间看误判率，确认可控再切成真正拦截，避免上线当天打崩现有 council 流程。
5. **诚实标注不可绕过**(本仓库已有的 sourceLabel 铁律，延伸到编排层)——军机处产出的"标准文档"必须包含"这条回奏允许的最低真实度"(如：允许纯 LLM 角色扮演 / 必须真引擎 / 必须过御史)，不是事后才知道这条回奏是编的还是算的。

## 编排流程(重构后，端到端)

```
① 上书房下旨(用户原文)
        │
② 丞相润色 —— 新增：LLM 重写/澄清圣旨文本，输出 refined_edict。复用现有
   ModelAdapter，不新建 LLM 调用层。draft-edict 阶段追加，不是新端点。
        │
③ 丞相路由 —— 现有 ChancellorRoutingService.decide()，direct/council 二选一不变。
   direct 仍然同步出结果，不进军机处。
        │  (council 分支)
④ 投递军机处 —— 新增阶段：写入 OutboxEvent 之前，先落一条 JunjichuDeliberation
   记录(新表，见"军机处设计")。
        │
⑤ 军机处评议 —— 新增：一次 LLM 调用(或规则+LLM 混合)，输入 refined_edict +
   六部/司花名册，输出：
     - participants: [{department, offices: [...], reason}]  ← 唯一选参结果
     - output_standard: {required_sections, min_confidence, requires_yushi}
   这个输出**取代**现有 infer_departments()/route_swarms() 的关键词匹配，
   两者其一保留做兜底(军机处调用失败时的 fallback，不是并行决策源)。
        │
⑥ 军机处→部 —— `outbox_worker._execute_council()` 把军机处的 participants 转成
   department_ids，传进 `run_swarm_execution_loop()` 已有的覆盖参数(不新建入口)，
   逐部门下发，携带 output_standard；同时把 `selected_swarms` 审计记录里的元
   蜂群名字补回去(修复复审发现的既有漏洞，见"背景")。
        │
⑦ 部→司 —— 新增司级分发：部门 orchestrator 按军机处选中的 offices 逐个调用，
   而不是像现在这样部门整体调一次蜂群。
        │
⑧ 司→蜂群 —— 每个司对应一个 SWARM_DEFS 条目(复用现有注册表结构，新增司级
   entry，不是新建注册机制)。蜂群多智能体产出结果，**必须带超时**——
   **(2026-07-13 复审修正)这不是"加个 timeout 参数"能解决的**：
   `TimeoutError` 是 `Exception` 子类，会被现有的通用 except 捕获后原地串行
   重跑同一个引擎(`swarm_execution_loop.py:817-824`)，等于把挂起从并发换成
   串行，没有真的设上限；而且 `ThreadPoolExecutor` 退出时会 join 住卡死的
   线程，就算 future 层面正确超时，池子本身也走不掉。真正能落地的做法是把
   超时下推到每个引擎自己的网络/LLM 调用层(`ModelAdapter`/Tavily 客户端的
   请求级 timeout)，配合把 `TimeoutError` 从通用 except 里单独摘出来处理
   (标记该司未完成，不做无界串行重跑)。这是一块真实的新工程，不是复用件。
        │
⑨ 蜂群→司(形成报告) —— 司层做一次轻量聚合/摘要，不是简单转发蜂群原始输出。
   复用现有 _court_doc_to_ministry_contract() 的归一化模式，司报告结构与
   现有部门输出同构(swarm_id/position/summary/...)，多一层 office_id 字段。
        │
⑩ 司→部(汇总) —— 部门把多个司报告合并，复用现有 ministry_outputs_from_swarm()
   聚合逻辑，扩展出 office_reports 子数组，部门身份和司身份都不丢。
        │
⑪ 御史闸(新增，shadow mode 起步) —— 部门汇总产出后，按 output_standard 里
   requires_yushi 标志决定是否强制过 /api/yushi/review 等价逻辑(初期只记录
   判断，不阻断，见"设计原则4")。
        │
⑫ 部→军机处→丞相 —— 现有 persist_swarm_execution_result +
   attach_swarm_result_to_review 不变，memorial_json 结构扩展 office_reports
   和 yushi_shadow_verdict 两个字段，不破坏现有前端读取路径。
        │
⑬ 回奏呈现 —— 上书房/史馆展示，source_label 和 yushi 判断在呈现层做成
   显著区分(不只是数据里有，UI 上要看得出来)，呼应设计原则5。
```

## 复用 vs 新建

| 环节 | 复用(jiqun 已有) | 新建 |
|---|---|---|
| LLM 调用 | `ModelAdapter`、`get_active_provider()` | 无 |
| 部门引擎适配器 | `real_department_engines.py` 全部 7 个 adapter | 无(司级复用同一批 adapter，按结构化子输入调用) |
| 蜂群注册表 | `SWARM_DEFS`、`_SWARM_ID_DEPT` | 新增司级 entry(如 `hubu_budget_office_swarm`) |
| 并发编排 | `ThreadPoolExecutor` 并发跑部门/司 | **真实新工程**(不是加参数)：超时下推到引擎级网络调用 + 单独处理 TimeoutError，见流程步骤⑧ |
| 结果归一化(swarm→部门契约) | `_court_doc_to_ministry_contract()`(`real_department_engines.py:121`) | 扩展出 office 层归一化模式(结构同构，加 office_id) |
| 结果归一化(部门→回奏) | `ministry_outputs_from_swarm()`(`shangshufang_loop.py:269-313`) | 扩展出 `office_reports` 子数组 |
| 部门选择覆盖入口 | `run_swarm_execution_loop(params["department_ids"])`(`swarm_execution_loop.py:856-876`)——已存在，只是没被调用方用 | 一行调用：`_execute_council()` 把军机处结果传进去 |
| 结果持久化 | `persist_swarm_execution_result`/`attach_swarm_result_to_review` | 扩展 `memorial_json` schema，不改现有字段 |
| 选参/路由 | — | 军机处评议(新 LLM 调用 + 新表 `JunjichuDeliberation`) |
| 御史强制挂载 | `web/routers/yushi.py` 现有校验逻辑 | 挂载点(outbox_worker 里新增调用，shadow mode) |

**结论(2026-07-13 复审后修正)**：真正新建的是"军机处评议"、"超时下推工程"、"户部三司的 case 拆分器+跨司综合判定重写(如果做户部)"——比最初以为的更多一点，但部门选择覆盖、结果归一化、结果持久化这几块确实是复用现有入口，不是重新发明。

## 智能体设计(司级蜂群契约)

每个司级蜂群 = 现有 `SWARM_DEFS` 注册表的一条新 entry，遵循和现有部门级蜂群完全相同的契约，不发明新格式：

```python
{
    "swarm_id": "hubu_budget_office_swarm",   # 命名规则：{部门}_{司}_swarm
    "department": "户部",
    "office": "预算司",
    "keywords": [...],                         # 军机处选参失败时的 fallback 匹配
    "engine_fn": adapt_hubu_budget_office,      # 新 adapter，复用 hubu_budget.py 的
                                                 # budget_gate() 逻辑包一层统一契约
    "persona_prompt": "...",                    # LLM 角色扮演兜底用，同现有模式
    "timeout_seconds": 30,                      # 新增，无真引擎命中时的 LLM 调用上限
}
```

输出契约不变(沿用 `_court_doc_to_ministry_contract()` 的字段集)，新增两个字段：
- `office_id`：标明这条输出来自哪个司，不是笼统的部门输出。
- `engine_tier`："real" | "llm_roleplay" | "rule_template"——比现有 `source_label` 更直白的真实度标签，呈现层直接用它决定要不要显著标注"这段是 AI 编的"。

## 军机处设计(新增核心组件)

**职责**：评议 + 选参 + 定输出标准。不执行任何部门/司逻辑，只产出决策记录。

```python
class JunjichuDeliberation:
    task_id: str
    refined_edict: str              # 丞相润色后的文本
    participants: list[Participant] # 唯一选参结果，取代 infer_departments/route_swarms
    output_standard: OutputStandard
    created_at: datetime
    fallback_used: bool             # 军机处 LLM 调用失败时，是否退化到关键词匹配

class Participant:
    department: str
    offices: list[str]              # 具体司；空列表=部门级整体处理(无司级拆分部门的兼容路径)
    reason: str                     # 为什么选这个部门/司(可解释性，回奏呈现用)

class OutputStandard:
    required_sections: list[str]    # 回奏必须包含哪些部分
    min_confidence: float
    requires_yushi: bool            # 命中高风险关键词或复杂度超阈值时置真
    max_execution_seconds: int      # 传给下游超时参数
```

失败处理：军机处 LLM 调用失败或超时 → `fallback_used=True`，退化到现有 `route_swarms()` 关键词匹配 —— 这是唯一允许两套逻辑并存的场景(降级路径，不是并行决策)。

## 各部门设计(全量，按试点优先级排序)

| 部门 | 现状 | 司级设计 | 优先级 |
|---|---|---|---|
| **户部** | 报价/付款/现金流三选一真引擎；付款路径已有会计/出纳/预算三道真闸 | **(2026-07-13 复审修正，原判"净新工作量最小"不成立)** 三道闸是纯函数没错，但共享同一份结构化 `case` 输入，由 `build_hubu_memorial()` 统一做跨闸综合判定——拆成三个各自独立调用的司需要先补 case 拆分器，再在部门汇总层重写跨司综合判定，是真新工程。且自由文本圣旨拿不到这份结构化 case，只有已经走过付款关键词+结构化输入的场景才摸得到这条链路 | P1(吏部试点验证通过后再做) |
| **吏部** | 任免/招聘二选一真引擎，`adapt_libu_appointment` 优先于 `adapt_libu_recruit`(短路，正常情况下至多一个引擎跑) | 任免司(`libu_appointment_vet`)、招聘司(`libu_vet`)——两条引擎都吃自由文本，无结构化输入耦合，是更干净的试点起点。**注意**：拆成两个独立 SWARM_DEFS 后，如果军机处同时选中两司，两个引擎会并发都跑，这是对现有"任免优先短路"语义的行为变更，需要在军机处评议或部门汇总层显式决定要不要保留互斥 | **试点 P0(唯一起步试点)** |
| **兵部** | `bingbu_battlecard` 单流程真引擎 | 报价司、线索司(V1 已注册两个 office 名，`chaotang-v1-modules.ts`)——需要把单流程拆成两段，有一定拆分成本 | P1 |
| **刑部** | 合同核验优先，退化通用裁决 | 合同司(已注册)——单一司，拆分成本低 | P1 |
| **礼部** | `lipu_vet` 品牌策略核验(命中关键词才触发) | 关系台账/流量增长/对外承诺可逆/商务公关四个——**注意**：本会话已建的 4 个 office-kit 前端 tab 是纯客户端 LOCAL 工具，和这里说的"司→蜂群"后端链路是两套不相干的东西，不能直接复用，需要单独判断要不要把两者打通 | P2 |
| **工部** | **无真引擎**，靠关键词回退成规则模板/LLM 角色扮演 | 产研司(已注册)——建司之前得先补真引擎，不然司级结构包装的是假内容 | P2(先补引擎，再建司) |
| **锦衣卫** | `jinyiwei_agent`+Tavily 真搜索，且是唯一"先跑、结果注入其他部门输入"的特权部门 | 暂不拆司——它的输出是给其他部门用的情报底座，拆司意义不大，维持部门级整体调用 | 不纳入本轮 |
| **钦天监** | `tianjian_verdict` 真引擎，但只走 L3 大臣路径，蜂群 L4 层没接 | 暂不纳入——先把 L4 接上再谈司级拆分 | 不纳入本轮 |
| **御史** | 无真引擎，且完全没接进自动链路 | 不是常规意义的"司"，是横切质量闸，见"军机处设计"里的 `requires_yushi` | 本轮核心新增对象，但不算部门司 |

## 试点范围详细设计：吏部(主试点)+ 户部(验证通过后的第二试点)

**(2026-07-13 复审后调整)** 原方案把户部和吏部并列为 P0，复审发现户部三道闸共享结构化输入、由统一函数做跨闸综合判定，拆司需要真新工程(case 拆分器 + 综合判定重写)，风险和工作量都比吏部高一截。改成吏部单独起步，跑通"军机处→部→司→蜂群→司报告→部汇总"整条链路的骨架后，再决定要不要、怎么给户部做那层新工程。

**吏部试点验收标准**：
- 一条招聘相关圣旨，军机处选中 `offices: ["招聘司"]`(不触发任免司)——验证军机处能做"部分司参与"的选择，不是非黑即白的整部门参与。
- 一条同时命中任免+招聘关键词的圣旨，军机处同时选中两司——**显式验证两个引擎并发跑时的行为**(是否需要保留现有"任免优先短路"语义，还是接受两者都出结果、在部门汇总层再做取舍)，这是复审发现的行为变更点，必须有测试覆盖，不能默认忽略。
- 超时测试：mock 一个卡死的司级蜂群调用，验证整体流程不会无限挂起(依赖阶段0.1的超时工程先落地)。

**户部第二试点(吏部跑通后再排期，不在本轮 P0)**：
- 需要先完成：payment case 拆分器(把结构化 case 拆成会计/出纳/预算各自的输入片段)、部门汇总层的跨司综合判定重写(替代现有单体 `build_hubu_memorial()`)。
- 验收标准：一条命中付款关键词**且带结构化 case** 的圣旨，经军机处评议后 participants 里出现 `{department: "户部", offices: ["会计司","出纳司","预算司"]}`，三司分别产出带 `office_id` 的报告，`memorial_json.ministry_outputs[0].office_reports` 长度为 3，且跨司综合判定(traffic-light)结果与现状 `build_hubu_memorial()` 的输出一致(回归验证，不能因为拆分改变了最终裁决结果)。

## 可靠性修复清单(本方案顺带解决的既有 bug，不是新增范围)

1. 两套独立关键词表分叉 → `_execute_council()` 把军机处结果传进已存在的 `department_ids` 覆盖入口，见"设计原则1"和"背景"复审补充。
2. 蜂群调用无超时 → **真新工程**：超时下推到引擎级网络/LLM 调用，TimeoutError 从通用 except 里单独摘出来处理，不是加个参数，见流程步骤⑧。
3. 元蜂群从审计记录消失(覆盖生效时的既有次生漏洞，复审新发现) → `selected_swarms` 记录要把元蜂群名字补回去，跟部门覆盖逻辑一起改。
4. 御史未接入自动链路 → shadow mode 挂载，见"设计原则2/4"。
5. 真引擎/LLM角色扮演结构无法区分 → `engine_tier` 字段 + 呈现层显著标注。

## 非目标

- 不重建现有 jiqun 编排引擎(ModelAdapter/SWARM_DEFS/线程池并发全部复用)。
- 不在本轮把御史 shadow mode 直接切成强制拦截——先跑一段时间看误判率。
- 不在本轮给锦衣卫/钦天监拆司——先验证户部/吏部两个试点跑通再决定要不要推广。
- 不把本会话已建的礼部 4 个 office-kit 前端 LOCAL 工具直接当成"礼部的司"接入这条后端链路——两者关系需要单独决策，本方案不预设。

## 验收标准

- 吏部试点跑通，满足上面的验收标准(含"两司同时选中"的并发行为测试)。
- `infer_departments()` 的结果通过 `_execute_council()` 真正驱动 `run_swarm_execution_loop` 的部门选择(不是两套独立推断继续并行)，且 `selected_swarms` 审计记录里元蜂群名字不丢。
- 新增司级蜂群调用全部带超时，可通过故意卡死一个 mock 引擎验证不会拖死整个 council 流程(超时下推到引擎级调用，不是 executor 层加参数)。
- 御史 shadow mode 判断被记录(哪怕不阻断)，可查询到"如果强制拦截，这条回奏会不会被挡下"。
- 户部第二试点(如排期)：拆司后的跨司综合判定结果与现状 `build_hubu_memorial()` 输出一致，无回归。

## 验证计划

- 单测：军机处评议的 fallback 降级路径(LLM 调用失败时正确退化到关键词匹配)。
- 单测：吏部任免+招聘两司同时被选中时的并发行为，显式断言是否保留互斥语义。
- 单测：司级蜂群超时后，父级 orchestration 能正确标记该司为"未完成"而不是无限挂起，且不触发无界串行重跑。
- 集成：吏部招聘场景端到端跑一次，核对 `memorial_json` 里 office_reports 结构。
- 人工核对：御史 shadow mode 跑一批历史 council 结果，统计和现状的判断差异率，作为要不要切换成强制拦截的依据。
