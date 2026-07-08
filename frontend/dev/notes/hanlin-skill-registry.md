# 翰林院 · skill 武库注册表（SSOT 储备库 + 炼 skill 流水线）

> 2026-06-24。翰林院已是朝堂真实板块(`src/features/hanlin`、`/hanlin`、skill-forge、苏轼当翰林),本表是它的 **skill 武库数据(SSOT)**。
> 配套全景图(chaotang-PANORAMA.md §3.5)。**这是配置 spec(差异活在数据);wiring 进 hanlin feature(现 mock)属上线后 Stage。**

## 0. 翰林院的炼 skill 生命周期（贴合现有 HanlinSignal 契约）
```
scouting(侦查) → incubation(孵化) → export(交付部门借调)
  github-hot-radar   skill-creator       penpot 等成品
  /learn-video       /continuous-learning  → 各部门按需借
```
- **scouting 进料口** = `github-hot-radar`（每日 GitHub 新工具 → install/skill/**IGNORE** 三判，**默认多数 IGNORE**）+ `learn-video-to-skill`（视频 → skill）。
- **incubation 孵化** = `skill-creator` + `continuous-learning-v2`（把侦查到的方法炼成本地 skill）。
- **export 交付** = 成品 skill 入武库，部门**按需借调**(lazy-load)，**不私有**(SSOT,铁律2)。

## 1. 入住名单（本次两个点名 skill）
| skill | 生命阶段 | 角色 | 主借部门 | 状态 |
|---|---|---|---|---|
| **github-hot-radar** | scouting | **翰林院进料口**：每日侦查 GitHub 热门工具，三判 install/skill/IGNORE，喂 incubation | 翰林院(本院) | ✅ 已装(`~/.claude/skills/github-hot-radar`)·入住 scouting 位 |
| **penpot-uiux-design** | export | 成品设计 skill：Penpot UI 设计(design tokens/设计系统/原型/design-to-code/审计迭代 UI) | **礼部**(品牌视觉·主) / 工部(app UI·副) | ✅ 已装·入住 export→礼部 |

> **penpot 能做什么**：Penpot 里设计/审计/迭代 UI、建 design tokens 与设计系统、做原型与 design-to-code。礼部用它做**对外品牌视觉/营销物料**；工部借它做 **app 控制台 UI**（如上次提的 VaMAssistant 控制台）。**住翰林院、两部门共借**——这正是"skill 不私有、按需借"的 SSOT 模型。

## 2. 全武库 → 部门借调映射（curated，§2 全景图同源）
| 部门 | 常借 skill |
|---|---|
| 户部/财务 | finance · financial-statements · daily-stock-analysis · eastmoney · yahoo-finance |
| 礼部/品牌 | product-manager-ai-workflow · pm-competitor · marketing-automation · brand-voice · **penpot-uiux-design** · 内容矩阵(按需) |
| 刑部/法务 | security-and-hardening · security-review · security-scan · 〔法务 skill 缺·见 §3〕 |
| 工部/工程 | frontend-design · backend-patterns · api-and-interface-design · code-review · TDD · ci-cd · **penpot-uiux-design** · chaotang-frontend-design |
| 吏部/人事 | interview-me · team-builder · connections-optimizer |
| 钦天监 | deep-research · parallel-deep-research · trending-hub · ai-hot-news-digest |
| 锦衣卫 | **锦衣卫** · exa-search · agent-reach · web-access · 平台情报(*-search) |
| 太医院 | 〔健康资源 skill 缺·见 §3〕 · pc-doctor(系统健康隐喻) |
| 史馆 | agent-memory · memory-processor · continuous-learning · documentation-and-adrs |
| 军机处/上书房 | orchestrate · planning-and-task-breakdown · blueprint · ask-like-pro · expert-perspective · 朝堂路由 |
| 御史台 | chaotang-censor(本仓) · 朝堂观测 · code-review · skill-stocktake |
| 翰林院(本院) | github-hot-radar · learn-video-to-skill · skill-creator · continuous-learning-v2 |
| 跨部门通用 | expert-perspective(大神视角) · ask-like-pro · deep-research |

## 3. 缺口 + GitHub 侦查结果（高 IGNORE 门槛，张小龙/Dieter Rams）
**结论：库已 ~200 skill 很全，真缺口仅 2 个，且都该"孵化"而非"装"。**
| 缺口 | GitHub 侦查 | 处置 |
|---|---|---|
| 刑部·法务/合同审查 skill | 无现成干净 skill | → 翰林院 **incubation**：用 skill-creator 炼一个"合规/合同风险审查"本地 skill(基于刑部真实判例) |
| 太医院·健康资源(非临床) skill | 无现成 | → incubation：炼"健康养生资源台"skill，**严守不诊断**铁律 |
| (设计补强,非缺口) | `nexu-io/open-design`(259 skill/142 设计系统,支持 OpenClaw/Hermes) | → github-hot-radar **watch-list**：penpot 已够礼部用，**暂 IGNORE**，体量大时再评估 |
| (人事补强,非缺口) | `santifer/career-ops`(14 skill 模式·求职/招聘) | → watch-list：吏部现有 skill 够用，**暂 IGNORE** |
| (技能合集料源) | `affaan-m/ECC`(ECC harness:skills/instincts/memory) | → 已是本机 ECC 体系来源,无需重装 |

> **纪律**：不为"找到了就装"而装(github-hot-radar 默认 IGNORE)。库已富,**部门缺的是判断与记忆,不是更多 skill**。真缺的两个走孵化、用真实业务数据炼,而非空降一个泛泛 skill。

## 4. 落地状态（以当前最优为主）
- ✅ 本注册表(武库 SSOT 数据) + 两个 skill 入住(scouting/export 位)。
- 🟡 待上线后 Stage：把本表 wiring 进 hanlin feature(现 `hanlin-home-mock.ts` 是 mock,属诚实矩阵 🟡)，让 `/hanlin` skill-forge 真读这份武库；各部门 agent 真按需 lazy-load 借调(架构 Stage2)。
- ⛔ 前置：仍在主闭环上线之后。**当前最优=先 ship**(见运维一页纸)。
