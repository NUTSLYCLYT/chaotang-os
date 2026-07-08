# 朝堂 Agent / 蜂群 总览图 · 当前真实配置 + 最优设计

> 2026-06-24。这是**当前真实配置审计**(读真代码,非 spec)+ 顶级最优设计 + 蜂群设计 + 总览图。
> 与 chaotang-PANORAMA(org×skill 设计视图)互补:本文是 **agent/swarm 技术视图**。

## 1. 当前真实配置（审计 · 读真代码）
### 1.1 Tier-0 agent 注册表（`src/lib/contracts/agent.ts` AGENT_META，11 个）
| tier | agent codes |
|---|---|
| core | `prime_minister`(丞相) · `scribe`(史官/史馆) |
| ministry | `li_bu`(吏) · `hu_bu`(户) · `li_bu_rites`(礼) · `bing_bu`(兵) · `xing_bu`(刑) · `gong_bu`(工) |
| special_bureau | `qin_tian_jian`(钦天监) · `jin_yi_wei`(锦衣卫) · `tai_yi_yuan`(太医院) |

### 1.2 真正有 live seed 的部门（`src/lib/swarm/dept-registry.ts`，仅 5-6 个）
`ops` · `hr` · `works` · `legal` · `market` (+`finance` 走专用 BFF `/api/court/hubu/ask`)
→ 每个 = `role`(领域人设) + `DEPT_SEED`(真实运营种子) → `runAgent({role,context,command})` → callLLM 接地。

### 1.3 当前每部门"设置"的真相 = **纯 agent，零 skill 接入**
- 部长本体 = LLM + role seed(dept-registry)。**没有任何 Claude skill 接进 dept agent**——翰林院武库(PANORAMA)是设计,尚未 wiring。
- 数据源优先级:通用后端 `/dept/[code]/overview`(真数据) → 空则回落 `DEPT_SEED`(种子兜底)。

### 1.4 两层蜂群（现状）
- **Layer1 秒级会审**(`orchestrate/route.ts`):`routeDepartments(command)`(确定性关键词路由)→ 并行 fan-out 召相关部门 live agent(`askEndpoint`,户部走 `/hubu/ask` 其余 `/dept/{code}/ask`)→ **确定性 merge(非 LLM 法官)** → 奏折。
- **Layer2 分钟级深办**(jiqun `manor_groups.yaml`,6 组):`情报组/文创组/财法组/产研组/执行组/复盘组`,各带 `OPENCLAW_*_URL` → **当前全 spawn**(OpenClaw 未配)。
- **记忆**:jiqun `memory_store`(FTS5)织进 flow_engine 每次 run。

### ⚠️ 1.5 审计发现的真问题
- **部门命名未统一(铁律2 SSOT 漂移)**:AGENT_META 码(`hu_bu`)/ dept-registry 键(`market`/`finance`)/ swarm 码 三套并存,易写进永不匹配的孤儿边。**这是最该先治的。**
- **skill 层完全缺失**:武库设计好了,没一根接进 agent。
- **记忆飞轮单向**:OpenClaw/深办 output 不反写。

## 2. 顶级最优配置（minister-architecture 落到每个真实 agent）
每个部长 = `agent(seed,已有)` + `Hermes记忆(默认挂,缺)` + `skill(翰林院按需借,缺)` + `OpenClaw手臂(碰产线才伸,默认无)`。
| agent | 现状 | 最优补 |
|---|---|---|
| hu_bu/户(finance) | ✅ seed+专用BFF | + 记忆命名空间 + 借 finance/financial-statements skill |
| li_bu_rites/礼(market) | ✅ seed | + 记忆 + 借 product-manager/penpot/brand-voice |
| xing_bu/刑(legal) | ✅ seed | + 记忆 + 借 security/法务 skill;碰合同才挂手臂 |
| gong_bu/工(works) | ✅ seed | + 记忆 + 借 工程 skill 群 + chaotang-frontend-design |
| li_bu/吏(hr) | ✅ seed | + 记忆 + 借 interview-me/team-builder |
| bing_bu/兵 | 🟡 仅注册无 live seed | 定义业务(商战?)+ 补 seed + 记忆 |
| qin_tian_jian/钦天监 | 🟡 碰 mock | 极薄 agent + forecast skill + cron + 记忆 |
| jin_yi_wei/锦衣卫 | 🟡 RADAR 纯假 | skill-gate(锦衣卫 skill)+ 薄壳 + 接真情报源 |
| tai_yi_yuan/太医院 | 🟡 碰 mock | agent + 健康资源 skill + 记忆,**绝不诊断** |
| scribe/史馆 | 🟡 碰 mock | **=Hermes 可视读面,非独立 agent** |
| prime_minister/丞相 | ✅ 编排 | **编排层**,召部门+读记忆+守红线 |

