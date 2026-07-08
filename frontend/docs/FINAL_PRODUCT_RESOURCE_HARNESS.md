# 最终产品资源利用 Harness

> 目标：把朝堂从“能演示很多东西”收束成“能交付最终产品”的资源决策系统。
> 原则：资源只有四类：进生产、补依赖、留 demo、停用。不能自欺欺人。

## 1. 最终产品定义

朝堂最终产品不是页面合集，也不是角色扮演 UI。

最终产品是：

```text
用户提出真实经营/决策问题
  -> 系统调动可信数据、模型、蜂群与史馆
  -> 输出可裁决、可追问、可落地、可复盘的判断
  -> 史馆记录证据和结果
  -> 下一次更准
```

第一阶段只保留一条北极星链路：

```text
上书房真实问题
  -> 军机/丞相路由
  -> 关键部门参审
  -> 真奏折
  -> 用户采纳/打回/追问
  -> 史馆归档
  -> Model Governor 留判词
```

## 2. 资源盘点范围

每个资源都进同一张表，不因“看起来高级”而免评。

| 资源类 | 例子 | 评估问题 |
|---|---|---|
| 产品入口 | `/overview`, `/settings`, `/scribe`, `/command-center`, `/throne` | 是否服务北极星链路 |
| 业务页面 | 各部门、庄园、太医院、兵部、户部 | 是生产主线还是展示样板 |
| BFF/API | `/api/chat`, `/api/llm/stats`, `/api/court/*`, `/api/agents/*` | 是否真联通、可观测、可降级 |
| 后端依赖 | CourtOS 8081, jiqun, Legal Agent | 是否在线、接口是否匹配 |
| 数据库 | Turso, file ledger, DATABASE_URL | 是否可写、可迁移、可共享 |
| LLM | DeepSeek/OpenAI-compatible, Anthropic, scripted fallback | 是否真 key、是否走 router、是否标 source |
| 蜂群 | agent status, agent run, orchestration, swarm eval | 是否真执行、是否会烧钱、是否有 gate |
| 史馆 | lessons, annals, command cases | 是否能复用经验 |
| 设计资产 | tokens, fonts, nav, capability boundary | 是否支撑信任，不制造误判 |
| 自动化 | Model Governor, true-chain health, eval scripts | 是否能减少幻觉和返工 |

## 2.1 已采纳资源库

本轮先不再外扩素材库，优先把仓库内已经打磨过的高质量资产收进最终版本。

| 资源库 | 路径 | 裁决 | 用途 |
|---|---|---|---|
| 九司 PRD 总览图 | `public/prd/01-09*.png` | `PROD` | 资源阁、模块视觉索引、用户理解系统边界 |
| 上书房主场景 | `public/shangshufang/*.webp` | `PROD` | 最终入口首屏背景、丞相/钦天监人物 |
| 部门场景图 | `public/assets/{dadian,junjichu,hubu,bingbu,jinyiwei,taiyi,shiguan,gongbu}` | `PROD/DEMO` | 已验收模块直接用；未验收模块只在资源阁展示 |
| v4 人物资料 | `public/heroes/v4-*.webp` | `PROD` | 多智能体角色视觉，不再混用旧 `gpt-*` 图 |
| 字体 | `public/fonts/NotoSansSC-VF.ttf`, `NotoSerifSC-VF.ttf` | `PROD` | 中文可读性与宫廷气质统一 |
| Harness Kingdom OS 纯逻辑 | `src/features/court-console/lib/*` | `FIX` | 只抄纯 TS 词表、庄园注册、事件总线；不直接抄 mock UI |

停用原则：

- `public/heroes/gpt-*` 暂不进主线，避免人物风格不统一。
- 重复 PRD 旧命名图如 `public/prd/shangshufang.webp` 只作兼容，不作为最终索引。
- mock 案卷、mock 庄园指标不得在 UI 里伪装成生产数据。

## 3. 四象限裁决

每个资源只允许落入一个状态：

