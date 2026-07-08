# 朝堂全景图 · 六部+职能部门 × 五层架构 × skills 配置

> 2026-06-24。把「部长五层架构」(minister-architecture.md) × 「skills 库」× 「六部/职能部门」拼成一张可配置组织图。
> 配套：minister-architecture / ROADMAP / 御史台脚本。**这是组织蓝图(配置 spec);差异活在数据,本图就是那份数据。**

## 0. 怎么读（每个部门 = 五层身体）
```
部长 = 🧠agent判断脑(本体) + 🧬Hermes记忆(护城河,先吃满) + 🧰skill方法论(按需) + 💪OpenClaw手臂(碰产线才伸) ; 军机处/上书房=🎭编排层
```
治理原则：**以当前最优为主，每层可热插拔**；变的是层，不变的是守门（诚实标源/SSOT/人工确认门）。

## 1. 朝堂组织全景
```
                          ┌─────────── 御座(老板·最终裁决) ───────────┐
                          │                                            │
              🎭 上书房(拟旨)   ◀──分层闸──▶   🎭 军机处(会审编排)        │  ← 编排层(主Loop,非单个部长)
                          │  召六部 agent + 读Hermes + 守红线 + 过人工门 │
   ┌──────────────────────┼────────────────────────────────────────────┤
   │  六部(判断型: agent×Hermes 本体, skill 按需, 默认无手臂)            │
   │   吏部/人事   户部/财务   礼部/品牌   兵部/战略*   刑部/法务   工部/工程 │
   ├──────────────────────┼────────────────────────────────────────────┤
   │  职能部门                                                          │
   │   钦天监(预测·skill+cron)  太医院(健康资源台·不诊断)               │
   │   锦衣卫(情报·skill-gate)  史馆(=Hermes可视读面,非agent)           │
   │   御史台(监察·确定性脚本)  翰林院(炼skill·skill-creator)           │
   ├──────────────────────┼────────────────────────────────────────────┤
   │  💪 庄园(OpenClaw 6组重活手臂) —— 默认不挂,需求拉动,过 jiqun:8081  │
   └─────────────────────────────────────────────────────────────────────┘
   * 兵部业务含义待你定义(军事→商战/竞争/危机/红队?)
```

## 2. 各部门配置表（agent seed · 记忆 · skill 清单 · 手臂 · 现状）
| 部门 | 🧠 agent seed(领域人设) | 🧬 记忆命名空间 | 🧰 skill 清单(方法论层) | 💪 手臂 | 现状 |
|---|---|---|---|---|---|
| **吏部/人事** | HR/组织判断 | personnel | `interview-me` `team-builder` `connections-optimizer` | — | 🟢真实 |
| **户部/财务** | 财务/资产判断 | hubu | `finance` `financial-statements` `daily-stock-analysis` `eastmoney_financial_data` `yahoo-finance` `earnings-preview-single` | — | 🟢真实(H盘真账) |
| **礼部/品牌** | 品牌/产品/对外 | libu | `product-manager-ai-workflow` `pm-prd` `pm-competitor` `marketing-automation` `brand-voice` `idea-refine` (+内容矩阵 baoyu/xhs/wechat 按需) | — | 🟢真实 |
| **兵部/战略\*** | 战略/竞争/危机 | bingbu | `pm-competitor` `deep-research` `security-review`(红队) | 罕见 | 🟢(待定义业务) |
| **刑部/法务** | 合规/法律/风险 | legal | `security-and-hardening` `security-review` `security-scan` + 法务方法论 | 碰对外合同/承诺才挂 | 🟢真实 |
| **工部/工程** | 研发/交付判断 | gongbu | `frontend-design` `backend-patterns` `api-and-interface-design` `code-review-and-quality` `test-driven-development` `debugging-and-error-recovery` `ci-cd-and-automation` `database-migrations` `performance-optimization` `chaotang-frontend-design` | 重构造/产线才挂 | 🟢真实 |
| **钦天监/预测** | 极薄调度壳 | qintian | `deep-research` `parallel-deep-research` `iterative-retrieval` `trending-hub` `ai-hot-news-digest` + cron 节律 | — | 🟡碰mock→补真源 |
| **太医院/健康** | 健康资源判断 | taiyi | 健康资源调研 skill(无临床) `pc-doctor`(系统健康隐喻) | — | 🟡碰mock·**只做资源台绝不诊断** |
| **锦衣卫/情报** | 极薄归档壳 | jinyiwei | **`锦衣卫`**(本职:采证→核查→可信度分级→入库把关) `search-first` `exa-search` `web-access` `agent-reach` +平台情报(`*-search`) | — | 🟡碰mock(RADAR_NODES纯假)→接真源 |
| **史馆/归档** | **=Hermes 可视读面(非独立agent)** | (全局记忆) | `agent-memory` `memory-processor` `continuous-learning` `documentation-and-adrs` | — | 🟡碰mock→接真主库 |
| **军机处+上书房** | **编排层=组合(非单个部长)** | (读全局) | `orchestrate` `planning-and-task-breakdown` `blueprint` `ask-like-pro` `expert-perspective` **`朝堂路由`** `spec-driven-development` | — | 🟡读路径接真主库tasks |
| **御史台/监察** | 确定性脚本(无LLM) | — | **`chaotang-censor`**(本仓) **`朝堂观测`** `code-review` `security-review` `skill-stocktake` `workspace-surface-audit` | — | 🟢已建(censor/depts/watchdog) |
| **翰林院/炼skill** | skill 工匠 | hanlin | `skill-creator` `learn-video-to-skill` `continuous-learning-v2` | — | (CLAUDE.md §14) |
| **庄园/重活** | — | — | (执行,非方法论) | **OpenClaw 6组本体** | 默认关·需求拉动 |

