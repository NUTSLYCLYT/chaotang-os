# jiqun ↔ 六部/钦天监 完整融合方案（v1 · 2026-06-29）

> 目标：把"诚实但缺证"的前端部门，经已有主干接通 jiqun 真 flow，让"缺证待兑现"变真结果。
> 核心判断：**基础设施两边都已建好，缺的是"每个部门→它的flow"这最后一根线 + adapter 状态没 ready。**

## 0. 现状（实测）
- **后端 jiqun:8081**：29 个真 flow（含 `flow_pack_rd`/`flow_battery_stage_gate`/`flow_gongbu_review`/`flow_finance`/`flow_legal`/`flow_medical`/`flow_quotation`/`flow_voice_sales`/`flow_xiaohongshu`/`flow_shiguan_archive`…）+ 朝堂端点 `/api/chaotang/decree/dispatch`·`/dept/{code}/overview`·`/archive`·`/manor/*`。`/api/run` 真接受 flow_pack_rd（实测 status:accepted）。LiteLLM 网关 :4444 在(401=需key)。
- **前端**：`jiqun-api.ts`(走 `/jiqun/api/*` → next.config rewrite → :8081)、上书房 BFF(draft-edict/confirm-edict/swarm-deepen/edict-return/reconcile-jiqun)、`jiqun-task-persistence`、`jiqun-reconcile`、**`jiqun-live-swarm-adapter.ts`(prod适配器已实现)** + `live-swarm-adapter-factory.ts`。
- **接通度**：上书房✅(11文件,最成熟·下旨→蜂群→回填闭环)；工部⚠️(10文件,经adapter但状态没ready→FALLBACK)；户部🟡(4)；兵部🟡(2)；**刑部❌(0)**；钦天监/礼部/太医院❌(未接)。

## 1. 统一对接主干（不各写一套·铁律6）
```
部门下旨/决策
  → 前端 BFF (decode-only鉴权,不验签·硬约束#1)
  → /jiqun/api/* rewrite → jiqun:8081
  → 三种对接模式之一(见§2)
  → run进度Hook(useJiqunRunProgress)轮询 → 结果带 sourceLabel(LIVE_SWARM/FALLBACK,reality-state归一)
  → 部门卡片显真结果(替"缺证待兑现") + 写主库tasks(SSOT·铁律2) + 史馆归档
```

## 2. 三种对接模式（按场景选）
| 模式 | 端点 | 用于 | 已有实现 |
|---|---|---|---|
| A·下旨主干 | `/api/chaotang/decree/dispatch` → 路由flow | 老板下旨类决策(上书房/各部) | ✅上书房在用 |
| B·直跑flow | `/api/run`(config=`config/flow_xxx.yaml`,task_input字符串) | 部门专项(PACK/财务/法务真算) | ⚠️工部经adapter |
| C·朝堂专用端点 | `/api/chaotang/dept/{code}/overview`·`/archive`·`/manor/*` | 总览/史馆/庄园读 | ✅部分接 |

## 3. flow ↔ 部门 对接表（施工清单）
| 部门 | jiqun flow / 端点 | 模式 | 改哪 | 现状 |
|---|---|---|---|---|
| 工部 | `flow_pack_rd`·`flow_battery_stage_gate`·`flow_gongbu_review`·`flow_sourcing` | B | `gongbu-pack-bridge` + adapter-factory 让状态ready | ⚠️样板,先做 |
| 户部 | `flow_finance`·`flow_quotation` | B/A | 户部决策接 flow_finance(真算成本/现金) | 🟡 |
| 兵部 | `flow_voice_sales`·`flow_quotation` | B/A | 兵部接 flow_quotation(真报价) | 🟡 |
| 刑部 | `flow_legal` | B | **新建** 刑部→flow_legal(合同/合规真审) | ❌0,优先补 |
| 礼部 | `flow_xiaohongshu` | B | 礼部→话术/内容flow | ❌ |
| 太医院 | `flow_medical` | B | 太医院→flow_medical(健康咨询·守不诊断红线) | ❌ |
| 钦天监 | `flow_evaluate` | B/C | 钦天监→评测/预测flow | ❌ |
| 史馆 | `/api/chaotang/archive`+`flow_shiguan_archive` | C | 归档/检索/复盘 | ✅likely |
| 庄园 | `/api/chaotang/manor/*` | C | overview/projects/supply-chain | ✅likely |
| 上书房 | `decree/dispatch`+`flow_court` | A | 下旨→蜂群→回填(样板) | ✅最成熟 |

## 4. 铁律约束（融合不能破）
- **铁律9**：真产线资产(PACK/报价/BOM/真算)→后端 flow，前端只编排+展示，不在前端算。本方案正是它的落地。
- **铁律6**：产线一个出口——全经 `jiqun-live-swarm-adapter`/`/jiqun/api`，禁各部门各 new fetch。
- **硬约束#1**：前端 BFF decode-only、不验签(禁 jose.jwtVerify)，由后端 JwtAuthGuard 兜底。
- **铁律13.2**：结果带 sourceLabel(LIVE_SWARM/FALLBACK)，adapter down→FALLBACK 诚实标，禁伪造LIVE。
- **铁律2**：结果写唯一主库 tasks(SSOT)，经 `jiqun-task-persistence`，禁第二套。

## 5. 工部 PACK 真接通(样板·#1)——为什么没跑通 + 怎么修
- 链路已对：`gongbu-pack-bridge.dispatchPackSizing(adapter)` → `adapter.dispatch({swarm_bundles:['pack_rd']})`。
- **没跑通根因**：`live-swarm-adapter-factory` 产出的 adapter `state ≠ 'ready'`（env/config 未开 jiqun adapter）→ pack-bridge 走 FALLBACK，UI 显缺证。
- **修法**：① factory 在 jiqun 可达时返回 ready 的 `jiqun-live-swarm-adapter`；② 该 adapter 的 dispatch 真调 `/api/run`(config=`config/flow_pack_rd.yaml`)；③ 轮询 run 结果回传 sourceLabel=LIVE_SWARM。
- **验收**：工部点"这个能不能造?"→ 返回 flow_pack_rd 真 PACK 方案(非缺证)，sourceLabel=LIVE_SWARM。

## 6. 施工顺序（分期·不一次全接）
```
P0 验主干: 工部PACK真接通(adapter ready + 真调flow_pack_rd) ← 样板,眼见为实
P1 补空白: 刑部(0→flow_legal) — 最快补全
P2 接专项: 户部flow_finance / 兵部flow_quotation 真算
P3 接其余: 钦天监/礼部/太医院 挂flow
P4 统一:   全部经decree/dispatch或adapter主干,清各自fetch(铁律6审计)
```

## 7. 跨前后端协作边界
- **前端(本仓)**：adapter-factory/各部门BFF/展示/sourceLabel/写主库——本方案的前端部分。
- **后端(jiqun_ai_fresh :8081)**：flow 真算/LLM/真产线——已有，部分flow需后端同事确认输出契约。
- **协作点**：每个flow的输入(task_input格式)/输出(final_output结构)契约，前后端对齐一张表。
