# 前后端对齐 · 史馆证据档 · 2026-06-08

> 史馆归档：上书房 Study Edict（下旨/深度参审）前端与 jiqun_ai 后端 `:8081` 的真实往返对齐审计。
> 本档只记事实，证据 JSON 已落盘，可逐字段复核。

---

## 1. 方法（无 mock，真往返）

对真实后端 `:8081` 同时跑两条路径、两种 mode：

- **路径**：经前端代理 `/api/court/chaotang/[...path]` **和** 直连后端 `/api/chaotang/study/run`。
- **mode**：`dry_run`（快，无蜂群）与 `live`（真实蜂群 `swarm_orchestrator`）。
- **无任何 mock**：响应原样落盘为证据。

证据 JSON：

| 文件 | mode | source_mode | 含 run_adapter | created_at |
|------|------|-------------|----------------|------------|
| `dev/reference/artifacts/alignment-2026-06-08/real_live_edict.json` | live | `LIVE_SWARM` | 是 | 2026-06-08T15:05:54 |
| `dev/reference/artifacts/alignment-2026-06-08/real_dry_edict.json` | dry_run | `MIXED` | 否 | 2026-06-08T15:04:58 |

---

## 2. 发现（Findings）

| # | 等级 | 发现 | 证据 |
|---|------|------|------|
| 1 | **P0 · 打挂生产** | FE catch-all 代理硬编码 `AbortSignal.timeout(20_000)`；真实 live 蜂群跑 51.7s。经代理调 live study/run 在 20.04s 返回 **HTTP 502 `代理失败: timeout`**；直连后端 **HTTP 200 / 51.7s**。 | `src/app/api/court/chaotang/[...path]/route.ts:34`（`signal: isStream ? undefined : AbortSignal.timeout(20_000)`）；502 在 line 36-39 |
| 2 | **P1 · 漂移** | 后端发 `source_mode = 'LIVE_SWARM'`，但 FE `StudyEdict` 联合只有 `'LIVE'｜'MIXED'｜'FALLBACK'｜'DEMO'`，末尾 `\| string` 把这处不匹配藏住了（永不报错）。 | `src/lib/api/chaotang.ts:101` |
| 3 | **P1** | 代理是哑管道：`upstream.text()` 透传，无封套校验；后端 404 / 字段改名会被静默转发。 | `route.ts:49-52`（text passthrough，无 envelope 验证） |
| 4 | **P2 · theater** | 3 处硬编码 `● LIVE` 绿灯，与后端状态无关（永远绿）。 | `src/features/intel/components/intel-hero-map.tsx:390`、`src/features/command-center/components/execution-log-stream.tsx:48`、`src/features/imperial/overview/components/overview-support-panels.tsx:423` |
| 5 | **设计事实** | 主「下旨」UI 走 `dry_run`（MIXED，约 1.6s，无蜂群）；仅 `/throne/brief/[taskId]` 走 `mode:'live'`。 | `src/features/shangshufang/ShangshufangPage.tsx:1430`（`chaotang.studyRun(cmd, 'dry_run')`）；`src/app/(dashboard)/throne/brief/[taskId]/page.tsx:76,119`（`mode:'live'`）。`studyRun` 默认 `dry_run`：`chaotang.ts:174` |

---

## 3. 已验证对齐（good · 实测一致）

真实 live 封套与 fixture 逐字段核对，**无缺字段、无多字段**：

- **顶层键全等**：live 与 dry 唯一差异是 live 多 `run_adapter`（dry 不含）；其余 11 个顶层键完全相同
  （`run_id / source_mode / title / verdict / summary / departments / evidence / risks / next_actions / quality_gate / created_at`）。
- `run_adapter.name == 'swarm_orchestrator'`。
- `run_adapter.replay_artifact.owner == 'shiguan'`。
- `quality_gate` 四字段齐备：`status / score / reasons / human_signoff_required`（live 额外带 `config`）。
- `evidence` 携带 `swarm_orchestrator` 与 `swarm_replay_artifact` 来源（真实蜂群会话 + 史馆复盘入口）。
- 后端 harness 黄金契约与真实输出逐字段一致。

证据：`real_live_edict.json` 的 `run_adapter` 块 + `evidence[].source`；与 `real_dry_edict.json` 顶层键 diff。

---

## 4. 决策（Option C · 用户已批准）

- `dry_run` = **诚实主线回路**：快、标 `MIXED`、与后端字段对齐 —— 作为「下旨」默认路径。
- `live`（深度参审）= **显式动作**，UI 明标「约 1 分钟」，走 **async / SSE**。
- **刻意不为同步路径粉饰那 20s 代理超时** —— 同步 live 经代理必然在 20s 断；正解是把 live 改成异步，
  而不是把超时调大假装能扛 51.7s。故 live 异步化**推迟到 P1**。

---

## 5. 修复状态（截至本档落盘 · 据磁盘实况）

### 已落地

