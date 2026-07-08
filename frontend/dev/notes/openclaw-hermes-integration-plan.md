# OpenClaw / Hermes 接入朝堂 · 实施方案

> 状态：方案（未写码）。2026-06-24 由就绪度会审（4 路 Explore + 收敛）沉淀。
> 适用切点：上书房拟旨后的 **军机处深挖（swarm-deepen）** 段。拟旨本身（draft-edict）按设计保持本地确定性，**不在本方案改动范围内**。
> 前置：本方案落地前先回答铁律13.2-9——「该走前端咨询引擎，还是转后端产线引擎」。OpenClaw 的 6 组（intel/content/finlaw/rnd/exec/review）多属真实产线资产，必须走后端。

---

## 0. 就绪度结论（一句话）

- **OpenClaw**：后端全通（`openclaw_client` + `flow_engine` step + 服务真跑在 `:18789`），差 **配 6 个 env + 前端解禁**，约 2-3 步。
- **Hermes**：①记忆增强（FTS5 旧案注入）**已随 jiqun 路径在用、0 步**；②独立「38 专家会审网关」（`:8644`）后端**缺打 :8644 的 dispatch 客户端 + API key 未定义**，约 3-4 步。

---

## 1. 架构红线（不可违反 · 铁律13.2-9）

```
前端 adapter  ──HTTP──▶  jiqun :8081 /api/swarm/run  ──▶  后端代理到 OpenClaw(:18789) / Hermes(:8644)
   （朝堂 BFF）              （唯一产线入口）                    （重型/产线执行器）
```

- ❌ **严禁**前端 CourtOS runtime 直连 `:18789` / `:8644` 自建第二套产线 flow / 第二套奏折格式 / 第二套质门。
- ✅ 前端只认 jiqun `:8081`；OpenClaw/Hermes 的真实路由发生在**后端**（`manor_groups.resolved_runtime()` 按 env 决定 spawn 还是 openclaw_dispatch）。
- ✅ 产出必须经 `normalizeLiveAdapterTrace`（`src/core/courtos/runtime/live-swarm-adapter.ts:83`）归一，只有真 `trace_id` 才标 `LIVE_SWARM`，否则降级 `MIXED/FALLBACK`，绝不伪装。

---

## 2. OpenClaw 接入 —— 两条路径（强烈建议 A 先行）

### 路径 A：后端透明（最小路径，**0 前端代码**）— 推荐先做

**原理**：jiqun 的 `manor_groups.resolved_runtime()`（`jiqun_ai_fresh/src/manor_groups.py:26`）只要对应组的 `openclaw_base_url_env` 有值，就把该组的 step 从 `spawn` 自动升级到 `openclaw_dispatch`（`flow_engine.py:2238`）。前端现有的 `createJiqunLiveSwarmAdapter`（swarm-deepen 已在用）打的就是 `/api/swarm/run`，**升级对前端完全透明**。

**步骤**：
| 序 | owner | 动作 |
|---|---|---|
| A1 | 运维/后端 | jiqun `.env` 配齐 6 个 `OPENCLAW_*_URL`（`OPENCLAW_INTEL_URL` / `CONTENT_URL` / `FINLAW_URL` / `RND_URL` / `EXEC_URL` / `REVIEW_URL`）指向 `:18789` 或各组网关。对照 `config/manor_groups.yaml` 的 `openclaw_base_url_env`。 |
| A2 | 后端 | 验证端到端：对某组发 `/api/swarm/run`，确认 `assemble_flow` 走 `openclaw_dispatch`，失败有 `fallback spawn`（`flow_engine.py:2238` 已实现）。 |
| A3 | 前端 | **无需改码**。在 swarm-deepen 真实跑一次，确认产出带真 `trace_id`、`source_label=LIVE_SWARM`、任务刷新不丢。 |

**收益**：最快让 OpenClaw 真正参与军机处深挖。**代价**：用户侧看不到「这是 openclaw 而非普通 jiqun」的区分，也不能按请求选 runtime。
**先做 A 的理由**（Sam Altman）：能力由真实需求拉动。先用 A 验证「OpenClaw 深办真的比秒级 dept-agent 更有价值」（哪个真实场景值得等几分钟？PACK 报价 / 法务深审？），**验证有价值后再投入 B**。

### 路径 B：显式前端 adapter（完整路径）— 按需，A 验证有价值后再做

需要「用户可见地选 openclaw runtime + capability 门控 + 独立 trace」时才做。

**步骤**：
| 序 | owner | 动作 | 真实锚点 |
|---|---|---|---|
| B1 | 前端 | 新建 `src/core/courtos/runtime/openclaw-live-swarm-adapter.ts`，照 `jiqun-live-swarm-adapter.ts:118` 范式实现 `createOpenclawLiveSwarmAdapter()`：仍 POST `jiqun:8081/api/swarm/run`，body 增 `runtime:'openclaw'`（或 `force_runtime`）提示后端强制走 openclaw；`capability().state='ready'`、`supports_trace=true`。**严禁直连 :18789**。 | 实现 `CourtLiveSwarmAdapter`（`live-swarm-adapter.ts:49`） |
| B2 | 前端 | swarm-deepen 路由参数化：把 `route.ts:84` 的硬编码 `createJiqunLiveSwarmAdapter()` 改成按 `adapter_id` 选择的工厂（默认 `jiqun`）。POST body 增可选 `adapter_id:'jiqun'\|'openclaw'`。 | `swarm-deepen/route.ts:84` |
| B3 | 前端 | 工厂落一个 `selectLiveSwarmAdapter(adapter_id)`：`openclaw`→新 adapter；`hermes`/`legal_agent`→暂仍 `createDisabledLiveSwarmAdapter`（`live-swarm-adapter.ts:125`）；未知→jiqun。 | — |
| B4 | 前端 | nodetest：`openclaw-live-swarm-adapter.nodetest.ts` 断言 ①未配 env→capability `not_configured`/不能 dispatch；②mock fetch 返回真 trace→`LIVE_SWARM`；③返回无 session→降级不伪装。照 `live-swarm-adapter.nodetest.ts` 范式。 | — |
| B5 | 前端 | e2e：swarm-deepen 传 `adapter_id:'openclaw'` 走通，trace 标 `LIVE_SWARM`，刷新不丢；传无效 adapter→回落 jiqun。 | 照 `e2e/swarm-members.spec.ts` 范式 |

