# OpenClaw + Hermes 问题全盘点 · 分诊与升级行动计划

> 状态：分诊（未写码）。2026-06-24 由全盘点会审（5 路读真代码 + 收敛）沉淀。配套：`openclaw-hermes-integration-plan.md`（怎么接）、`openclaw-hermes-usage-design.md`（怎么用）。本文答：**现在能解什么 / 怎么升级 / 所有 bug 冲突怎么处理**。

## 0. 一句话结论
**能解一半，且"想全解决"正是这次最大的红线。** 约 30 个问题里真正"现在该解"约 10 个（前端独立 ~7 个，1-2 天可清，全是诚实化/安全/真 bug）；其余三类不能现在做。

## 1. 三个 CRITICAL 是「设计态」不是 bug（别现在修）
审计给这三项标了 CRITICAL，但严重度衡量的是"上线后还坏多严重"，**不是"现在该不该立刻做"**：
| 项 | 为何现在就该是这状态 |
|---|---|
| OpenClaw 6 个 `OPENCLAW_*_URL` 全未配（组全 spawn） | Stage 0-1 全 spawn 就是正确设计态。现在配=跳到 Stage 3、且无真实重资产需求拉动=空转 |
| Hermes `:8644` 网关 DOWN | 会诊网关是 Stage 4（可选最后）。现在起来接=跳级 |
| OpenClaw output 不反写 Hermes（飞轮单向） | 反写线是 Stage 2，且必须 Stage 1 主闭环产生真实 run 后才有东西可反写。现在做=给不存在的执行流写反写代码 |

把它们当"待修 CRITICAL"去配 URL/起网关/接反写 = 跳过 Stage 0-1 直奔 3-4 = **直接违反 5 大神"先上线主闭环"裁决**。

## 2. 现在就能解（~1-2 天，多为前端独立 + 诚实化/安全/真 bug）
| 项 | owner/工作量 | 说明 |
|---|---|---|
| swarm-deepen:84 硬编码 → `createLiveSwarmAdapterFactory()`（env `LIVE_SWARM_ADAPTER_ID`，默认 jiqun）+ 工厂内 `ROLLOUT_STAGE` 闸（stage<2 非 jiqun 一律拒 409） | 前端/半天 | **一处改动同消两个 CRITICAL**（硬编码+升级闸缺失），不改运行时行为（默认仍 jiqun）。把"升级路径"变成 env 切换而非改代码直连，先堵未来直连红线 |
| sourceLabel 诚实标源全仓审计 + `normalizeLiveAdapterTrace` 返回前加 `assertLiveSwarmTrace(label, traceId)`，无 trace 强制降 MIXED | 前端/1天 | 扫 60+ 处 envelope/route，钉死 LIVE_SWARM 只在真 trace 出现（防伪证污染史馆/KPI） |
| 删空壳 mock `src/app/api/tasks/[taskId]/route.ts`（实证返 `{status:'planning'}` 假数据），调用方改指真实代理 | 前端/1-2h | 防 e2e/前端读到假数据 |
| **`middleware.ts isTokenExpired` ISO 非法仍返 false（漏过）→ 改 `Number.isFinite` 失败返 true** | 前端/1h | **真 bug**，fail-closed 收尾 + 单测 |
| `client.ts safeReal` fallback：`MOCK_FALLBACK_REGISTRY` 接顶栏数据源徽标 | 前端/半天 | 诚实标源 UI 末端 |
| **`openclaw_base_url` 空串守卫**：orchestrator env 空则不写字段→resolved_runtime 返 spawn；post_tasks 前 `if not base_url: raise` | 后端/2h | **真 bug**：消除 `''+'/tasks'='/tasks'` 根路径未定义行为，强化"未配=干净 spawn"契约 |
| memory_store FTS5 trigram 探测+降级日志 + 单条 2000字截断 | 后端/1天 | 把"静默退化 LIKE/丢数据"变可观测，记忆层已免费在用、低风险纯后端 |
| Hermes `:8644` 起网关验活 + 清 `.clean_shutdown` | hermes运维/10min | **只验可达性、不接 jiqun**；清 marker 让 DOWN 不再静默掩盖 |
| decree_swarm_router `hermes-expert` / forecastApi 加注释"待 Stage 4" | 后端/前端 30min | 防误接，诚实归零 |

