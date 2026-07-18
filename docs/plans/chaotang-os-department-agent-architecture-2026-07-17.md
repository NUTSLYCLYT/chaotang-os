# 朝堂 OS 部门 Agent 架构设计（丞相/门下省/六部部长）

> 文档状态：设计提案，非已批准执行计划（2026-07-17）
> 权威状态：`REFERENCE_INPUT_ONLY`；41 司当前只由产品宪法定义为 `TARGET_DIRECTORY_V1`，本文不授权实现或排期
> 产出方式：Claude Code 只读分析 + 代码级核实（非猜测，全文附文件路径引用）
> 当前产品依赖：[`docs/product/PROJECT_PRODUCT.md`](../product/PROJECT_PRODUCT.md) 与 [`R0/R1 PRD`](../product/releases/product-r0-trusted-kernel/PRD.md)
> 历史依赖：`.harness/changes/docs-full-court-v1-strategy-20260714/`（其 FULL_COURT 范围裁决已被替代，工程事实保留）
> 关系：本文档不改变已批准的执行优先级（P0–P9 归并战役），是对**六部与丞相路由子系统**
> 应该长成什么样的一份完整设计提案；任何采纳必须进入 Solution Pack PRD 或 M0–M10 amendment，不再进入已关闭的 V2_BACKLOG。
> 现状数据来源：`.claude/skills/dept-capability-map/scripts/audit.py`（可重跑，非快照）

---

## 0. 起因：一个真实 bug 暴露的系统性缺口

用户下旨"我要去美国看世界杯决赛"，实际路径（`backend/src/shangshufang_loop.py`）：

1. `infer_departments()`(160-174行) 六部关键词零命中
2. 零命中触发硬编码兜底：`if not departments: departments = ["户部", "工部"]`(170-171行)——**不是拒绝，是硬塞**
3. `chancellor_decide_route()`(501-563行) 判定 `mode=cluster`，路由进军机处
4. 户部/工部真实引擎(`real_department_engines.py`)结构化输入全部不命中，返回 `None`
5. 退化到 `provider.get_active_provider()` 裸调用 LLM，顶着户部/工部人设瞎编一份"世界杯之旅"回奏

全仓搜索确认：路由代码里**不存在**任何"超出六部能力范围"的诚实拒绝路径
(`UNSUPPORTED_SCOPE`/`NO_MATCH`/"不支持范围" 零命中)。

这不是孤立 bug，是三个系统性缺口的必然结果：

- **缺口 A**：`chancellor_decide_route` 是纯关键词规则（`chancellor_router.py:15` 明文"不调LLM"），零命中时没有第二判断层，只有硬编码填充。
- **缺口 B**：没有独立的"这单真的该派吗"审查关卡——六部真实引擎失败后直接退化到 LLM 顶人设，没有中间挡板。
- **缺口 C**：LLM 兜底调用没有统一的反幻觉约束——户部/工部人设 prompt 里没有"不确定就拒绝"的强制规则，只有礼部一家有对应质量门(`lipu_vet`)。

---

## 1. 现状盘点（代码级核实，非文档声称）

跑 `python3 .claude/skills/dept-capability-map/scripts/audit.py` 得到（2026-07-17 快照，随时可重跑）：

| 部门 | canonical状态 | 真实后端引擎 | 路由关键词表同步（yaml vs shangshufang_loop.py） | agent_design边界声明 |
| --- | --- | --- | --- | --- |
| 户部 | active | `adapt_hubu`（报价/付款/现金流） | 部分重叠(8/13) | 有 |
| 吏部 | active | `adapt_libu_personnel`（appointment/recruit/personnel） | 部分重叠(2/14) | 缺（实际写在`搜索简历/IDENTITY.md`，目录名不叫吏部，工具漏报） |
| 礼部 | **pending（未激活）** | `adapt_lipu`（品牌战略/对外出稿，配`lipu_vet`反幻觉门） | 部分重叠(3/14) | 有 |
| 兵部 | active | `adapt_bingbu` | **完全不重叠(0)** | 有 |
| 刑部 | active | `adapt_xingbu`（后端真实存在；前端另有一份本地clause扫描，已列入P4c蒸馏退役队列） | 部分重叠(2/18) | 有 |
| 工部 | active | **无（None兜底，唯一没有真实引擎的六部之一）** | 部分重叠(1/22) | 有 |
| 锦衣卫（专署） | — | `adapt_jinyiwei`（后端真实存在；前端`lead-radar`/`tender-radar`/`competitive-edge`是本地mock，P4c标记待诚实降级） | — | — |
| 钦天监（专署） | — | `adapt_tianjian` | — | — |

