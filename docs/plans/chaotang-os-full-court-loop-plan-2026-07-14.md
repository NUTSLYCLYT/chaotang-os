# 朝堂 OS · 全朝廷闭环整体方案（2026-07-14 大神会审定稿）

> 状态：用户已批准全部天才建议/推荐技能/技能洞察。
> 本方案是 `plans/chaotang-os-launch-blueprint-2026-07-14.md`（首发冻结为刑部合同审查切片）的**目标架构层**，不改变首发范围；所有 P 阶段受下方"前置硬门"约束。

## 一、闭环总图

```
【实时链 · 一道旨的生命周期】
上书房下旨 → 丞相拟票(3秒受理+规格分层) → 用户朱批
  → 军机处调度沙盘
      ├─ 各部各司领蜂群执行 ←─ 知识库(证据底座)
      └─ 锦衣卫侧翼密报(平行注入,不进决策层)
  → 各部标准回奏(结论/证据锚点/风险/置信度/缺证/异议/利益声明/告病)
  → 军机处审议(冲突表面化,不做温水平均)
  → 钦天监批注天时(时机/二阶效应/不可逆性,只批注不阻塞)
  → 御史封驳门(证据缺失/越权承诺/伪LIVE → 退回重奏)
  → 丞相呈递(「各部会奏」+「臣愚见」严格分区+押注)
  → 圣裁(准奏/打回/再议/传X部问话;单向门决策默认询问三日复裁期)
  → 史馆归档(完整轨迹按数据集规格存储)

【离线链 · 一个月比一个月强】
史馆 → 翰林院(传话失真eval/押注胜率/钦天监对账/封驳原因分类)
  → 策论 → chaotang-build-office 模具升级 → 新部天生合规
缺证清单 → 知识库"补入此证"一键入库 → 下道旨不再缺
```

## 二、两大警示的解决方案（用户要求列出，已批准）

### 警示A（Bezos）：钦天监不可逆性评级的代价不对称

问题：把单向门误判为双向门→用户快裁后无法回头，责任归产品。

解决方案（按防御层次）：
1. **默认单向门**：评级规则引擎的缺省输出是"单向门·慢审"。降级为双向门必须命中显式证据白名单，缺证一律维持单向门。
2. **降级证据白名单**（初版三类，只增不减需翰林院策论支持）：
   - 合同含明确解约/退出条款且退出成本已量化；
   - 该动作本身是草案/报价/意向，未构成承诺；
   - 对手方书面确认可撤销。
3. **规则判级、LLM 只写理由**：评级下限由确定性规则决定（与 `yushi_global_gate` 同款零-LLM 思路），LLM 仅起草解释文本，不能抬高可逆性。
4. **复裁日默认开启**：单向门裁决时系统必问"是否设三日复裁期"，期内可反悔、期满生效（后悔权产品化）。
5. **误判即 P0**：任何被评为双向门、事后证实不可逆的案例，翰林院对账时自动升 P0 事故，评级规则回归保守版并复盘。

### 警示B（Karpathy）：蓝图成为跳过无聊修复的借口

问题：9类agent×6技能×8阶段的宏大蓝图，会给团队"跳过 P0-B 等无聊修复直接做新东西"的完美理由。

