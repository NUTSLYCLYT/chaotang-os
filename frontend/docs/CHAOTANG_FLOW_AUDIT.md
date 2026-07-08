# 朝堂系统流程梳理 + 问题清单（对抗验证 · 2026-06-02）

> 产出方式：6 条子系统泳道并行只读审查 → 三票对抗验证（怀疑/可利用/框架防护，≥2 票反驳即淘汰）→ Opus 综合。
> 共确认 **46** 个问题：CRITICAL ×4 · HIGH ×13 · MEDIUM ×20 · LOW ×9。本文件只记录分析，未改任何代码。

---

## 一、端到端流程图

核心病灶一句话：**四条核心轨道（治理 FSM / 三院议事 / 蜂群编排 / LLM 路由）各自为政、互不连通**，且整条鉴权链 **从不验签**。

```
公网/浏览器 ─▶ proxy.ts（第一道门）仅查 cookie courtos.access_token「存在」
              ❌ 不验签 · ❌ 不校验 exp · ❌ 不校验 accountType   [AUTHZ-LANE-02]
              PUBLIC_PREFIXES 把整段 /api/court/* 放行          [AUTHZ-LANE-06]
   ┌──────────────┬──────────────────┬─────────────────┬──────────────────┐
   ▼              ▼                  ▼                 ▼
治理 FSM      三院议事 deliberate   蜂群编排           LLM 路由 / chat
(事件溯源)    (瞬时 JSON,不落库)    (裸 SQL)          (/api/chat 旁路 router)
   │ jsonl+哈希链  │ ✗ 不产生 BillEvent  │ ✗ 绕过状态机      │ ✗ 不走 callLLM/预算
   ▼              ▼  [TCE-FSM-01]      ▼ [SWARM-FSM-01]   ▼ [LLM-CHAT-01]
bill-events.jsonl  与 FSM 永久不一致   agent_runs 表      无预算/无遥测
（审计验链只读内存，改磁盘检测不到 [GOV-AUDIT-01]）
```

### 鉴权链（纵深为零）
```
local-login → 优先转发后端拿真 JWT（accountType=role==='admin'?1:0，永远 ≤1）[AUTHZ-LANE-04]
            → 后端不可达则 makeLocalJwt 手搓 {alg:'none'} token            [AUTHZ-LANE-01 CRITICAL]
setSession → localStorage courtos.auth + 非 httpOnly cookie 镜像 access_token
授权判定全部基于「decode-only 不验签」的 payload.accountType：
  · governance.resolveActor：claimed==='ruler' 才校验 accountType≥2；其余省份有会话即采信 [AUTHZ-LANE-03]
  · hanlin.readHanlinRoleFromRequest：min(x-hanlin-role, accountType 派生角色)
  · admin proxy：isAdminAccount(accountType≥1) 注入 JIQUN_ADMIN_TOKEN 转发
⇒ 伪造 {accountType:2,exp:远期} 非 httpOnly cookie 即可越权为 ruler/emperor/admin
```

---

## 二、Top 5 必先修风险

1. **AUTHZ-LANE-01 (CRITICAL · 鉴权根基)** — JWT 全链路从不验签 + local-login 签发 `alg:none`。伪造 `{accountType:2}` cookie 即越权为 ruler/emperor/admin。所有授权问题的总根。
2. **GOV-AUDIT-01 (CRITICAL · 审计完整性)** — 验链只读进程内存事件副本，reload 首次后永不重读磁盘；改 `bill-events.jsonl` 后只要不重启，审计页永远 ok=true。防篡改链形同虚设。
3. **TCE-FSM-01 (CRITICAL · 状态双轨)** — 三院议事 deliberate 全程不产生 BillEvent，判决/执行计划直接 JSON 返回，与事件溯源 FSM 是两套永久不一致真相源。治理闭环从根断裂。
4. **LLM-CHAT-01 (CRITICAL · 成本失控)** — `/api/chat`（用户面最高频）完全绕开 router/checkBudget/recordSpend，硬编码 Sonnet 直连，仅进程内 Map 限流。单用户可无限刷最贵模型。
5. **SWARM-RUN-02 + 04 + FSM-01 (HIGH 组 · 蜂群失控)** — `/api/agents/run` 无鉴权可匿名批量触发 11 个 agent 的真实 LLM 调用（成本 DoS）；fire-and-forget 在 serverless 下 run 永卡 running；9 态状态机/SSE 总线是全仓零 import 的死代码。