**六个部门没有一个关键词表"完全一致"**——`departments.yaml routing_keywords` 和 `shangshufang_loop.py DEPARTMENT_RULES` 是两份独立维护、从未真正同步过的表。兵部零重叠，说明这不是历史 drift，是两套路由逻辑长期各说各话。

另有第三条独立路由实现 `backend/src/chaotang_department_router.py`（463行，`route_department_task`/`score_ministry`），与前两者互不引用，`agent_design/README.md` 要求路由变更时同步更新此文件，但从未真正同步。**当前活着三份路由决策逻辑**，这是本设计落地前必须先收口的前置条件，不是可以绕过的细节。

---

## 2. 已有的更好设计（不是重新发明，是移植）

`backend/agent_design/README.md` 官方登记 8 套设计集合，其中 3 套与本设计直接相关：

### 2.1 三省六部体系（`backend/agent_design/buildAgent/三省六部体系/`）

- **门下省**(`门下省/SOUL.md`)：独立 subagent，接中书省方案后从**可行性/完整性/风险/资源**四维审议，结论只有**封驳**或**准奏**，最多3轮强制通过。这是**执行前**的关卡——现在系统里，御史质量门只审六部**跑完之后**的候选奏折，缺口 A/B 描述的"该不该派"这一步无人把关。
- **每个部门agent统一焊死的反幻觉铁律**（"明朔皇上的永久规则"段落，`门下省/SOUL.md`、`户部/SOUL.md`等文件末尾一致出现）：DONT清单（不许编造数据/不许模板官话/不许"可能也许应该"）+ MUST清单（结论前置/数据带来源）+ 反幻觉协议（时效性任务必须用工具/允许说"需要工具支持"）。这解决缺口 C。

> 提醒：这套设计运行在 `/home/ubuntu/.openclaw/`（门下省文件内写明），用飞书看板CLI和 `JJC-` 任务ID，是独立的运营系统，**不能整体照搬代码**，要移植的是设计模式，不是文件本身。

### 2.2 储能售后蜂群（`backend/agent_design/buildAgent/储能售后蜂群/`）

5 阶段真实流水线：故障分诊员（P0-P3分级，"热失控/冒烟/漏液→强制P0"硬编码安全阈值）→ 数据采集员（显式标 `[missing]`）→ BMS诊断师 → 现场失效分析师（"与上游交叉验证"）→ 处置工单生成器（"两路结论是否一致"冲突检测）。

工部当前**没有真实引擎**（第1节已确认），且这套流水线的产品域（储能/电池/BMS/冷库）与工部关键词表`["交付","技术","方案","bom","施工","周期","供应链","实施","储能","电池","pack","bms","冷库"]`完全对应——不是外部参考，是同一门生意的现成图纸。

### 2.3 搜索简历（`backend/agent_design/buildAgent/搜索简历/`）

`IDENTITY.md`："所属部门：人力资源部"，边界声明极干净——"只提供推荐建议,不做录用决策"。吏部现状边界声明缺失（工具误报，实际在此），这句话是六部里最值得直接复制的边界表达范式。

---

## 3. 目标架构：五层

```
Layer 0  身份底座（先收口三份路由为一份，否则后面焊错地方）
Layer 1  丞相：确定性风险闸门 + LLM 路由推荐（双轨并行，不是二选一）
Layer 2  门下省：独立否决关卡（新增，移植自三省六部体系）
Layer 3  六部部长：agent + 工具 + 边界声明 + 统一反幻觉铁律
Layer 4  军机处派单（现状保留不动）
Layer 5  御史质量门（现状保留不动，与门下省互补：门下省审"派不派"，御史审"结果对不对"）
```

### 3.1 Layer 0：身份收口（前置条件，不可跳过）

- 唯一 canonical：`departments.yaml` + `dept.ts`（mainline-absorption-review 已裁定）。
- `chaotang_department_router.py` 降级为该 canonical 的只读 adapter，或标记 deprecated——不得作为独立决策权威继续存在。
- `departments.yaml routing_keywords` 与 `shangshufang_loop.py DEPARTMENT_RULES` 合并为一份，另一份改为从这份生成（不允许两处手写）。