## 3. 设计上该推迟（及为什么）
- OpenClaw 6 个 URL 配置 → Stage 3（需真实重资产需求拉动）
- 整批超时隔离 / partial success / 续传（HIGH×3）→ Stage 3（OpenClaw 未接=空中楼阁）
- OpenClaw output 反写记忆 → Stage 2（且需 Stage 1 产生真实 run 后才有东西反写）
- Hermes hybrid_retrieval/rerank → Stage 3+（需先定向量维度）
- assemble_flow 多轮 messages → Stage 3（依赖 OpenClaw 多步场景）
- Hermes 会诊网关 RPC（jiqun 建 HermesClient）→ Stage 4

## 4. 升级有序步骤（贴 5 阶段 rollout）
1. **Stage 0（现在·吃满记忆）**：起 Hermes :8644 仅验活+清 marker（不接）；后端补 FTS5 探测+截断+空 base_url 守卫，让"未配=干净 spawn / 记忆可观测"成显式契约。验收：/health 200、memory 有降级日志、所有组 resolved_runtime 返 spawn 无报错。
2. **Stage 1（主闭环上线·最高优先）**：前端开 PR→合 master→jiqun 设 `FENGQUN_AUTH=true`；同步落地前端独立 7 项（adapter 工厂+ROLLOUT_STAGE 闸=1、诚实标源审计、删 mock、数据源徽标、token fail-closed）。验收：真闭环跑通、LIVE_SWARM 只在真 trace、刷新不丢。
3. **Stage 2（反写线先行）**：jiqun `memory_feedback(external_task_id, output)` 骨架 + hermes-agent `_handle_responses` 持久化；用 jiqun 本机 run 验反写（暂无 OpenClaw 喂数据）。验收：一条 run 的中间 step output 进 memory 且被下次 run 检索到。
4. **Stage 3（需求拉动接 OpenClaw）**：出现真实重资产/long-running 需求后配 `OPENCLAW_*_URL`、做超时隔离+partial+续传、接 Stage 2 反写线；前端 ROLLOUT_STAGE→3 解锁 openclaw 适配器。
5. **Stage 4（可选会诊网关）**：jiqun 建 `HermesClient`（Bearer `API_SERVER_KEY`→:8644）；hermes-expert 从标签转真 RPC；前端 ROLLOUT_STAGE→4。

## 5. 最该先消的冲突/红线
1. **别把 3 个 CRITICAL 误当 bug 立即修**——会跳级违反裁决（最大红线）。
2. **引擎边界（铁律13.2-9）**：swarm-deepen 硬编码 jiqun，一旦有人为接 OpenClaw/Hermes 直接改这里手写 fetch :18789/:8644 = 前端直连重型网关。**先落工厂+ROLLOUT_STAGE 闸**，把升级变 env 切换。
3. **诚实标源**：xingbu/legal/result 等有自定义 sourceLabel，verified=false 仍标 LIVE_SWARM = 伪证污染史馆/KPI。Stage 1 随主闭环钉死 `assertLiveSwarmTrace`。
4. **并发改动对撞**：本仓 backend tasks[id]/hubu overview+projects/contracts hubu 正手改，后端若同期改 hubu schema 会双改红 build。**前端先稳定上线，后端再跟**。
5. **SSOT 枚举漂移**：RealityState↔SourceLabel 两套词汇分维护，跨仓未对齐，任一侧改名→静默漂移。认定单一真相源 + 往返单测（铁律2）。

## 6. 诚实提醒（Bezos/Karpathy）
最危险的不是"没接 OpenClaw"，是"为了显得完整而提前接"留下两套通路的僵尸中间态（铁律3）。正确动作是 **ship 主闭环 + 前端 7 项诚实化，让真实需求来拉动后续 stage**，而不是一次性平推全表清空 CRITICAL 计分板。

## 7. 安全事故记录
2026-06-24 盘点 agent 违反"别打印值"指令，把 Hermes `API_SERVER_KEY` 真实值打进 workflow transcript → **该 key 按已泄漏处理，须在 `~/.hermes/profiles/business/.env` 轮换**。
