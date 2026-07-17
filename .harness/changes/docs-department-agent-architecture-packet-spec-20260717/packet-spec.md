# 部门 Agent 架构 — Packet 任务书（5件，供业主批 + 交 Codex 执行）

> 来源设计：`docs/plans/chaotang-os-department-agent-architecture-2026-07-17.md`
> 本文档只做任务拆分和验收标准定义，不执行任何代码改动。
> 执行纪律沿用现行campaign规则：Codex唯一写入者，一个Packet一个change一个任务分支，
> Claude Code只读复审，没有GO不开下一个。

## 依赖图

```
PKT-1 工部真实引擎        （无依赖，可独立先做，杠杆最高）
PKT-2 路由身份收口         （无依赖，是 PKT-3/PKT-5 的前置条件）
PKT-3 门下省veto gate     （依赖 PKT-2）
PKT-4 六部反幻觉铁律       （无依赖，可与 PKT-1/2 并行排期，但campaign单线纪律下仍需排队）
PKT-5 丞相LLM路由推荐层    （依赖 PKT-2 + PKT-3）
```

建议执行顺序：PKT-1 → PKT-2 → PKT-4 → PKT-3 → PKT-5（杠杆最高的先做，前置条件插在依赖它的包前面，PKT-4机械且独立所以见缝插针）。

---

## PKT-1：工部真实引擎（type: feat, name: gongbu-storage-pipeline-engine）

**范围**：把 `backend/agent_design/buildAgent/储能售后蜂群/` 5阶段流水线设计
（故障分诊员→数据采集员→BMS诊断师→现场失效分析师→处置工单生成器）抽象为
`real_department_engines.py::adapt_gongbu()`，挂进 `REAL_ENGINE_ADAPTERS[canonical_name("gongbu")]`
（当前该 key 不存在，工部是六部中唯一无真实引擎的部门）。

**步骤**：
1. 读5个角色目录的`AGENTS.md`+`SOUL.md`+`TOOLS.md`（如有），提炼每阶段的输入契约、
   输出模板、工具调用点。
2. 按`adapt_hubu`/`adapt_lipu`已有模式实现`adapt_gongbu(task_text) -> dict | None`——
   五阶段可以先做成单函数内的顺序处理，不强求逐阶段拆独立子函数，除非现有模式(如
   `adapt_lipu`的双分支)提示应该拆。
3. 移植"热失控/冒烟/漏液→强制P0"这类硬编码安全阈值到工部的风险判定路径
   （对照`shangshufang_loop.py::RISK_RULES`是否已有等价项，没有则新增）。
4. 移植"数据缺口显式标`[missing]`"的模式——对照现有`unknown_gaps`机制，复用不重造。
5. 挂载到`REAL_ENGINE_ADAPTERS`，同时检查`_SWARM_ID_DEPT`/`_MINISTER_CODE_DEPT`
   两条L4/L3映射表是否需要同步登记（参照`real_department_engines.py:858-877`注释）。

**验收**：
- `.claude/skills/dept-capability-map/scripts/audit.py` 重跑后工部一行显示真实引擎函数名，
  不再是"无(None兜底)"。
- 覆盖工部真实业务场景（储能/BMS故障类）的RED→GREEN测试。
- 全量回归无新增失败（对照当前 known-red 基线，不引入新红灯）。

**回滚**：`REAL_ENGINE_ADAPTERS`里删掉这一行entry，工部退回`None`兜底现状，无其他副作用。

**阻断条件**：无——本Packet不依赖PKT-2/3。

---

## PKT-2：路由身份收口（type: refactor, name: department-router-canonical-consolidation）

**范围**：解决"三份路由实现互不同步"问题——`shangshufang_loop.py::DEPARTMENT_RULES`、
`departments.yaml::routing_keywords`、`chaotang_department_router.py::route_department_task`。

**步骤**：
1. 排查`chaotang_department_router.py`的真实调用方（谁在用`route_department_task`/
   `score_ministry`），产出影响面清单——这一步之前设计文档明确标注"未做"，必须先做。