### 3.2 Layer 1：丞相——安全网留代码，判断力换成真 agent

```
确定性风险闸门（保留，不可绕过，代码写死）
    命中金额/合同/安全/人事/不可逆关键词 → 强制 D2，无视任何模型建议
LLM 路由推荐 agent（新增）
    context = 六部+锦衣卫的边界声明（来自 canonical registry + agent_design persona）
    输出（结构化 schema，不是自由文本）：
        候选部门[] / D级建议 / 置信度 / 或显式 UNSUPPORTED_SCOPE
最终 D 级 = max(硬门, LLM建议, 用户指定)
```

`CHAOTANG_CONVERGENCE_GUIDE.md` 3.2节原文已经写了这个公式（"模型可以推荐等级和理由，但风险硬门、最终等级和状态转换必须由确定性策略裁决"），当前代码从未实现过——这是把文档兑现为代码，不是新发明。

### 3.3 Layer 2：门下省——独立第二 agent，专职挑刺

移植 `三省六部体系/门下省/SOUL.md` 的四维审议+封驳/准奏结构，插入丞相路由决定和军机处派单之间：

```
丞相输出路由决定
  → 门下省独立审议：可行性 / 完整性 / 风险 / 资源 + "这真的是任何部门的职责吗"
  → 封驳（打回丞相重判，最多3轮，第3轮强制过）或准奏（放行军机处）
```

与御史的分工边界（避免误判为重复建设）：门下省审**分类和路由决定本身**（执行前）；御史审**六部产出的候选奏折内容**（执行后）。世界杯 bug 发生在门下省该管的阶段，御史根本轮不到审。

### 3.4 Layer 3：六部部长——四件套，不是关键词字典

```
每个部门 = {
  persona:     agent_design 对应 SOUL.md（已有，直接复用，不重写）,
  边界声明:     明确 in-scope + 明确 out-of-scope 反例（照抄"搜索简历"猎锐"只推荐不做决策"）,
  工具:        真实引擎函数（adapt_*），agent 主动决定调不调，不是失败后被动兜底,
  反幻觉铁律:   DONT/MUST/反幻觉协议统一段落，焊进每个部门 system prompt 尾部
               （现在只有礼部一家靠 lipu_vet 有对应机制）
}
```

逐部门现状与所需动作（对照第1节表格）：

| 部门 | 现状 | 本设计要做的事 |
| --- | --- | --- |
| 户部 | 真实引擎在，边界模糊 | 补边界声明："只处理结构化企业财务决策，个人预算类请求显式转 D0" |
| 礼部 | 真实引擎+反幻觉门都在，但**canonical状态pending未激活** | 先激活；反幻觉门(`lipu_vet`)模式作为其他五部的范本 |
| 吏部 | 真实引擎在 | 边界声明从`搜索简历/IDENTITY.md`正式挪进吏部agent定义 |
| 兵部 | 真实引擎在，路由关键词表**零重叠**——需单独排查这两份表为何完全不搭 | 排查+合并关键词表（Layer 0 范围） |
| 刑部 | 后端真实引擎在，前端旧本地扫描待P4c退役 | 跟随P4c既定计划，不重复立项 |
| 工部 | **无真实引擎**，六部最大缺口 | 把储能售后蜂群5阶段流水线抽象为`adapt_gongbu()` |
| 锦衣卫 | 后端`adapt_jinyiwei`真实；前端lead-radar等mock | 角色适合做"证据采集不下结论"，工具从前端假雷达换成已接好的MCP(`web_search`/`ddg_search`，`config/mcp_servers.yaml`已注册，无需新建server) |

---

## 4. 落地优先级（按杠杆排序，不是按部门编号）

1. **工部真实引擎**（储能售后蜂群搬迁）——已有完整设计，成本最低，填六部最大的洞。
2. **门下省 veto gate**——修的是系统性错误类型（误路由本身），一次修好防住所有同类 bug，不是修一个案例。
3. **统一反幻觉铁律**——机械劳动，焊进六个部门 system prompt，工作量小，安全收益立即见效。
4. **丞相 LLM 推荐层**——工作量最大、改动最深，放最后，前三步做完风险才可控。

排序依据：投入产出比从高到低，且第1-3步都不依赖第4步，可以独立验证收益后再决定要不要做4。

---

## 5. 风险与工程纪律（不可省略的部分）