## 3. 蜂群该如何设计（两层 + 分层闸）
```
                       ┌── 上书房/军机处(编排层·非蜂群成员·conductor) ──┐
                       │  召集 + 聚合 + 守红线(源标/SSOT/确认门) + 分层闸 │
   ┌───────────────────┴───────────────────────────────────────────────┐
   │ 🐝 Layer1 · 秒级会审蜂群(朝堂 orchestrate)                          │
   │   命令 → routeDepartments(确定性关键词路由,非 LLM 选 agent)         │
   │        → 并行 fan-out 召相关部门 live agent(各自 seed + 将来借 skill)│
   │        → 确定性 merge(非 LLM 法官,代码合) → 奏折                    │
   │   覆盖 ~95% 咨询级决策,秒级。源标 LIVE/MIXED。                       │
   └───────────────────┬───────────────────────────────────────────────┘
            缺证 critical / 高风险 / 碰真实产线资产 → 分层闸升级
   ┌───────────────────┴───────────────────────────────────────────────┐
   │ 🐝 Layer2 · 分钟级深办蜂群(jiqun manor 6组)                         │
   │   经 jiqun:8081 → 情报/文创/财法/产研/执行/复盘                      │
   │        → spawn(默认) / openclaw_dispatch(配 6 URL 后,Stage3)        │
   │        → 真 trace_id 才标 LIVE_SWARM → 深办结果反写 Hermes 记忆      │
   │   只在真需要时点亮,分钟级。绝大多数决策不到这层。                    │
   └─────────────────────────────────────────────────────────────────────┘
```
**蜂群设计 5 原则**：
1. **确定性路由**：谁参会用关键词 router 决定，不让 LLM 选 agent（可审计、省 token）。
2. **并行 fan-out**：相关部门 agent 同时跑，不串行等。
3. **确定性 merge**：聚合用代码不用 LLM 法官（不让 agent 裁决 agent，防偏置/投毒）。
4. **分层闸**：默认秒级 Layer1，只在缺证/高风险/碰产线资产升 Layer2，成本随记忆命中下降。
5. **源标诚实 + 记忆反写**：真 trace 才 LIVE_SWARM；深办完必反写记忆，飞轮复利。

## 4. 一张总览图（agent × 蜂群 × 五层）
```
            御座(老板·终裁)
              │
        丞相/上书房/军机处 ── 编排层(conductor) ── 御史台(监察·确定性脚本)
              │  分层闸
   ┌──────────┴── Layer1 秒级会审蜂群(orchestrate) ──────────┐
   六部 live agent(seed):户 礼 刑 工 吏 [兵待定]            │
   + 三special bureau:钦天监 锦衣卫 太医院                  │
   每个 = 🧠agent(已有) +🧬记忆(缺) +🧰skill借翰林院(缺) +💪手臂(默认无)
              │  缺证/产线 → 升级
   ┌──────────┴── Layer2 分钟级深办蜂群(jiqun manor 6组) ────┐
   情报 文创 财法 产研 执行 复盘 → spawn / OpenClaw(Stage3) │
              │ 反写
        🧬 Hermes 记忆(jiqun memory_store FTS5)── 史馆=其可视读面
   翰林院(skill武库:github-hot-radar侦查→孵化→部门借)
```

## 5. 当前 → 最优 的 gap（按 rollout，先治 SSOT）
1. **治 SSOT 命名(最先,铁律2)**:AGENT_META 码 / dept-registry 键 / swarm 码 收敛到单一真相表,各侧 import。否则后面接记忆/skill 全漂移。
2. **给每部默认挂 Hermes 记忆命名空间 + 补反写**(Stage2,最高复利)。
3. **skill 接线**:翰林院武库 lazy-load 进 dept agent 的 action space(Stage2)。
4. **碰 mock 五部补真源 + 诚实空态**(钦天监/太医院/锦衣卫/军机处/史馆)。
5. **兵部定义业务**(商战/竞争/危机?)+ 补 seed。
6. **OpenClaw 手臂**:配 6 URL,manor spawn→openclaw_dispatch(Stage3,需求拉动)。
> 全在主闭环上线后渐进;当前最优仍是先把 jiqun:8081 复活 + 设 FENGQUN_AUTH 完成上线。