| 状态 | 含义 | 动作 |
|---|---|---|
| `PROD` | 真链路可用，能支撑最终产品 | 进入主线，补监控和验收 |
| `FIX` | 方向对，但依赖缺失或接口不通 | 建修复任务，排优先级 |
| `DEMO` | 只能展示，不能伪装成真能力 | 明示 demo/source，避免进主线判断 |
| `STOP` | 分散资源、误导用户或维护成本过高 | 冻结、隐藏或删除 |

## 4. 评分公式

总分 100，低于 70 不进生产主线。

```text
resourceScore =
  userValue * 0.25
  + liveReadiness * 0.25
  + evidenceQuality * 0.20
  + leverage * 0.15
  + maintainability * 0.10
  - riskPenalty * 0.15
```

字段定义：

| 字段 | 0 分 | 5 分 |
|---|---|---|
| userValue | 用户不会因此更好决策 | 直接改善真实决策 |
| liveReadiness | mock/不可用 | 真 API/DB/LLM 全通 |
| evidenceQuality | 无证据、无日志 | 有输入、输出、成本、截图、判词 |
| leverage | 只服务单页 | 可复用到多任务/多部门 |
| maintainability | 高耦合、无人敢改 | 清晰边界、可测、可回滚 |
| riskPenalty | 无风险 | 安全/成本/信任/单向门风险高 |

阈值：

- `>= 85`: PROD
- `70-84`: FIX 后可进 PROD
- `45-69`: DEMO
- `< 45`: STOP

## 5. 自动探针

第一版用 `GET /api/court/true-chain-health` 作为依赖事实源。

必须覆盖：

1. `Next BFF`
2. `BasePath`
3. `Primary DB`
4. `Decision Ledger`
5. `CourtOS upstream`
6. `Agent invoke upstream`
7. `Legal Agent`
8. `OpenAI-compatible key`
9. `Anthropic key`
10. `Live LLM Provider`
11. `Durable Queue`
12. `Swarm overview`
13. `Agent status`
14. `Agent run`
15. `Model Governor`

任何资源如果依赖项为 `down/missing/mock`，不能标 PROD。

## 6. 大神会审角色

固定 5 人，不扩大会议：

| 角色 | 评什么 | 一票否决点 |
|---|---|---|
| Charity Majors | 可观测性、真实联通、故障定位 | 看不出真/假/降级 |
| Bruce Schneier | 安全、权限、越权、成本攻击 | 绕过鉴权或 fallback 伪装 |
| Karpathy | AI 系统、模型路由、eval | 没评测就说智能 |
| Jobs | 产品聚焦、体验、信任 | 页面多但主线不清 |
| Deming | 质量闭环、复盘、持续改进 | 没证据、没指标、没复盘 |

会审输出必须是：

```yaml
resource: string
decision: PROD | FIX | DEMO | STOP
score: number
why: string
blockingDeps:
  - string
evidence:
  - command or screenshot or API result
nextAction: string
owner: string
```

## 7. 第一阶段资源判断

基于当前体检结果，先给初判：

| 资源 | 初判 | 理由 | 下一步 |
|---|---|---|---|
| 3050 生产前端 | PROD | `/chaotang/settings` 可访问，build 通过 | 保持端口纪律 |
| 3002 dev | FIX | 可启动但本轮探针超时/退出，不稳定 | 只用于本地热重载，不作验收基准 |
| `/api/llm/stats` | PROD | 可读模型与 Model Governor stats | 接入设置页和史馆摘要 |
| Model Governor | PROD-observe | 只读判词，不改路由，风险低 | 跑 30 条样本 |
| `/api/v1/swarms/overview` | DEMO | 本地 mock overview | UI 必须标 mock |
| `/api/agents/status` | FIX | 返回 11 agent idle，但 DB 失败时会假健康 | 增加 status source 标注 |
| `/api/agents/run` | FIX | 当前 `db_insert_failed` | 补主 DB + tasks schema |
| CourtOS upstream 8081 | FIX | health/agents invoke 返回 502 | 对齐后端路由和服务状态 |
| file ledger | PROD-support | 文件台账健康，可支撑复盘/飞轮小闭环 | 不替代主 DB |
| Legal Agent | FIX/optional | 当前 down | 若非北极星必需，降级为 optional |
| 多数展示型部门页 | DEMO | 未证明真数据/真执行 | 保留但明示 demo，不扩主线 |