- **结构化输出强制**：门下省和丞相 LLM 推荐层都是新增 LLM 调用点。若靠 prompt 里一句话嘱咐"可以拒绝"，模型在上下文不足或工具失败时会退化回"总要给答案"——必须用 JSON schema 强制包含 `UNSUPPORTED_SCOPE`/`封驳` 选项，不能只靠提示词自觉。
- **灰度上线，不整体切换**：五层不可一次性全部上线——任何一层出问题都无法定位是丞相判断错、门下省该拦没拦、还是部门 agent 自己越权。按第4节优先级**一层一层上**，每层单独跑够真实流量（不是只用 golden case）再上下一层。
- **决策留痕**：门下省封驳理由、丞相路由建议都要落库（不是只留布尔值）。上线后要能回答"门下省封驳率是否在涨""哪个部门最常被误路由"——这两个字段现在加是零成本，上线后补要迁移。
- **回归测试集**：本文档第0节的世界杯 bug + census 中已发现的 MIXED/FALLBACK 案例，收集成固定反例集，每层上线前后全量跑一遍，比只用手写 golden case 更有针对性——这些都是真实踩过的坑。

---

## 6. 后续排查结论（原"未覆盖/待查项"，2026-07-17 追加核实）

### 6.1 buildAgent 剩余六目录盘点（已查）

`市场OPC团队`、`郝龙-智能体市场`、`郭云辉-产品部`、`肖艺-电芯测试工程师`、`肖艺-项目管理PM`、`马景博-电芯搜寻Sourcing` 六个目录逐一读完：

- **马景博-电芯搜寻Sourcing**：六步情报流水线（任务分解→基础信息→参数收集→数据清洗→虚拟询价→整合分析，末端 S/A/B/C 推荐等级+风险维度表），结构完整度与"储能售后蜂群"同级，可直接迁移给**锦衣卫**，填补"外部实体情报侦察-清洗-评估"流水线空白——锦衣卫现有工具（`lead-radar`/`tender-radar`/`competitive-edge`）是前端 mock，这套是真正的多步骤流水线设计，不是零散规则。见第 6.4 节新增 PKT-6 候选。
- 其余五个目录只有零散可复用片段，未构成整线级发现：市场OPC团队的情报置信度分级（A/B/C+强制标源）、郝龙-智能体市场"获客AI"的简化流水线雏形、郭云辉-产品部的分层授权表、肖艺-电芯测试工程师的异常四级色标预警表+诚实标语言、肖艺-项目管理PM（纯通用项目管理套路，无对应）。这些片段级发现暂不单独立项，留作 PKT-3/PKT-4 执行时的参考素材，不构成新 Packet。

### 6.2 兵部路由关键词表零重叠（已查）

> **2026-07-17 二次核实更正**：本节原结论"`shangshufang_loop.py` 那份关键词表停留在旧定义、PKT-2应以`departments.yaml`为准替换它"是**错误结论**，已被 Codex 停审门拦下。真实情况见下方更正版。

不是同义词字面漂移，是**两次独立需求留下的语义分裂，但两份都在真实生产链路里被消费，不是一份活一份死**：`shangshufang_loop.py DEPARTMENT_RULES["兵部"]`（竞争/市场/渠道/谈判/攻防/份额，focus="竞争、市场攻防、渠道和谈判策略"）自写入起从未改动，语义是"竞对参谋"；`departments.yaml bingbu.routing_keywords`（销售/售后/客户/跟进/战情/成交/流失）是后续 SSOT 重构新增，语义是"一线销售/客服作战室"。真实引擎 `adapt_bingbu → run_bingbu_battlecard`（`backend/src/bingbu_battlecard.py`）处理的线索评分/客户档案/触达策略，语义上确实更接近 `departments.yaml` 的"销售作战室"框架。

**但** `DEPARTMENT_RULES["兵部"]["focus"]` 本身并不是死数据——`shangshufang_loop.py::review_memorial_for()`（约838-849行）直接消费这个 `focus` 字段，为每一个路由到兵部的任务生成军机处会审奏折里的真实意见文本："市场与竞争动作需要单列攻防假设，不能以抢进度替代风险核查。"这是**当前生产环境里正在生成的真实奏折内容**，不是可以直接丢弃的旧定义。