---

## 三、完整问题清单

### 🔴 CRITICAL（4）
| id | 标题 | 文件 | 修复方向 |
|----|------|------|---------|
| AUTHZ-LANE-01 | JWT 从不验签 + local-login 签 alg:none，伪造 accountType 即越权 | local-login/route.ts · actor-context.ts · server-access.ts | BFF 边界用 jose jwtVerify(HS256/RS256)，拒 alg:none；decode-only 仅用于显示；alg:none fallback 限非生产 |
| GOV-AUDIT-01 | 审计验链只读内存，改磁盘检测不到 | bill-store.ts:187-203 | verifyBillChain 直接 readAllRotations 重读磁盘原始行再 verify |
| TCE-FSM-01 | deliberate 脱离 bill-fsm/store，审议不入事件溯源 | deliberate/route.ts:201-249 | 每步落 BillEvent 走 canTransition+审计链，DeliberationResult 从 foldEvents 派生 |
| LLM-CHAT-01 | /api/chat 绕开 router/预算/遥测 | chat/route.ts:268-436 | stream 前 checkBudget 硬限，stream 末解析 usage 后 recordSpend/recordCall |

### 🟠 HIGH（13）
| id | 标题 | 文件 | 修复方向 |
|----|------|------|---------|
| AUTHZ-LANE-02 | proxy 门仅查 cookie 存在，不验签/不校验 exp | proxy.ts:117-131 | proxy 内 jose.jwtVerify + exp 校验，失败 401 清 cookie |
| AUTHZ-LANE-03 | 非 ruler 省份「有会话即采信 claimed」可冒充 | actor-context.ts:78-89 | actor 省份归属来自已验签 JWT role/dept claim，否则降级 liubu |
| SWARM-FSM-01 | 9 态状态机/SSE 总线是死代码，真实流程绕过 | state-machine.ts:34-224 | 接入 createAgentRun→transitionAgentRun→broadcast，或删死代码消除假象 |
| SWARM-RUN-02 | /api/agents/run 无鉴权，可匿名触发 LLM+写库 | agents/run/route.ts:98-159 | 入口校验身份、写 user_id、加速率/并发限制 |
| SWARM-RUN-04 | fire-and-forget triggerLlm 进程回收后 run 永卡 running | agents/run/route.ts:44-86 | Next after()/waitUntil 保活 + stale running 回收 |
| TCE-VAL-01 | 上游 /consult 返回零 schema 校验直接深层解引用 | deliberate/route.ts:58-73 | 定义 Zod schema safeParse，失败明确 fallback |
| TCE-LOOP-01 | 门下判'再议'/'驳'无回环，是死路 | deliberate/route.ts:218-222 | '再议'写 reject_for_revision 存 suggestedEdits，提供续接端点 + 最大轮数 |
| TCE-EXEC-01 | 尚书执行无回滚/补偿，blastRadius 写死 medium | deliberate/route.ts:159-174 | blastRadius 由内容推导；ExecutionStep 加 compensatingAction + 逆序补偿 |
| GOV-LOCK-01 | 乐观锁默认关闭，跨进程并发 transition 可分叉 | transition/route.ts · bill-store.ts:148 | API 强制 expectedEventCount(缺失 400)；跨进程用 flock/外部串行 |
| GOV-PERSIST-01 | safeAppend 静默截断超长事件，重启后永久丢失 | safe-jsonl.ts:62-68 | governance 事件超长抛错拒写；大字段外置存引用 |
| LLM-BUDGET-02 | 预算账本重载+内存累加双重计费，跨实例失效 | user-budget.ts:130-159 | reload 与累加二选一；多实例改集中式存储原子计数 |
| LLM-BUDGET-03 | checkBudget↔recordSpend 的 check-then-act 竞态可击穿硬限 | router.ts:210-249 | 预扣模型（reserve estCost 后结算）或 per-user 串行化 |
| DATA-SSE-01 | SSE 代理把客户端 Authorization 当响应头回写（凭据泄漏） | court/events/stream/route.ts:28-32 | 删除响应头里的 authorization 字段 |