解决方案：
1. **前置硬门（本方案所有 P1+ 阶段的统一入口条件）**：
   - `P0-B` 归属漏洞 = **0**。唯一权威事实源是行为门
     `backend/tests/test_p0b_cross_user_behavioral.py`：为每个"接受调用方传入 task/brief id"
     的端点种一个属于 `someone_else` 的任务并尝试访问，**必须因归属被拒**。
     未修端点以 `strict=True` xfail 实证在案；修好后 XPASS 会让测试失败，强制删标记（还债留痕）。
     清零的可执行定义 = 该文件 xfail 数 == 0 **且**覆盖率门
     `test_every_attack_surface_endpoint_has_a_probe` 绿（保证"没写测试"不会被误读成"没有漏洞"）。
     2026-07-14 实测：**12 个 xfail = 12 个活漏洞**（点查/委托:task_decision / swarm_deepen /
     confirm_edict / finance_intel_case / brief_decision_advance / brief_decision /
     edict_return / swarm_runs_create / swarm_runs_create_serial_loop / swarm_runs_retry；
     列表泄露:grand_council_live / shangshufang_home），已修 1 个（task_status），
     guarded 样板 1 个（jinyiwei fill-gap）。
   - **静态门有已知天花板，不能只凭它全绿宣称 P0-B 清零**：同仓静态扫描无法 sound 地
     枚举"某 route 是否读 DecisionTask"（动态派发、原生 SQL、别名 import、超一跳跨文件链
     都抓不到）。真正 sound 的关闭是**结构性**的——把所有 DecisionTask 按 id 的读收口到
     唯一一个带归属校验的 accessor，届时"未经 accessor 直接 query"成为可精确 grep 的违规。
     这是 P0-B 收尾项。在此之前**行为 probe 才是权威**，静态门只是尽力而为的绊线。
   - 五个反面教训已固化进测试注释，勿重蹈：
     (a) **计数 ≠ 归属**——`test_p0b_ownership_ratchet.py` 只数裸查处数，而修复是"在裸查后加一行校验"，
         计数不变，故它**不是** P0-B 硬门，已降级为"攻击面不许增长"的表面积棘轮；
     (b) **"被拒了" ≠ "因归属被拒"**——`/tasks/{id}/decision` 和 `/briefs/{id}/decision/advance`
         当前会因"正式奏折质量门/需人工确认"这类**状态门**拒绝请求，跟归属毫无关系；
         受害者任务只要状态合适就能被长驱直入。行为门因此强制断言错误信息含"无权"；
     (c) **手写攻击面清单 = 循环论证**——覆盖率门原来拿一个手写 set 去对照本文件的函数，
         两边都由同一个人维护，新增漏洞端点忘了登记就照样全绿。且那个手写 set 当时**确实已经漏了**
         `swarm_runs:create_serial_loop`（裸查藏在 helper `_default_context` 里，只扫 route 看不见）。
         攻击面现已改为**从 router 源码 AST 推导**（route 直接沾裸查 + helper 传染），
         新端点碰裸查就自动进攻击面，不依赖任何人记得更新清单。已用两个破坏性实验验证：
         删掉一条 probe 登记 → 门红；往 router 加一个新漏洞端点、测试文件一字不动 → 门红。
     (d) **窄正则检测 = 假绿**——检测原来用 `query\(DecisionTask\)\.filter_by\(id=` 窄正则，
         只认一种查询写法，`.filter(DecisionTask.status...)` 列表查询、`.filter(DecisionTask.id==x)`、
         `.get(DecisionTask, x)` 全部静默漏过。它当时**确实漏了** `grand_council_live` 和
         `shangshufang_home` 两个真实**列表泄露**（status-only 过滤、无 user_id，把所有用户在审
         任务混在一个列表返回）。改为 form-agnostic（`query(DecisionTask)` / `get(DecisionTask,`，
         排除构造器 create）后抓出，已用非窄形态新端点实验验证门会红。列表泄露的 probe 用
         "机密哨兵字符串绝不能出现在返回体"检验（弱断言 success is False 对列表端点无效）；
         且列表端点要种齐触发上榜所需的全部关联行（grand-council 需 RouteDecision+CourtReview，
         否则受害者任务因"数据不全没上榜"假绿）。
     (e) **只扫 router 文件 = 假绿**——检测原来只读 `web/routers/*.py`,route 若把
         DecisionTask 读委托给跨文件 helper（如 `decree_status.build_decree_execution_status`）
         就整个漏过。改为:全仓找出所有"直接读 DecisionTask"的函数名,router 里 import 到
         这些名字并调用 → route 进攻击面;同文件多级 helper 传染取不动点。抓出
         `brief_decision`(委托)和 `swarm_runs_retry`(经 `_default_context`)两个新面。
         已用"纯跨文件委托、函数体无 query"的新端点实验验证门会红。**但此法仍非 sound**
         (见上方天花板声明),这也是为什么把结构性 accessor 收口列为收尾项。
   - `pnpm prod:doctor` ≠ STOP；
   - 后端 8 个"既有失败"测试有钉死清单+owner（允许未清零，不允许无主）。
2. **门检查方式**：每个 P 阶段的 change record 的 `request_analysis/spec.md` 必须引用本节并记录当时的三项实测值（P0-B 项 = 跑行为门并粘贴 xfail 数）；御前包工头（任何 agent）在 P1+ change 开工前先跑这三项。表面积棘轮同时挡住新增攻击面：任何人新增 DecisionTask 裸查，必须同步补一条行为 probe 并上调基线。
3. **国力仪表盘先行落地**（已完成，见下）：让"系统对自己表现负责"从第一天可见——没数据的指标诚实标 NO_DATA，绝不编数。
4. **WIP 限制**：上一 P 阶段退出条件未绿，下一阶段不开工；两翼(P6/P7)不得打断 P0-P5 主线。

## 三、国力仪表盘（"更好技巧"·已立即实施）

