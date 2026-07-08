# 朝堂运行时全景图 · 端口分配 + 数据归属 + OpenClaw/Hermes 关键位置

> 状态：运行参考。2026-06-24 沉淀，配套 integration-plan / usage-design / fix-triage。
> 目的：消除两类担心 —— **端口冲突**（谁占哪个口）与 **数据混乱**（谁写哪张库）。

## 1. 端口分配总表（**每个服务一个固定口，互不重叠 = 不冲突的根本**）
| 端口 | 服务 | 谁起 / 怎么起 | 当前(2026-06-24 实测) | 冲突纪律 |
|---|---|---|---|---|
| **3050** | Next **prod**（朝堂 web） | `pnpm start`（nginx upstream 指它） | DOWN | 生产唯一对外口 |
| **3002** | Next **dev**（朝堂 HMR） | `pnpm dev` | **活** | 本地开发用 |
| ~~3001~~ | — | — | — | **禁用**（AGENTS.md §0，绑了会顶生产） |
| **4444** | LiteLLM 网关（模型统一入口） | 独立进程 | **活(200)** | 所有 callLLM 经它 |
| **8081** | jiqun 后端（蜂群/flow/产线） | jiqun serve | **活(200)** | 前端唯一允许直连的后端口 |
| **18789** | OpenClaw 网关（重型执行） | npm-global openclaw | DOWN（按需起） | 仅 jiqun 内部连，**前端禁直连** |
| **8644** | Hermes **business** 网关（会诊） | `HERMES_PROFILE=business run-hermes-dev.sh` | DOWN | 仅 jiqun 内部连（Stage4），**前端禁直连** |
| 8642 | Hermes dev | profile=dev | — | Hermes 多 profile 隔离 |
| 8646 | Hermes local | profile=local | — | 同上 |
| 18003 | legal_agent 上游 | 独立进程 | DOWN | upstream-client 走它 |
| 11434 | ollama（本地模型） | ollama serve | 活 | LiteLLM 后端之一 |

> **防冲突要点**：① Next 只许 3050/3002，3001 永久禁用；② Hermes 三个 profile 各自独立口（8644/8642/8646）不互撞；③ OpenClaw/Hermes/legal_agent 各占独立高位口，且**只被 jiqun 连、前端永不直连**（见图）。服务按需起，down 不等于冲突。启动失败先 `ss -tlnp | grep :端口` 看谁占，**别默默 kill**。