> ⚠️ B 的前提仍是 A1（后端 env）已配——否则前端选了 openclaw，后端无 group 走 openclaw（白接）。

---

## 3. Hermes 接入 —— 分两种诉求

### 诉求①：记忆增强（相关旧案 FTS5 注入）—— 已在用，**0 步**
`jiqun_ai_fresh/src/memory_store.py` + `memory_tool.py`（SQLite+FTS5）已织进 `flow_engine` 每次 run 的历史检索/写入。主闭环走 jiqun adapter 时**已自动受益**。只需在文档/UI 说明「军机处深挖已带相关旧案记忆」，无需接码。

### 诉求②：独立「38 专家会审网关」（`:8644`）—— 约 3-4 步，**比 OpenClaw 多一个后端客户端**
| 序 | owner | 动作 | 卡点 |
|---|---|---|---|
| H1 | 后端 | 新增 `hermes_client.py` 打 `:8644` gateway（OpenAI 兼容 `/v1`），**先解决 API key 鉴权**（`/v1/models` 现返回 `invalid_api_key`——key 从哪来、怎么注入需先定义）。 | **API key 来源未定义**（最大卡点）|
| H2 | 后端 | 像 openclaw 那样加 `step_type`/`runtime`，让 `flow` 能路由到 Hermes 38 专家会审；`decree_swarm_router.py:519` 的 `hermes-expert` 现在只是模型分层标签，需升级为真 runtime。 | — |
| H3 | 前端 | 照 B1/B2 范式补 `createHermesLiveSwarmAdapter()` + 工厂分支（仍打 jiqun:8081，由后端代理 :8644）。 | — |
| H4 | 前端 | nodetest/e2e 同 B4/B5。 | — |

---

## 4. 验证清单（接完任一路径必过）

- [ ] swarm-deepen 真实跑：产出带真 `trace_id`，`source_label=LIVE_SWARM`（非伪装）。
- [ ] 后端不可达 / 无 session：降级 `MIXED/FALLBACK`，**不**标 LIVE_SWARM（`normalizeLiveAdapterTrace` 已保证，需断言）。
- [ ] 任务刷新不丢（写回 `tasks.result_json` 的 `shangshufangDecision`，`swarm-deepen/route.ts:119`）。
- [ ] 引擎边界：grep 确认前端无 `:18789`/`:8644` 直连。
- [ ] root tsc 0 + `NEXT_PUBLIC_API_MODE=real` build 0 + 新增 nodetest 全绿 + 入 CI。
- [ ] 铁律4：写共享主表/给结论加视觉权重则过独立会审 + 一条回归断言。

---

## 5. 风险与决策点（落地前先答）

1. **要不要 B（显式 adapter）？** —— 先做 A，用真实场景验证 OpenClaw 深办价值，再决定。别为「服务在跑」而接（Sam Altman）。
2. **Hermes 独立网关的 API key 从哪来？** —— H1 的硬卡点，未定义前 H 段冻结，只享诉求①的记忆增强。
3. **OpenClaw 深办把军机处从秒级变分钟级** —— UI 需要「长任务进行态」呈现（进度/可中断），否则用户以为卡死。这是接 B 时的连带前端活。
4. **上线顺序** —— 本方案整体属**上线后增强**，不阻当前 GO-WITH-FIXES（拟旨/六部/军机处主闭环不依赖它们）。先合 master + 设 `FENGQUN_AUTH=true` 上线，再按 A→（验证）→B 推进。

---

## 6. 真实锚点速查

**前端**
- adapter 接口：`src/core/courtos/runtime/live-swarm-adapter.ts:49`（`CourtLiveSwarmAdapter`），`:125`（disabled 工厂），`:83`（trace 归一）
- jiqun 范式：`src/core/courtos/runtime/jiqun-live-swarm-adapter.ts:118`（POST `/api/swarm/run`@`:144`）
- 切点：`src/app/api/court/shangshufang/tasks/[taskId]/swarm-deepen/route.ts:84`（硬编码 jiqun adapter）
- 类型枚举：`CourtLiveAdapterId = 'jiqun'|'openclaw'|'hermes'|'legal_agent'`（`live-swarm-adapter.ts:5`）

**后端 jiqun（`/home/ubuntu/fe/fengQun/jiqun_ai_fresh`）**
- runtime 决策：`src/manor_groups.py:26` `resolved_runtime()`（需 `openclaw_base_url_env` 有值）
- openclaw 执行：`src/flow_engine.py:1105`/`:1728` `_execute_openclaw_step`、`:2238` `_execute_openclaw_dispatch_step`（带 fallback spawn）
- openclaw 客户端：`src/openclaw_client.py`（`post_tasks` 批派）
- 6 个 env：`OPENCLAW_{INTEL,CONTENT,FINLAW,RND,EXEC,REVIEW}_URL`；配置 `config/manor_groups.yaml`
- Hermes：`src/memory_store.py`/`memory_tool.py`（记忆层已接）；`src/decree_swarm_router.py:519` `hermes-expert`（仅标签）；gateway `:8644`（需 API key）
