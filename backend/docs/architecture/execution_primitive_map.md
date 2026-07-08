# 执行原语映射:各单位该用 系统/LLM/agent/工作流/蜂群(按复杂度)+ 大神/skill 配置

> 2026-07-01。从上书房到各司,评估每单位该用哪种执行原语,配大神 + 前沿 skill,保质量与效率。
> 判定接已建的 P0–P3 分档(`resource_router`/`difficulty_assessor`):重器只为大事出鞘。

## 一、五种执行原语(先分清,别混用)

| 原语 | 是什么 | 何时用 | 成本 |
|---|---|---|---|
| **系统(确定性码)** | 无 LLM,纯计算/规则 | 可算/可查的(重算、门禁、路由、留痕) | 极低,可验证 |
| **LLM(单调用)** | 一次模型调用,无编排 | 一句话判断/生成(直答、话术、抽取) | 低 |
| **agent(单 agent+工具)** | LLM + 工具 + 多轮 | 开放式、需检索+推理的单线任务 | 中 |
| **工作流(flow)** | 确定性多步管线,步内可 LLM | 多步但线性、可复用、要标准化 | 中 |
| **蜂群(多 agent)** | 多 agent 并行/对抗/会审 | 高风险、需多视角/分歧涌现 | 高 |

**铁律**:能用系统就别用 LLM;能用单 LLM 就别开工作流;能用工作流就别开蜂群。蜂群只为 P2/P3 大事出鞘。

## 二、从上书房到各司(全院映射)

| 单位 | 主用原语 | 为什么(复杂度) | 大神 | 前沿 skill |
|---|---|---|---|---|
| **上书房/丞相** | agent + 系统(分档) | 单门面编排:分档=系统,拟旨/收口=LLM,派活=调工作流/蜂群 | munger/drucker/bezos | agent-harness-construction |
| **钦天监** | 系统(前置门)+ 蜂群(会审) | 不可逆才出鞘:签字闸=系统,3问+情景=蜂群多视角 | taleb/kahneman/munger | complex-problem-first-principles |
| **御史** | **系统(规则门)** + 抽查 agent | 定灯=确定性规则(100%便宜),抽查=agent 采样 | schneier/posner/deming | security-and-hardening |
| **史馆** | 系统(归档/留痕)+ 工作流(飞轮) | 归档=确定性,复盘飞轮=工作流,检索=agent | deming/andrew-ng | eval-harness |
| **刑部** | **工作流** + 蜂群(红蓝) | 判决=flow_legal 多步,红蓝对抗=蜂群,接地=系统检索 | posner/schneier | security-scan |
| └ 律师团(6司) | LLM + 系统(RAG检索) | 单律师=LLM,法条命中=系统检索(lawyer_rag) | 各专科律师 | source-driven-development |
| **户部** | **系统(重算)** + LLM(解读) | 现金流/成本=确定性重算(禁假PASS),解读=LLM | ben-graham/dalio/deming | cost-aware-llm-pipeline |
| └ 会计/出纳/预算司 | 系统 | 全是可算的数字门 | drucker | — |
| **工部** | **系统(重算门)** + 工作流 | pack_rd 重算=确定性,验收=flow_sdlc/gongbu_review | kent-beck/martin-fowler | code-review-and-quality |
| **礼部** | LLM(单调用) | 话术/文案生成,多版本 | zhang-xiaolong/seth-godin/paula-scher | brand-voice |
| **兵部** | agent + 工作流 | 客户战情=agent 多轮,推进=flow_haolong/opc | chris-voss/neil-rackham/aaron-ross | deep-research |
| **吏部** | 系统(权限/eval)+ LLM | 权限/绩效=确定性(persona_eval),任免建议=LLM | drucker | — |
| **钦天监(情报侧)/锦衣卫** | **agent + 系统(vet门)** | 情报采集=agent 联网,可信度分级=系统(jinyiwei_vet) | schneier/soros/taleb | parallel-deep-research |

## 三、按复杂度的通用配方(P0–P3)

| 档 | 用什么 | 例 |
|---|---|---|
| **P0 琐碎/事实** | 系统 或 单 LLM | "退货政策?" → 单 LLM;"现金跑道?" → 系统重算 |
| **P1 需一个视角** | 单 LLM + 1 大神 | "这定位有问题吗" → LLM + 1 大神 skill |
| **P2 部门产出** | 工作流(+ 蜂群会审) | 合同审 → flow_legal + 军机处蜂群 |
| **P3 不可逆/跨部门** | 蜂群 + 钦天监 + 签字 | 上线/大合同 → 全院会审 + 人签 |

## 四、匹配现状(哪些到位、哪些待补)

- ✅ **系统层最全**:户部重算、工部 pack_rd、御史 rules 门、token 监控、分档路由、lawyer_rag——确定性活干得好。
- ✅ **工作流**:33 个 flow_*.yaml 覆盖各部门标准审查。
- ⚠️ **蜂群**:军机处会审刚"通电"(mock→真 LLM,开关驱动),网关一通即真多智能体。
- 🟡 **agent(单agent+工具)**:锦衣卫情报 agent 已通电(`src/jinyiwei_agent.gather_intel`:检索→vet分级→court_doc,检索源可注入)。仍待:接真实联网检索源(WebSearch/爬虫),兵部战情 agent 的多轮工具编排。
- ✅ **大神**:40 位分席 + 14 位配 eval 判例(35%),刑部法务面板全覆盖。

## 五、保质量与效率的三条口径

1. **原语下沉**:每个单位先问"能不能用更便宜的原语"——户部/工部/御史都靠系统(确定性),不烧 LLM。
2. **skill 只推真实、最多2个**:上表 skill 均为在册技能,按单位性质挂,别泛推。
3. **大神只参谋不放行**(C2):skill/大神辅助质量,但定灯/放行永远是系统规则。

> 一句话:**系统干确定的、LLM 干判断的、工作流干标准的、蜂群干高危多视角的、agent 干开放检索的——按复杂度分,重器只为大事出鞘,这就是质量与效率的平衡点。**