## 3. skills 库梳理（**curated,不堆**）
库里有 ~200 个 skill,但**绝大多数是内容/社媒/视频生产**（baoyu-*/xiaohongshu-*/douyin-*/wechat-*/video/vam/comfyui…），与朝堂部门治理**无关**——按张小龙减法，**只把真服务某部门方法论的挑进 §2 清单，其余不堆**（堆=信号稀释 + 维护地狱）。
- **朝堂专属(必用)**：`锦衣卫`(情报)·`朝堂观测`(御史)·`朝堂路由`(编排)·`朝堂仙狐`·`chaotang-frontend-design`(工部前端)。
- **跨部门通用**：`expert-perspective`(大神视角,任何裁决)·`ask-like-pro`(把问题问成高手级)·`deep-research`(钦天监/锦衣卫/兵部共用)·`skill-creator`(翰林院炼新 skill)。
- **内容矩阵**：仅 **礼部** 营销时按需召（baoyu/xhs/wechat 系列），不进其它部门。
- **SSOT 纪律**：一个 skill 服务多部门时走单一真相源，禁各部私造平行版本（铁律2）。

## 3.5 翰林院 = skill 武库（SSOT 储备库 + 炼 skill 工房）
**所有方法论 skill 住翰林院当"备选",部门/人物按需借调(lazy-load),用完即还——不归任何部门私有(SSOT,铁律2)。**
- 这把"skill 放哪"一次性解决:不散落各部门,集中翰林院,谁要谁借。§2 表里各部的 skill 清单 = 它"常借哪几样",不是"私有哪几样"。
- **进料口(高 IGNORE 门槛)**:`github-hot-radar`(每日新工具→install/skill/IGNORE 三判,默认多数 IGNORE)·`skill-creator`·`learn-video-to-skill`·`continuous-learning-v2`。每天"挑",不每天"囤"——否则 200 skill 变噪声。
- **定海规则「用 skill 还是 agent」(每一层同一条)**:判断/担责→**agent**;可复用方法/工具→**skill(住翰林院)**;多方协作涌现→**蜂群(编排多 agent)**;重活执行→**OpenClaw 手臂**。
- **逐粒度**:人物(persona)=agent+借 skill · 部长=agent+借 skill · 各司=判断子职用部长**子 seed**(一壳多头)/纯方法用 **skill** · 蜂群=多 agent 编排 · 翰林院里的=skill。**别为每个司造雪花 agent。**

## 4. 这套配置的价值（怎么让综合能力最强）
1. **复利**：每部默认背 Hermes 记忆 → 判断随裁决次数自动变强（旧案更厚、画像更准），**不花钱**。这是唯一向上复利的层。
2. **解耦/可换**：判断(便宜可换底模)、记忆(复利护城河)、方法(skill 可版本化)、执行(贵·按需租)四层独立扩展；换模型只动 seed、加方法只挂 skill。
3. **专业深度按需加**：skill 只给真有方法的部门(礼部品牌/刑部法务/工部工程)，深度不稀释、不养僵尸。
4. **成本被钉住**：投入只浇复利层，线性层(算力/OpenClaw 劳力)按需租 → 能力曲线↑、成本曲线钉住。
5. **可审计/可复制**：差异活在数据(seed+记忆+skill清单)，一壳 N 行配置 → 新部门边际成本近零，红线在 harness 单点强制。
6. **诚实**：碰 mock 的 6 部先 agent+诚实空态，绝不四件套凑齐冒充 LIVE。

## 5. 怎么运转（一个请求流经五层）
```
老板上书房提问
  └─① 上书房(编排)读 Hermes 记忆 → 召回同类旧案注入(MIXED)
     └─② 召对口部长 agent(seed 判断脑) → 按需懒加载该部 skill(方法论) → callLLM 接地裁断
        └─③ 缺证/高风险 → 军机处(编排)走分层闸:
             · 咨询级 → 秒级出奏折
             · 碰真实产线资产(报价/BOM/交期) → 升级 OpenClaw 手臂(jiqun:8081代理)分钟级深办 → 过人工确认门
        └─④ 老板裁决(采纳/补证/驳回) → 高风险必过人工门
           └─⑤ 史馆归档 = 反写 Hermes(只写采纳态,带真trace) → 下次同类秒级命中(飞轮复利)
  贯穿:御史台(确定性脚本)每日巡查健康+诚实纠察;源标全程诚实标 LIVE/MIXED/FALLBACK/DEMO
```

## 6. 配置落地状态（spec vs 已wired,以当前最优渐进）
- ✅ **已wired**：六部 agent+seed(真实)·御史台脚本·gated 工厂·诚实矩阵。
- 🟡 **spec待接(按 rollout 顺序)**：① 各部默认挂 Hermes 记忆+反写(Stage2,最高回报) → ② skill 清单工具化懒加载(Stage2) → ③ 碰 mock 6 部补真源+诚实空态 → ④ 编排契约 harness 单点守红线 → ⑤ OpenClaw 手臂(Stage3,需求拉动)。
- ⛔ **前置**：以上全在主闭环上线(PR+FENGQUN_AUTH)之后；当前最优仍是先 ship。

> **一句话**：朝堂 = 一个 harness 壳 + 十几行部门配置(seed+记忆+skill+手臂),不是十几个雪花 agent;六部判断脑已真实在岗,下一步给它们默认挂上会复利的记忆,skill 按需当工具,手臂等需求拉动——把判断租薄、记忆和方法养厚,组织越用越强。
