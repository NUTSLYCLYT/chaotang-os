# 朝堂运行时拓扑 · 端口 / 上游 / 路径（2026-06-24）

> 唯一权威拓扑。脑内传说不算数。改上游接线前先读这里 + `src/lib/upstreams.ts`。
> 融合总设计见对话沉淀「蜂群+jiqun 融合方案：一脊·二擎·一闸·一契约」。

## 1. 端口（监听 / 角色 / 死活）

| 端口 | 角色 | 死活(2026-06-24 实测) | 备注 |
|---|---|---|---|
| **3050** | Next 生产(nginx upstream) | 活 | 公网 `app.mingshuoxny.com/chaotang` 经此;**禁顶占** |
| **3002** | Next dev(HMR) | 按需 | `pnpm dev`,带 `/chaotang` basePath |
| **4444** | **LLM 网关 LiteLLM**(→ Claude via OAuth) | **活** | 咨询引擎命脉;`OPENAI_BASE_URL=http://localhost:4444/v1` |
| **8081** | **真蜂群 jiqun**(产线多 agent 执行) | **DOWN** | 独立仓 `jiqun_ai_fresh`;按需启,不空养 |
| **18003** | 法务专用 agent provider | 按需 | `LEGAL_AGENT_BASE_URL`;真专用上游,非幽灵 |
| ~~3000 / 4000~~ | ~~courtos 旧独立后端~~ | **死·遗物** | 前端≠courtos 时代遗物;**待拆**,见 §3 |
| 3060 / 7894 / 9377 | 来历待确认 | ? | 非本仓上游,审计后补注或忽略 |

## 2. 三真上游（唯一真相源：`src/lib/upstreams.ts`）

| 常量 | env | 默认 | 融合定位 |
|---|---|---|---|
| `SWARM_BACKEND` | `JIQUN_API_URL`/`JIQUN_BASE_URL` | `:8081` | **执行阶段**(圣裁采纳产线动作后) |
| `LLM_GATEWAY` | `OPENAI_BASE_URL` | OpenAI / LiteLLM`:4444` | **咨询阶段**(下旨→会审→奏折) |
| `LEGAL_AGENT` | `LEGAL_AGENT_BASE_URL` | `:18003` | 法务专用推理 |

**铁律**：服务端上游 URL **只从 `@/lib/upstreams` import**，禁裸端口 / 裸 `process.env.<上游>`。`guard:upstreams` 守（warn-only，`UPSTREAMS_STRICT=1` 升阻断）。

## 3. courtos 遗物（待拆 · 当前止血）

`COURTOS_API_URL`(:3000/api/v1) / `INTERNAL_API_URL`(:4000/api) = 前端独立于 courtos 后端时代的产物。**前端现在就是 courtos**，此独立后端死链居多，却仍被 ~83 文件 / 113 处引用（`guard:upstreams` 可见），多条路由（hanlin/petitions/shiguan/backend/*）在**静默失败 → 本地兜底**。

- **当前止血**：courtos 调用一律经 `courtosFetch`（进程级熔断 + 快失败，不吃满超时）。
- **逐步拆除**：每条路由迁本地 SoT（primary store）或诚实空态后，删除其 `COURTOS_LEGACY` 依赖；迁移面由 `guard:upstreams` 从 113 → 0 追踪收敛。
- **新代码**：禁新增 courtos 依赖。

## 4. API 路径（收口目标）

主家族 `/api/court/<域>/<动作>`。散落待收编：`shiguan/*`、`scribe/*`、`hanlin/*`、`governance/*`、`qintian/*`、`v1/*`(jiqun 代理)——逐步并入 `court/*`，删重复（如 `court/shiguan` vs `shiguan/archives`）。

## 5. 融合数据流（一脊·二擎·一闸·一契约）

```
下旨 → 丞相润色(LLM_GATEWAY) → 选部+证据门 → 各部 workOrder
   → AgentHarness 唯一调度(铁律13.2.9 按是否碰真资产路由)
       ├ 咨询类 → LLM_GATEWAY 真 agent 红蓝卡 (LIVE)
       └ 产线类 → [执行阶段] SWARM_BACKEND swarm (LIVE_SWARM)
   → 确定性汇总(冲突/否决/缺证) → 御史台门 → 奏折(sourceLabel 分层到部级)
   → ★皇帝圣裁★(一闸) → 采纳产线动作+人工确认 → jiqun 真执行 → 回执 → 史馆归档
```