## 2. 运行流程图（请求从哪进、OpenClaw/Hermes 在哪几处起作用）
```
浏览器 ──▶ nginx(app.mingshuoxny.com/chaotang) ──▶ Next :3050(prod)/:3002(dev)
                                                       │  朝堂 BFF (/api/court/*)
   ┌───────────────────────────────────────────────────┼────────────────────────────────────┐
   │ ① 拟旨 draft-edict   : 本地确定性，callLLM ─────────┼──▶ LiteLLM :4444 ─▶ 各模型          │
   │ ② 缺证检查           : 本地 + 查旧案(经 jiqun 记忆)  │                                      │
   │ ③ 军机处 swarm-deepen: gated 工厂 createLiveSwarmAdapter() (默认 jiqun)                    │
   │ ④ 裁决 / 史馆        : 写主库 tasks(同一 taskId)    │                                      │
   └───────────────────────────────────────────────────┼────────────────────────────────────┘
                          前端只连这一条 HTTP(铁律13.2-9)│ jiqun-adapter → :8081/api/swarm/run
                                                         ▼
                                                 jiqun 后端 :8081
   ┌──────────────────────────────────────────────────────────────────────────────────────────┐
   │ flow_engine / 蜂群 每次 run：                                                               │
   │   • run 入口 : memory_store FTS5 检索旧案+画像注入   ◀──[Hermes 记忆①·已免费在用]           │
   │   • callLLM  : ──▶ LiteLLM :4444                                                            │
   │   • manor 6组: resolved_runtime() 判定                                                      │
   │        ├─ 未配 OPENCLAW_*_URL → spawn(本地子agent)   ← 当前默认态                            │
   │        └─ 配了URL(Stage3)     → openclaw_dispatch ──▶ [OpenClaw :18789]                     │
   │   • (Stage4) hermes-expert tier → HermesClient ─────▶ [Hermes 网关 :8644]                  │
   │   • run 完成 : save_run → memory_store               ──▶[Hermes 记忆③·反写,闭合飞轮]        │
   └──────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. OpenClaw / Hermes 在运行中"起作用"的关键位置
| 能力 | 起作用位置 | 占端口 | 现在态 |
|---|---|---|---|
| **Hermes 记忆①（召回）** | jiqun `flow_engine` **每次 run 入口**：检索旧案+画像注入拟旨/会审 | **不占口**（jiqun 内 SQLite `memory_store.db`） | **已在用** |
| **Hermes 记忆③（反写）** | jiqun **run 完成**：`save_run`→memory_store（Stage2 补 OpenClaw 深结果反写） | 同上 | 记忆已写、OpenClaw 反写待 Stage2 |
| **OpenClaw（执行）** | **军机处 swarm-deepen** → jiqun:8081 → manor 6组 `openclaw_dispatch` | jiqun 连 **:18789** | 默认 spawn，未接（Stage3） |
| **Hermes 网关②（会诊）** | jiqun `hermes-expert` tier → HermesClient | jiqun 连 **:8644** | 标签态，未接（Stage4） |
| **legal_agent** | upstream-client `/consult` | 连 **:18003** | 上游服务 |

> 关键认知：**Hermes 记忆不占端口、不是网络服务**，它是 jiqun 进程内的 SQLite 记忆层，每次 run 自动起作用——所以它"在哪起作用"= flow_engine 的入口与出口两处，永远不会和任何端口冲突。会"占端口、可能冲突"的只有 **OpenClaw :18789 / Hermes 网关 :8644**，且这俩**只被 jiqun 连**，前端永不直连。

## 4. 数据存储归属（防数据混乱的根本：每张库一个主人）
| 数据 | 库/位置 | 主人 | 谁写 | 谁读 |
|---|---|---|---|---|
| **朝堂主库 `tasks`**（决策 SSOT） | Turso 或本地 `file:./.chaotang-main-dev.db` | 朝堂 BFF | 下旨/dispatch/orchestrate/裁决/史馆 | briefing/史馆/今日完成 KPI |
| **Hermes 记忆 `memory_store.db`**（旧案召回） | jiqun 内 SQLite+FTS5 | jiqun flow_engine | 每次 run 完成 save_run | run 入口检索注入 |
| `forecast_scenarios`（钦天监情景） | Turso | 钦天监 BFF | seed/AI 刷新 | forecast 页 |
| 史馆归档 | 主库 tasks 衍生 | 史馆 | 优质裁决归档 | 下次旧案引用 |

> **防混乱三铁律**：
> 1. **主库 tasks 是决策 SSOT**——所有下旨/裁决/史馆读写**同一 taskId**，不另起平行表（铁律2）。
> 2. **记忆库 ≠ 主库**：`memory_store`(召回，可有旧案/降级案) 与 `tasks`(决策真相) **物理分离**；反写时**两层切**——结论摘要进 memory（带真 trace_id），全文进主库（taskId 指针），不互相污染。
> 3. **source-label 诚实**：每条结论标 LIVE/LIVE_SWARM/MIXED/FALLBACK/DEMO，真 trace 才 LIVE_SWARM——让审计能区分"实时真做"vs"引用旧案"vs"降级兜底"，数据来源永不混淆。

## 5. 你担心的两类问题 —— 现状答复
- **端口冲突**：当前设计每服务固定独立口、互不重叠；Next 严守 3050/3002（3001 禁用）；OpenClaw/Hermes/legal_agent 各占高位口且只被 jiqun 连。**唯一真实风险**是有人手动起服务时端口写错或前端绕过 jiqun 直连 :18789/:8644——后者已被 §3 的 **gated 工厂 + 引擎边界红线**堵死。
- **数据混乱**：主库 tasks 单一真相 + 记忆库物理分离 + source-label 诚实 + 反写两层切。**唯一真实风险**是 SSOT 枚举跨系统漂移（铁律2）——需前后端 import 同一张枚举表，已列入 fix-triage 的跨仓项。

## 6. 运行自检命令（怀疑冲突时跑）
```bash
ss -tlnp | grep -E ':3050|:3002|:4444|:8081|:18789|:8644'   # 看谁在占
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/   # jiqun 活否
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4444/health/liveliness  # LiteLLM 活否
```