- 后端 `GET /api/guoli/overview`（`backend/web/routers/guoli.py`，TDD：`tests/test_guoli_overview.py` RED→GREEN，2 passed）。
- 四指标：丞相押注胜率 / 钦天监命中率 / 御史封驳率 / 各部告病率。
- **诚实标铁律**：御史封驳率读 `truth_ledger` 中 `swarm=="yushi"` 判决（red/black=封驳），有数据即 LIVE 并带样本量；其余三项 NO_DATA+原因+预计接入阶段（P1/P7）。台账为空时御史也标 NO_DATA——不用 0% 假装"零封驳"。
- 前端"四数字一页"面板：待 P1 押注/告病数据源接入后一并做（避免上线一个三格空的页面），挂大殿。

## 四、Agent 设计清单

| Agent | 角色 | 输入 | 输出 | 关键设计约束 |
|---|---|---|---|---|
| `chancellor` 丞相 | 总理+押注人 | 旨意/会奏/天时批注 | 拟票、呈递、臣愚见+押注 | 3秒受理；可"代答不发朝议"；愚见与会奏分区；引用自己历史错误 |
| `junjichu-dispatcher` | 调度 | 丞相拟票 | 规格分层、部司蜂群编制 | 沙盘可视化；仪式感与分量挂钩 |
| `dept-head` ×6 | 领部 | 军机处指令 | 本部标准回奏 | 模具生成，天生带 schema+告病+御史对接 |
| `office-worker` 蜂群 | 执行 | 主官分工 | 带证据锚点的结果 | 无证据结论不出司 |
| `jinyiwei-intel` 锦衣卫 | 情报侧翼 | 关注域+采集链 | 带鲜度密报/主动密折 | 永不下判断；鲜度标签(新报<24h/近报<7d/旧报降权)；密折日配额 |
| `qintian-strategist` 钦天监 | 战略批注 | 全案+密报 | 时机/二阶效应/不可逆性+到期日 | 只批注不阻塞；预测必带到期日；命中率随身公示 |
| `yushi-gate` 御史 | 封驳门 | 汇总全案 | 放行/封驳(带原因分类) | 规则引擎优先；封驳率>10%报警修出奏质量而非放松门 |
| `hanlin-researcher` 翰林院 | 离线研究 | 史馆轨迹 | eval/策论/对账 | 不在实时链；产出落 `/api/hanlin/experiments` |
| `shiguan-archivist` 史官 | 归档 | 全轨迹+结果回填 | 数据集规格记录 | 第一天按训练数据 schema 存 |

**Prompt 架构（Karpathy 天才建议·已批准）**：九类 agent 共用一套"朝臣基础人格"主干 + 角色差分三段注入（职责/输出schema/禁止事项）。一处升级全朝廷生效；翰林院策论只评估差分段。P2 模具升级时实现为 build-office 的 prompt 层结构。

## 五、Skills 设计清单

| Skill | 用途 | 触发 | 状态 |
|---|---|---|---|
| `chaotang-build-office` | 建部模具：回奏schema+告病+御史golden case必过+主干/差分prompt层 | 每建一部/司强制 | 已有，P2 升级 |
| `taste` | 呈递页品味审查(分区一眼可辨/封驳呈现克制) | 呈递页每次大改后 | 已有 |
| `memorial-schema-contract` | 回奏schema契约fixture+测试 | schema 字段任何变更 | P0 新建 |
| `distortion-eval`(翰林院) | 传话失真eval：已知答案旨意全链路×3量化每级稀释 | 汇总层逻辑变更后 | P5 新建 |
| `intel-freshness`(锦衣卫) | 密报鲜度+过期降权+密折配额 | 采集链每次运行 | P6 新建 |
| `oracle-settlement`(钦天监) | 预测到期对账+命中率公示 | 每日+预测到期日 | P7 新建 |

## 六、排期与依赖

| 阶段 | 内容 | 前置硬门 |
|---|---|---|
| P0 | 回奏 schema v1 契约(预留`密报来源`字段+`天时批注`区块插槽) | 无（文档+fixture，可立即） |
| P1 | 刑部切片全链路+真实用户走通；押注/告病数据源上线→国力仪表盘两项转 LIVE | **P0-B=0 + prod:doctor≠STOP** |
| P2 | schema 定稿烧进 build-office 模具(含御史对接+prompt主干/差分) | P1 真实用户验证完成 |
| P3 | 呈递页 taste 审查 | P2 |
| P4 | 单线叙事视图(旨的生命周期为主轴) | P3 |
| P5 | 翰林院传话失真 eval | P4 |
| P6 | 锦衣卫侧翼(鲜度/密折/关注域) | P5，且不打断主线 |
| P7 | 钦天监批注+到期对账→命中率转 LIVE | P6 |
| P8 | 命中率进呈递页+密折主动推送 | P6/P7 各≥30天真实数据 |