### 🟡 MEDIUM（20）
| id | 标题 | 文件 | 修复方向 |
|----|------|------|---------|
| AUTHZ-LANE-04 | role==='admin'?1:0 与 ruler 需≥2 脱耦，无人能终审/被迫降阈 | local-login · actor-context.ts:35-41 | JWT 加显式 role/scope claim，授权用 role 而非 accountType 阈值 |
| AUTHZ-LANE-05 | verify-invite 宽松模式把任意 6-32 位串判有效 | verify-invite/route.ts | 改数据库一次性邀请码，删宽松正则/硬编码集 |
| AUTHZ-LANE-06 | PUBLIC_PREFIXES 整段放行 /api/court/* | proxy.ts:104-111 | 收窄公开面，court route 加统一鉴权封装 |
| AUTHZ-LANE-07 | governance/hanlin 本地 store 无租户隔离 | bill-store.ts · hanlin/_store.ts | 授权取 JWT tenantId，store 读写强制 scope |
| GOV-FSM-01 | 三省/六部默认身份无真实隔离（同 LANE-03 源） | actor-context.ts:76-88 | resolveActor 从 JWT role/部门 claim 推导可担任集合 |
| GOV-PERSIST-02 | 注释称「失败回滚内存」实际无回滚，缺写后读校验 | bill-store.ts:173-179 | 落盘后读回校验可解析+hash 匹配，失败不更新内存 |
| GOV-FSM-02 | safeFold 跳坏帧继续重放，getBill 不暴露 corrupted | bill-fsm.ts:253-266 | getBill 附带 corrupted/degraded 标记，关键案进只读隔离 |
| TCE-CONST-01 | 祖训 n-gram 子串匹配高假阳/假阴 + 可内容注入 | deliberate/route.ts:91-130 | 改语义/正则锚定或 LLM judge 结构化判定；定界符隔离 untrusted |
| TCE-AUTH-01 | deliberate 无 actor 隔离，传空祖训架空门下省 | deliberate/route.ts:180-198 | 服务端 resolveActor，祖训按 userId 服务端加载；dashboard 按 userId 过滤 |
| SWARM-RUN-03 | run 插入不校验 task 存在，FK 未启用→孤儿 | agents/run/route.ts:141-147 | PRAGMA foreign_keys=ON 或 INSERT 前 SELECT 校验 |
| SWARM-SSE-05 | events 每连接 2s 轮询全表，N 客户端放大无背压 | agents/events/route.ts:104-138 | 改 subscribeAgentRun 推送，或单例共享快照 fan-out |
| SWARM-STATUS-06 | status 取最新 run 靠 started_at 字符串排序无 tiebreaker | agents/status/route.ts:49-62 | ORDER BY started_at DESC, id DESC + 索引 |
| SWARM-MOCK-07 | /api/v1/swarms/* 全静态 MOCK，[id] 未命中回退第一个 | v1/swarms/route.ts | 标注 mock 或接真实数据；[id] 未命中返 404；统一 envelope |
| SWARM-ORCH-08 | orchestration/run 无鉴权且 persist 失败被吞仍报 done | orchestration/run · court-pipeline.ts | 入口加鉴权；persist 失败标 degraded；落地与持久化同事务 |
| DATA-DRIFT-01 | tasks/agent_runs status DEFAULT 不在契约枚举内 | schema.ts:11,26 | DEFAULT 改契约合法值或文档化经 LEGACY_MAP 适配 |
| DATA-FK-01 | agent_runs.task_id FK 未启用（同 RUN-03 根） | agents/run · schema.ts | 每连接 PRAGMA foreign_keys=ON + 入口校验/upsert |
| DATA-ZOD-01 | 外部数据几乎不经 Zod 校验，schemas.ts 摆设 | schemas.ts:192-328 | BFF 出口与 WS/SSE 消费处 safeParse，失败走 error 态 |
| LLM-RETRY-04 | 文档承诺 5xx 重试但代码无重试 | router.ts:11,256-348 | 实现同 provider 1 次指数退避（区分 4xx）或更新文档 |
| LLM-COST-05 | 成本只按 input token，输出按 max_tokens 系统性低估 | cost-estimator.ts:59-70 | 估算纳入 max_tokens 上界；修正 EMA observed>5 丢弃阈值 |
| LLM-SPEND-06 | recordSpend fire-and-forget 写账失败静默吞 | router.ts:306-307 | 关键记账 await+告警/补偿，或 DB 事务 |
| LLM-RL-07 | /api/chat 限流器为进程内 Map，多实例放大 | chat/route.ts:29-40 | 集中式限流(Redis/Upstash)或网关层 limit_req |

### ⚪ LOW（9）
| id | 标题 | 文件 |
|----|------|------|
| GOV-AUDIT-03 | verifyBillChain 把未链化旧事件误报篡改 | bill-store.ts:198-202 |
| SWARM-TRANS-09 | canTransition 终态 from===to 视为合法 no-op | state-machine.ts:49-52 |
| TCE-DASH-01 | dashboard 排序 O(n²) find + 非空断言 | dashboard/route.ts:72 |
| DATA-EVT-01 | SOCKET_EVENTS 常量未被单一来源消费 | WsEventBridge.tsx:72-81 |
| DATA-EVT-02 | WsEventBridge 本地 interface 与契约重复且弱化 | WsEventBridge.tsx:7-10 |
| DATA-EVT-03 | sansheng/decree/minister 事件未在契约建模 | BattleStream.tsx:309-360 |
| DATA-API-01 | BFF envelope 与 ZApiEnvelope 不一致 | court/events/task/route.ts:32 |
| LLM-BUDGET-09 | 预算样本用 enabledModels()[0] 估成本，与实际选中无关 | router.ts:211-214 |
| （PS-* 系列见 Workstream 1，已修） | 下旨推荐特性 20 项已修复并测试 | — |

---

## 四、修复分类（决定执行策略）

- **A. 可安全自动修复（自包含、无需外部决策）**：DATA-SSE-01、SWARM-STATUS-06、SWARM-RUN-03/DATA-FK-01(PRAGMA)、DATA-DRIFT-01、LLM-RETRY-04(文档)、DATA-EVT-01/02/03、DATA-API-01、TCE-DASH-01、SWARM-TRANS-09、GOV-AUDIT-03、SWARM-MOCK-07(标注)、LLM-BUDGET-09、SWARM-FSM-01(删死代码方向)。
- **B. 需产品/后端决策**：AUTHZ-LANE-01/02/04（JWT 验签密钥/JWKS 从哪来？alg:none 是否 dev-only？）、AUTHZ-LANE-05/06（邀请码/court 鉴权策略）、LLM-CHAT-01（chat 接入 router 的行为变更）。
- **C. 架构级重构（高风险、需规划）**：TCE-FSM-01（deliberate 事件溯源化）、TCE-LOOP-01（议事回环）、GOV-AUDIT-01（验链改读磁盘）、GOV-LOCK-01/PERSIST-01（跨进程并发与持久化）、LLM-BUDGET-02/03（多实例预算）、SWARM-RUN-04（waitUntil 保活）。