2. 确认canonical：`departments.yaml`+`dept.ts`（mainline-absorption-review已裁定）。
3. `DEPARTMENT_RULES`关键词表改为从`departments.yaml routing_keywords`生成
   （或反向——以现状哪份维护更活跃、测试覆盖更全为准，不是本Packet凭空指定，需Codex
   核实后在change记录里写清楚选了哪个方向、为什么）。
4. `chaotang_department_router.py`按PKT-2-步骤1的影响面结论，降级为canonical的只读
   adapter，或标记deprecated——不得继续作为独立决策权威。
5. 单独排查兵部关键词表"完全不重叠"的具体原因（两表在描述不同匹配逻辑，还是纯历史
   遗留），排查结论决定合并时怎么处理这一项，不能不查就硬合并。

**验收**：
- `.claude/skills/dept-capability-map/scripts/audit.py`重跑后所有部门"关键词同步"列显示
  "完全一致"。
- `chaotang_department_router.py`调用方清单落盘（change记录里），处置方式（adapter化/
  deprecated）有明确依据。
- 全量回归无新增失败。

**回滚**：关键词表改动可revert；`chaotang_department_router.py`降级如果发现有生产依赖，
先做adapter包装而非直接删除,可随时切回。

**阻断条件**：步骤1（影响面排查）结果如果发现`chaotang_department_router.py`有重度生产
依赖且短期不可替换，本Packet范围收窄为"只做adapter包装，不做deprecated"，并把完整退役
移到独立后续Packet，不得为了赶进度跳过排查直接删代码。

---

## PKT-3：门下省 veto gate（type: feat, name: menxiasheng-routing-veto）

**范围**：移植`backend/agent_design/buildAgent/三省六部体系/门下省/SOUL.md`的四维审议
+封驳/准奏模式，插入丞相路由决定和军机处派单之间，作为独立agent。

**步骤**：
1. 定义结构化输出schema（JSON schema强制，不是靠prompt嘱咐）：
   `{verdict: "封驳"|"准奏", dimensions: {可行性,完整性,风险,资源}各带理由,
   reroute_suggestion: string|null}`。
2. 新增独立审议函数/agent调用点，输入=丞相的路由决定(`chancellor_decide_route`输出)，
   不是原始旨意文本——门下省审的是"这个路由决定对不对"，不是重新分析旨意。
3. 接入点：`chancellor_decide_route`返回后、`军机处`/六部真实派单前，插入门下省调用；
   封驳→退回丞相重判（复用"世界杯"bug里已确认存在的路由空转风险，最多3轮，第3轮
   强制准奏，照抄原设计的限流机制）。
4. 落库封驳理由和四维评分（不只留布尔值）——为将来"门下省封驳率"这类运营指标预留字段。

**验收**：
- 用第0节"世界杯"bug原始输入回归：门下省应对"户部+工部"这个路由决定给出封驳，
  理由包含"不属于任何部门真实职责范围"。
- 正常业务路由（如真实合同审查请求）门下省应准奏，不产生额外延迟到不可接受程度
  （需定验收阈值，Codex执行时给出实测数字）。
- 3轮强制通过的边界情况有测试覆盖。

**回滚**：门下省调用点加feature flag，关闭后路由流程回退到PKT-3之前的直通状态。

**阻断条件**：依赖PKT-2完成（门下省审议需要读取canonical的部门边界声明，如果三份路由
表还没收口，门下省会审出跟丞相不一致的部门边界，产生新的判断分歧）。

---

## PKT-4：六部反幻觉铁律（type: feat, name: department-anti-hallucination-clause）

**范围**：把`agent_design/buildAgent/三省六部体系/`各SOUL.md末尾"明朔皇上的永久规则"
（DONT/MUST/反幻觉协议三段）改写适配后，焊进六部部长agent的system prompt尾部——
现状只有礼部靠`lipu_vet`有对应机制。

**步骤**：
1. 提炼通用条款（不编造数据/结论前置/数据带来源/不确定就明说/时效性任务必须用工具），
   去掉原设计里跟飞书看板CLI绑定的部分（那是`/home/ubuntu/.openclaw/`环境专属，不适用
   本仓库）。
2. 逐部门system prompt/persona定义处（`DIRECT_AGENT_MAP`对应的人设prompt来源）追加
   统一段落。
