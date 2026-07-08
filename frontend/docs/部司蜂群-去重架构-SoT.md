# 部 / 司 / 蜂群 去重架构 SoT(2026-06-29 大神会审落地)

> 单一真相源。所有涉及部/司/蜂群的开发先读这里。守此防"成本三处算"式重复再生。

## 一、三概念是两个维度,本不该重叠
| 概念 | 本质 | 维度 | 该在哪 | SSOT |
|---|---|---|---|---|
| **部** | 领域(谁负责) | 组织·静态 | 前端身份 | `contracts/agent.ts` 11 码 |
| **司** | 部内角色/工位(谁干) | 组织·静态 | 各部 roster | `features/*/lib/*-roster.ts` |
| **蜂群** | 执行引擎(怎么干) | 运行·动态 | **后端产线** | jiqun `swarm_orchestrator` |

**心法:部/司 = 地址簿(谁),蜂群 = 工厂(怎么造)。两个维度,重叠 = 维度搞混。**

## 二、会审取证的 4 处真重复(2026-06-29)
| | 重复 | 证据 |
|---|---|---|
| C(最硬) | 成本/pack_rd 三处算 | 户部 `bom-cost`+`price-library` × 工部 `battery-products`+`feasibility` × 后端 `pack_rd` |
| B | 前端 swarm runtime vs 后端蜂群 | 前端 `decision-loop`+`live-swarm-adapter`+`swarm-capability-registry` |
| A | 司 ↔ 蜂群 agent | 4 部各 roster + 后端蜂群 units(同领域逻辑两写风险) |
| D | 部间领域交叉 | 成本(户/工)、合规(刑 vs 各部自查)、情报(锦衣卫 vs 兵部) |

## 三、去重架构(一个领域一个 owner,产线一个出口)
```
部/司(地址簿·静态) → 决策环 decision-loop(前端前台·咨询+编排) → live-swarm-adapter(唯一桥) → 后端蜂群(工厂·唯一产线)
```

**4 条铁规:**
1. **一个领域一个 owner**:领域真算只在一处。pack_rd 成本真算 = 后端。户部读"财务视角"、工部读"交付视角"——**读同一份后端结果,不各算**。前端 `bom-cost`/`battery-products` = 咨询底座(选型/查规格/展示),**禁重算 split**。
2. **产线一个出口**:全前端只有 `live-swarm-adapter` 一个桥调后端蜂群,各部经 `decision-loop` 走它。**禁各部各自 fetch 后端 swarm**。
3. **司只做三件事**:① 咨询(纯函数·本地)② 编排(调蜂群)③ 展示(view model)。产线全转后端(铁律9)。
4. **司是地址不是执行**:司把活寻址给蜂群对应能力,负责派发+展示,不负责干。

**去重判据(铁律3 延伸)**:grep 同一意图两处实现(如 `pack_rd`/`成本拆分` 在户部和工部都算)→ 留后端一处,前端两部都"读"。

## 四、4 处重复 → 收敛方案
| 重复 | 收敛 | 归属/撞车 |
|---|---|---|
| C 成本(2026-07-03 复查更正) | **复查结论：不是真重复。** 户部 `bom-cost`(核对用户已有BOM/报价，数据源=真实采购台账)、工部 `battery-products`(型号规格价格区间参考目录，自称"只查规格，真算走后端")、后端 `pack_rd`(给需求从零仿真新方案)——三者数据源和真实用户意图都不同，只是表面都输出"成本数字"被模式匹配成重复。原06-29判定可能也犯了"被表面相似骗、没深挖是否同一问题"的错，不建议合并；`dispatchDeptToSwarm`↔`live-swarm-adapter`↔各真链BFF 经复核仍走唯一桥，未发现新违规。 | 已复查关闭 |
| B swarm | 工部对接蜂群**走 live-swarm-adapter**,不新建工部 fetch | core=core-builder,协调 |
| A 司 | 司只咨询+编排+展示,不重造蜂群逻辑 | 各部自查 |
| D 交叉 | 合规单 owner=刑部 lens(已建,他部调用不自建);情报单 owner=锦衣卫(兵部调用) | 刑部 lens 已就绪 |
| E 撞名(2026-07-03 新发现) | `command-center` 本地 `SwarmDispatchPanel`(纯展示泳道，无 fetch) 与共享 `swarm-dispatch-panel.tsx` 的 `SwarmDispatchPanel`(主动触发派发) 只是**同名不同功能**，曾被误判为重复实现。已将 command-center 本地那份改名为 `SwarmLaneBoard` 消歧义，不涉及合并/删除。 | 已复查关闭 |
| F Swarm类型三套(2026-07-04 团队级模式排查发现) | 独立agent核实：`src/lib/contracts/swarm.ts`(层A·REST展示契约，7处正常引用)、`src/store/swarm.ts`(层B·zustand store，自建同名`SwarmOverview`/`SwarmUnit`且字段与层A不一致，**零消费者**)、`src/core/courtos/runtime/*.ts`(层C·真后端调度，`CourtSwarmTraceV1`等完全另一套词汇，对层A零import)。**处理决定**：层B已确认死代码，attic至`dev/_attic/dead-code-2026-07-04/`(见`dev/notes/团队级模式-文档层滚动滞后-2026-07-04.md`)。层A/层C是否要统一**暂不动**——层A服务REST展示、层C服务真调度运行时，是否属于"分层非重复"(铁律7)需要专项评估，不在本次一次性合并，避免为了"看似统一"制造新的单向门重构风险。 | 层B已清；层A/C待专项评估(非本次) |

## 五、落地序
1. ✅ 锁 SoT(本文) + 升 CLAUDE.md 铁律6(防再生)。
2. ⬜ 工部对接蜂群走 live-swarm-adapter(回答"工部怎么对接":经唯一桥,不另起)。
3. ⬜ 成本收敛(户/工前端删重算→读后端 pack_rd,各自视角)——协调主工头。
4. ✅ 合规/情报单 owner 复查(2026-06-29 审计):**已干净,无重复**。
   - 合规:刑部 `clause-risk`/`xingbu-lens` 唯一引擎;**工部 `gongbu-engines.crossReviews` 已路由到刑部**
     (`{dept:'justice',cn:'刑部',kws:['合同','合规','违约','条款']}`)——识别合规事项即转刑部,不自建。
     全仓除 clause-* 外无第二个条款扫描引擎。**此 crossReviews 即"司是地址、把活寻址给 owner"的活样板**。
   - 情报:锦衣卫 `competitive-edge`+`intel/route` 唯一 owner;他部"情报"提及为展示,无自采引擎。
   - 结论:6 部唯一真重复是「成本」(户/工/后端三处,见 §四 C / roadmap 3),合规/情报本就单 owner。