| 项 | 证据 |
|----|------|
| 共享 zod `ZStudyEdict` / `ZStudyEnvelope`，`source_mode` 严格 `z.enum`（未知值 parse 失败） | `src/lib/contracts/study-edict.ts`（含 `STUDY_SOURCE_MODES` 5 值，`LIVE_SWARM` 在列；`run_adapter` 整块 `.optional()`） |
| FE 联合追加 `LIVE_SWARM` | `src/lib/api/chaotang.ts:101` |
| `run_adapter` 类型化（含 `replay_artifact`） | `chaotang.ts:82` 注释指向 `ZStudyRunAdapter` |
| 证据 JSON 落盘并被契约档引为「地面真相」 | `study-edict.ts:10-12` 注释锚定两份 artifact |
| e2e fixture 对 `ZStudyEdict` 校验 | `e2e/true-loop-contract.spec.ts:3` 已 `import { ZStudyEdict }` 并据其校验 fixture |

### 收尾后全部落地（2026-06-08 编排者实测复核）

> 本档初稿由并行 agent 落盘；当时 consumer A/C/D 仍在写盘，初稿据该瞬时快照误记下列为「未落地」。
> 编排者随后按磁盘 + 真验证门逐项复核，全部已落地：

| 项 | 证据（实测） |
|----|------|
| 代理硬化（非封套 / 4xx 时 warn + 标注降级） | `route.ts:81` `logger.warn('chaotang BFF proxy: upstream contract breach')` + `:90` 返回 `{success:false,_degraded:true,_upstreamStatus}`。实测：坏路由经代理 → `HTTP 404 {"success":false,"_degraded":true,"_upstreamStatus":404}`；合法封套仍 `200`、`_degraded` 缺省，不受影响 |
| 代理 20s 超时（同步 live 路径） | **按决策刻意保留** `AbortSignal.timeout(20_000)`（`route.ts:34`）—— 同步 live 必断是预期，正解是 live 异步化（P1），不粉饰超时 |
| 3 处 theater `● LIVE` 绿灯移除 | `grep -rn '● LIVE' src` = **0**。execution-log-stream 改为真信号派生（`hasLive=runs.some(running)` → 绿 `● 实时执行` / 否则灰 `○ 静态回看`）；intel-hero-map + overview-support-panels 无真实信号源 → 诚实标 `◌ 演示`（暗金 #8A6A2A，非绿 #3DD68C） |
| `scripts/verify-study-edict.mjs` 真后端契约门 | 已创建 + `package.json` script `verify:study-edict`。实测打 `:8081` dry_run **27/27 PASS · exit 0**；坏端口 → exit 1（红得起来，非 theater） |
| **焊入发布门**（2026-06-08 大神采纳的天才建议） | `scripts/final-release-harness.mjs` 新增 `checkStudyEdictContract()`，并入 strict-block + report + 最终退出码（`studyEdictGate.ok` 参与 exit）；`HARNESS_SKIP_STUDY_EDICT=1` 仅供页面调试。**从此每次发布必打一次真后端**，后端契约漂移会先于客户红给我们看 |

验证门汇总（编排者实跑，非 agent 自报）：`tsc --noEmit` exit 0 · `verify-study-edict` 真后端 PASS exit 0 · true-loop E2E **2 passed**（含 `fixture conforms to ZStudyEdict`）· 代理 happy `200` / degrade `404`-labeled · `grep '● LIVE'` = 0。

---

## 6. P1 待办（TODO）

> **复核更正（2026-06-08）**：全仓 **唯一** `studyRun` 调用是 `ShangshufangPage.tsx:1430` 的 `dry_run`；
> `throne/brief` 的 `mode:'live'` 是 `Task` 数据字段默认值，**不是** study/run 调用。
> 即 **当前没有任何前端流调用 live study/run** → 那条「20s→502」是**潜伏约束（latent）**而非线上活跃断点。
> 启动已是 de-facto Option C：**没有 502 按钮可隐藏**。后端 decree→task→`/api/chaotang/stream/{task_id}` 的 SSE 异步进度通道**已存在**。

- **(a)** ~~`live` 下旨改 async~~ → 重定为「未来若新增 live 深度参审 UI」的**前置条件**：必须走 async（拿 `session_id` + 已存在的 `/api/chaotang/stream/{task_id}` SSE 推进度 / 轮询 replay artifact），不得同步调 live。已在 `src/lib/api/chaotang.ts` 的 `studyRun` 上加守门注释；20s 代理超时**刻意保留为 fail-fast tripwire**（未来谁同步调 live 会立刻 502 报警，不静默）。
- **(b)** ~~隐藏 live 按钮~~ — **moot**：不存在 live study/run 按钮（无调用方）。
- **(c)** ~~收尾未落地修复项~~ — **已完成（2026-06-08）**：代理硬化、theater 绿灯移除、`verify:study-edict` 契约门 + 焊入发布门 + 每日 `--live` cron 抽检。

---

🎲 大神视角（charity-majors）
⚠️ 警示：本档最危险的不是那 20s 超时，而是 `\| string` 这种"宽容联合"和哑管道 `upstream.text()` —— 它们让**契约漂移与 404 在生产里静默通过**，你看到的绿灯和 200 都可能是假的，等真出事时没有任何 trace 能告诉你后端字段早改名了。
💡 天才建议：在代理那道门加一行：对非 SSE 响应先 `ZStudyEnvelope.safeParse`，`!success` 时不抛错也不假装成功，而是返回带 `degraded: true` + parse error 摘要的封套，并 `logger.warn` 打出 upstream status —— 让"代理通了但形状变了"在账面上可被一眼区分，这比把超时从 20s 调到 60s 有价值得多。