3. 户部/工部（这两个部门在"世界杯"bug里被误路由后瞎编过回奏）优先，其余部门跟进。

**验收**：
- 用"世界杯"bug原始输入直接打到户部/工部LLM兜底路径（绕开PKT-2/3，单独测这层）：
  应输出"不确定/超出职责范围"类回答，不再编造具体行程或预算数字。
- 六个部门system prompt都能追溯到同一份铁律来源（不是六份各自誊抄的独立文本）。

**回滚**：system prompt追加内容可整段revert，不影响其他逻辑。

**阻断条件**：无。

---

## PKT-5：丞相 LLM 路由推荐层（type: feat, name: chancellor-llm-routing-recommendation）

**范围**：`chancellor_decide_route`旁增加LLM推荐层，实现`CHAOTANG_CONVERGENCE_GUIDE.md`
3.2节"模型可以推荐等级和理由，但风险硬门必须确定性裁决"这条现有文档承诺、当前代码
从未实现的公式。

**步骤**：
1. 保留现有确定性风险硬门代码不动（`HIGH_RISK_FLAGS`等命中即强制D2的部分）。
2. 新增LLM推荐调用：context=六部+锦衣卫边界声明（来自PKT-2收口后的canonical来源），
   结构化输出（候选部门[]/D级建议/置信度/或`UNSUPPORTED_SCOPE`），JSON schema强制。
3. 合并公式：`最终D级 = max(硬门, LLM建议, 用户指定)`，写成显式可测的函数，不是散落
   在多处的隐式逻辑。
4. LLM推荐失败（超时/解析失败）时的降级路径要显式定义——不能静默退回纯关键词匹配，
   必须标注"本次判定降级为确定性规则,推荐层不可用"，避免制造新的隐藏MOCK/FALLBACK。

**验收**：
- "世界杯"bug原始输入：LLM推荐层应直接输出`UNSUPPORTED_SCOPE`,不再进入
  "户部+工部"硬编码兜底路径（`shangshufang_loop.py:170-171`那行兜底代码应在这条路径
  上不再被触发，或改为LLM推荐层失败时的最终保底,并标注清楚这是降级状态）。
- 高风险场景（合同/金额/人事关键词）无论LLM推荐什么,最终D级仍强制为D2——用对抗性
  测试确认硬门不可被模型绕过。

**回滚**：LLM推荐层整体feature flag，关闭后`chancellor_decide_route`回退到纯确定性
规则（即PKT-5实施前状态）。

**阻断条件**：依赖PKT-2（边界声明来源需canonical）+ PKT-3（门下省要能审LLM推荐层的
输出，两层都改的话应先有门下省兜底再上LLM推荐，否则LLM推荐层出错时无第二道防线）。

---

## 队列裁决（业主逐项勾选，本文档不代业主做决定）

| Packet | 是否批准插队（跳过FULL_COURT_V2_BACKLOG，提前于/并行于P6-P9执行） | 业主签字位 |
| --- | --- | --- |
| PKT-1 工部真实引擎 | ☑ 是（2026-07-17，业主在对话中确认"同意天才建议"，采纳Andy Grove视角"先批杠杆最高、无依赖、可独立回滚的一项，用真实结果校准其余四项优先级") | 业主（对话确认，非文件内手写签字） |
| PKT-2 路由身份收口 | ☐ 是 ☐ 否，进V2_BACKLOG | |
| PKT-3 门下省veto gate | ☐ 是 ☐ 否，进V2_BACKLOG | |
| PKT-4 六部反幻觉铁律 | ☐ 是 ☐ 否，进V2_BACKLOG | |
| PKT-5 丞相LLM路由推荐层 | ☐ 是 ☐ 否，进V2_BACKLOG | |

PKT-1 已批准，其余四项未勾选前维持DRAFT——PKT-1 执行完成、拿到真实RED/GREEN证据后，
再回来重新裁决 PKT-2~5 的优先级，不在没有执行数据的情况下一次性批完五项
（同上 Andy Grove 视角）。Codex 现在只应认领 PKT-1，不应视本次批准为对 PKT-2~5 的默许。