PKT-2 步骤5 不能简单"以 `departments.yaml` 为准替换 `DEPARTMENT_RULES`"——这会连带改写 `review_memorial_for()` 产出的兵部意见文本，属于业务内容变更，不只是路由关键词收敛。正确范围应拆成两个独立问题：（a）**路由匹配**该用哪套关键词——这块可以按 `departments.yaml`+真实引擎的销售作战室语义收敛；（b）**`review_memorial_for()` 里兵部的 opinion 文案**要不要跟着改成销售作战室框架——这是产品/内容决策，需要业主确认，不是路由收敛的自然延伸，不应该在 PKT-2 里顺手带过。

### 6.3 `chaotang_department_router.py` 调用方影响面（已查）

> **2026-07-17 二次核实更正**：本节原结论"PKT-2 应以完全 deprecated 为最终目标、当前只是被 complexity_score 这条窄依赖挡住"是**错误框架**，已被 Codex 停审门拦下。真实情况见下方更正版。

三态混合：

- **真实生产依赖，且是已裁定的架构决定，不是待清理的遗留债**：`route_department_task` 被 `chancellor/routing_service.py` 调用，喂给 `POST /api/shangshufang/confirm-edict`（真实生产端点），提供 `complexity_score` 元数据字段。`routing_service.py` 模块 docstring 原文明确记录："阶段1收敛完成(2026-07-14)：chancellor_router.decide()...已同样委托 chancellor_decide_route 判 mode+部门集，只保留部名→蜂群适配层。两套规则引擎并存的历史到此为止"——即 2026-07-14 已经做过一轮路由收敛，`route_department_task` 的 `complexity_score` 计算是那次收敛**保留下来的、有意为之的设计**，不是没人注意到的遗留耦合。
- **展示类死角**：`/api/chaotang/department-system` 等端点注册了但全前端零调用；`/chaotang-ui/*` 系列 `include_in_schema=False` 且 `swarm-execute` 注释明写"未调用真实模型"。
- **纯死代码**：`build_dashboard_summary`/`build_routing_playbook`/`build_persona_prototypes`/`build_live_war_report`/`build_advisor_review_panel`/`build_memory_replay`/`build_forecast_sandbox` 七个函数全仓零调用。

PKT-2 步骤4 更正结论：七个死函数和展示类死角可以单独先清，这部分不变。但 **`route_department_task`/`complexity_score` 这条路径不应被当成"待migrate掉以便未来整体deprecated"的技术债**——那是 2026-07-14 已经拍板的架构决定，PKT-2 若要推翻它需要业主重新裁决，不能在收口关键词表的过程中顺手当成清理对象处理。PKT-2 步骤1的影响面排查结论应更新为："`chaotang_department_router.py` 不整体退役；只清七个死函数和展示类端点；`route_department_task`/`complexity_score` 路径保留，除非业主明确推翻2026-07-14的收敛裁定"。

### 6.4 新发现：PKT-6 候选（未批准，供后续队列裁决表补录）

**锦衣卫真实引擎（马景博 Sourcing 流水线迁移）**——把六步情报流水线抽象为 `adapt_jinyiwei` 的扩展分支或独立函数，替换前端 `lead-radar`/`tender-radar`/`competitive-edge` 三个 mock 组件背后的实际能力来源。价值级别与 PKT-1 相当（现成设计、无需从零构思），但依赖关系待评估（是否需要先过 Layer 0 收口）。本文档不擅自把它塞进第4节优先级排序，留待业主在下一轮队列裁决时连同 PKT-2~5 一起考虑是否插队。

---

## 7. 治理状态（明确，不含糊）

本文档是历史设计提案，不是已批准的执行计划。下列 FULL_COURT_V1、P0–P9、P6/P7 与 V2 backlog 只记录 2026-07-17 当时的治理快照，均不再拥有当前产品范围、排期或施工入口。当前产品与实施权威只来自文件顶部指向的产品宪法、R0/R1 PRD，以及经批准的 M0–M10 amendment。

本设计中的任何代码改动落地前需要：

1. 业主裁决是否/以何优先级采纳；
2. 若采纳，由 M0–M10 owner 在显式 amendment 中分配 milestone、schema owner、迁移、失败测试和回滚；不得写回已关闭的 `FULL_COURT_V2_BACKLOG.md`；
3. 执行遵循当前仓库 `AGENTS.md` 与 change 记录要求；历史上的“Codex 唯一写入者 / Claude Code 只读审查”不构成现行工具或角色授权。

本文档由 Claude Code 撰写，不构成对上述纪律的绕过。