## 7.1 最终板块收口

按用户体验优先级分块执行，不再把所有页面同等上线。

| Block | 板块 | 用户目的 | 最终状态 | 验收命令/证据 |
|---|---|---|---|---|
| P0-Entry | 上书房 `/court-briefing` | 提真实问题、读一号奏折、下旨 | `PROD` | `scripts/final-release-harness.mjs` |
| P0-Command | 军机处 `/command-center` | 执行、拆解、会审、跳转归档 | `FIX -> PROD` | 页面可打开；真实 run 依赖 CourtOS upstream |
| P0-Archive | 史馆 `/archive` 或 `/shiguan` | 复盘、证据、长期记忆 | `FIX -> PROD` | 页面可打开；归档写入需接任务输出 |
| P1-Overview | 大殿 `/overview` | 总览态势 | `PROD/DEMO 明示` | 页面可打开，无 console error |
| P1-Business | 庄园、户部、兵部、锦衣卫、太医 | 专项业务理解 | `DEMO/FIX` | 保留资源阁入口，未接真数据不作为主线判断 |
| P2-Lab | 其它实验页、极客页、旧样板 | 内部研发 | `STOP from nav` | 不进入最终用户主导航 |

最终导航规则：

1. 顶导只保留高频 6 个：上书房、大殿、东宫、军机处、史馆、庄园。
2. 部门收进“部院”菜单。
3. 资源阁可以展示好资产，但不代表该模块已生产可用。
4. 任何 `DEMO/FALLBACK/MOCK` 必须在页面或数据徽章中显式标注。

## 8. 下一步实施

P0：真链路体检面板

- `/settings` 增加 True Chain Health 面板。
- 展示 `PROD/FIX/DEMO/STOP` 初判。
- 只读，不触发 LLM，不写 DB。

P1：资源清单落库或 JSONL

- 每次体检生成 resource audit case。
- 史馆可召回“哪些资源能用、哪些不能用”。

P2：接入 CI/发布前检查

- `pnpm build`
- `GET /api/court/true-chain-health`
- 若 required dependency down，禁止标记“真链路可用”。

## 8.1 分块执行 Harness

本仓新增本地最终版 harness：

```bash
HARNESS_BASE_URL=http://127.0.0.1:3050 \
HARNESS_BASE_PATH=/chaotang \
node scripts/final-release-harness.mjs
```

检查范围：

1. P0/P1 页面是否可打开。
2. 上书房是否展示 `LIVE` 而不是无说明 fallback。
3. `/api/court/shangshufang/briefing` 是否有奏折数据。
4. `/api/court/events/stream` 是否是 `200 text/event-stream`。
5. 资源阁图片是否加载完整。
6. 桌面控制台是否无 error/warning/failed request。
7. 移动端是否无横向溢出。

放行标准：

- `npm run build` 通过。
- `node scripts/final-release-harness.mjs` 通过。
- `3050` 是唯一最终前端服务。
- `3002/3051/3052` 不作为最终验收链接。

## 9. 最终产品取舍

当前不要继续铺新部门。

优先修：

1. 主 DB：`TURSO_DB_URL` / schema / agent_runs 可写。
2. CourtOS upstream：8081 health / agents invoke / dashboard 对齐。
3. 蜂群真实 run：最少一个 agent 能从任务到完成。
4. 史馆归档：保存输入、输出、证据、判词。
5. UI 明示 source：LIVE / MOCK / FALLBACK。

只有这五项闭环，才叫最终产品的第一版。
