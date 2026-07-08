# 朝堂系统 · Deferred Backlog（带验收标准）

> 来源：`docs/CHAOTANG_FLOW_AUDIT.md` 中 18 项需后端/产品/基础设施决策、前端无法独立正确完成的 deferred 项。
> 本轮（commit `76ed401`）已落地的 30 项不在此列。每项给出验收标准（AC，尽量可 E2E/单测验证）、依赖、优先级、工作量。
>
> 图例：优先级 **P0**(阻断/高危) · **P1**(重要) · **P2**(改进)；工作量 **S**(≤1d) **M**(2–4d) **L**(>1w)；
> Owner：🔐后端 · ⚙️基础设施 · 📋产品 · 🖥️前端。

## 依赖与建议顺序

```
BL-01 JWT 验签(根) ─┬─▶ BL-02 proxy 验签门
                    ├─▶ BL-03 显式 role/dept claim ─▶ BL-04 actor 省份/租户隔离(BL-07)
                    └─▶ (验签到位后)其余鉴权项的"可信 payload"前提才成立
BL-12 状态机接入 ─▶ BL-11 SSE 推送总线
BL-16/17 集中式存储(Redis/PG) ─▶ BL-13/14 限流 · BL-15 预算原子计数
```
**先做 BL-01**（所有授权项的可信前提），再 BL-03（解锁省份/租户隔离），基础设施类（BL-15/16/17）可并行立项。

---

## 已发现：真实后端 JWT 契约（2026-06-02 · 读 `jiqun_ai/src/tenant.py`）

> 之前 BL-01/03/04 标"需后端协调、契约未知"。实际已能从后端源码确定，**部分前提已不再是黑盒**：

- **签名**：后端手搓 **HS256**，`hmac.new(JWT_SECRET, header.body, sha256)`（`_jwt_encode`）。→ BL-01 若启用前端验签，可用 `node:crypto` HMAC + 共享 `JWT_SECRET`（无需 jose/JWKS）。**但用户已定：验签后端兜底，前端不动**。
- **payload claims**：`{ user_id, username, tenant_slug, role: 'user'|'admin', exp: <ISO 字符串> }`。
  - 身份 = **`user_id`**（非 `sub`）；租户 = **`tenant_slug`**（字符串，非数字 `tenantId`）；角色 = **`role`**（二值，无 `accountType` 层级）；`exp` = **ISO 字符串**（非 unix 秒）。
  - dev 回退 `makeLocalJwt` 才是 `{ sub, tenantId, accountType, exp:unix }`。
- **前端历史 bug（本轮已修）**：前端各处只认 dev 形状 → 对真实后端 token：`getUserIdFromSession`/`chat` 读 `sub` 恒空(**401 所有真实用户**)、`resolveTenantId` 读 `tenantId` 恒空(**BL-07 租户隔离失效**)、`exp*1000`(ISO 串)=NaN(**过期判断永不触发**)。
  - 已建 `src/lib/auth/session-claims.ts` 单一规范化入口（容忍两种形状），并把 auth-server / get-user-id / chat / actor-context / server-access / governance 路由全部接入。
- **对 backlog 的影响**：
  - **BL-03（role/dept claim）**：`role` 已存在（user/admin）→ ruler/三省的"管理员门槛"可用 `role==='admin'` 判定（actor-context 已切）。仍缺 **per-department(dept) claim** 才能精确区分"哪一省" → 这部分仍 deferred。
  - **BL-04**：accountType 死锁已绕过（改读 role）。
  - **BL-07**：租户键应为 `tenant_slug`（已改为 string|number 兼容）。

### 安全复核遗留（auth 对齐后的独立对抗复核 · 已处理 1/3/4/5，2/6 留档）
- ✅ **F1**（已修）：server 端 `isAdmin` 的 `accountType>=1` 旁路在生产可被伪造 cookie 提权 → 生产只认 `role==='admin'`，accountType 仅非生产兜底。
- ✅ **F3**（已修）：tenant `string|number` 用 `===` 比较的 type-confusion（dev↔prod 形状）→ 改 `String()` 归一化（fail-closed，无泄漏，但修掉误 404）。
- ✅ **F4**（已修）：client `decodeJwtExp` 的 `atob` 未做 base64url 归一化 → 已加 `-→+ _→/`。
- ✅ **F5**（已修）：`/admin`、`/admin/jiqun-depts` SSR 守门用 `accountType<1` → 真实后端 admin(只有 role)被锁死 → 改 `readSession().isAdmin`。
- 🟡 **F2**（留档·可接受）：`isExpired` 对缺失/不可解析 `exp` fail-open（不过期）。符合"decode-only、后端兜底"模型；彻底闭合需引入"最大会话时长"兜底或后端撤销表，属基础设施决策。
- 🟡 **F6**（follow-up）：仍有 5 处 JWT 解码实现（session-claims 规范入口 + auth-server/actor-context/server-access/proxy 各自内联）。actor-context/server-access 正被他窗重构，暂不动；后续统一改调 `decodeJwtClaims`。

---

## EPIC A · 鉴权根基（Auth Foundation）

### BL-01 · BFF JWT 真正验签 〔P0 · 🔐后端 · M〕
**源**：AUTHZ-LANE-01-VERIFY, AUTHZ-LANE-02
**现状**：全链路只 base64url 解码不验签；`local-login` 在后端不可达时签发 `alg:none`（已限非生产）。`proxy.ts` 仅查 cookie 存在。
**目标**：在 BFF 边界对 `courtos.access_token` 做签名 + exp 校验，授权决策只基于已验签 payload。
**依赖**：后端发布 JWKS 端点（RS256）**或**共享 HS256 密钥；确认 BFF 是否负责验签（vs 完全交后端）。
**验收标准**：
- [ ] `alg:none` token 一律 401（E2E：构造 `{alg:none}` token 打受保护 API → 401）。
- [ ] 篡改 payload（如改 `accountType:0→2`）的 token 因签名不匹配被拒（E2E：合法 token 改 payload 段重打 → 401）。
- [ ] 合法后端签发 token 通过；过期 token（exp 过去）401。
- [ ] 密钥/JWKS 从 env/远端加载，仓内无硬编码密钥（grep 验证）。
- [ ] `decodeAccessTokenServer`/`readAccessPayload` 仅保留用于"显示"，授权路径改用新的 `verifyAccessPayload`。

### BL-02 · proxy 中间件验签门 〔P1 · 🔐后端+🖥️前端 · S〕
**源**：AUTHZ-LANE-02
**现状**：`proxy.ts` 仅 `if(!token)` 拦截，任意非空字符串穿门；过期 token 也放行。
**目标**：中间件用 BL-01 的验签能力（Edge 兼容的 `jose.jwtVerify`）做签名+exp 校验，失败 401/redirect 并清 cookie。
**依赖**：BL-01（密钥/JWKS）。Edge runtime 兼容性确认。
**验收标准**：
- [ ] 非法/过期 token 在中间件层即被拦（E2E：`access_token=garbage` 打任意受保护页 → redirect `/login`；打 `/api/*` → 401）。
- [ ] 合法 token 正常放行，无性能回归（中间件 P95 < 5ms 验签开销）。
- [ ] 失败时清除 `courtos.access_token` cookie（响应含 `Set-Cookie` 过期）。

### BL-03 · JWT 显式 role/department claim 〔P0 · 🔐后端 · M〕
**源**：AUTHZ-LANE-04, AUTHZ-LANE-03-CLAIM
**现状**：授权用 `accountType` 数值阈值（`ruler` 需 ≥2），但 `local-login` 只发 `role==='admin'?1:0`，**没有任何账号能拿到 2** → 无人能终审（功能死锁），且 `accountType` 不含省份/部门信息。
**目标**：后端在 access token 内签发显式 `role`（ruler|zhongshu|menxia|shangshu|liubu…）+ `department`/`province` + `scope` claim；前端授权改用 role claim 替代 accountType 阈值。
**依赖**：后端 JWT 结构变更 + BL-01 验签。
**验收标准**：
- [ ] 存在一种登录路径能产出可担任 `ruler` 的 token（CI 断言：登录 admin → 拿到含 `role:'ruler'`/适当 scope 的 token）。
- [ ] `resolveActor`/`deriveSessionMaxRole` 改读 `role`/`department` claim；无对应 claim → 降级 `liubu`/`viewer`。
- [ ] E2E：低权账号自设 `courtos.actor=menxia` 但 token 无 menxia 授权 → transition `approve` 仍 403 降级。
- [ ] 移除/弃用 `RULER_MIN_ACCOUNT_TYPE` 阈值耦合（保留 env 兜底但默认走 claim）。

### BL-04 · 省份/部门授权隔离（三省六部真实分权）〔P1 · 🖥️前端 · M〕
**源**：AUTHZ-LANE-03, GOV-FSM-01
**现状**：本轮已落"accountType 楼层 + claimed 封顶"过渡版；完整版需 BL-03 的 role+dept claim。
**目标**：`resolveActor` 从会话 claim 推导"可担任 actor 集合"，`claimed` 必须 ∈ 集合否则降级。中书/门下/尚书/六部互不可冒充。
**依赖**：BL-03。
**验收标准**：
- [ ] E2E（扩展 `actor-province-spoof.spec.ts`）：`zhongshu` 会话尝试以 `menxia` 身份 `approve` → 403。
- [ ] 同一账号无法连续扮演中书→门下→尚书走完整议案流（各步按 claim 校验）。
- [ ] `system` 永不可由客户端声称（保持现状回归断言）。

### BL-05 · DB 化一次性邀请码 〔P2 · 🔐后端+📋产品 · M〕
**源**：AUTHZ-LANE-05-DB
**现状**：本轮已去宽松正则、保留显式 allowlist + TODO；硬编码码随构建泄漏。
**目标**：邀请码入库（single-use、expiry、绑定邮箱、审计），`verify-invite` 改 DB 查询。
**依赖**：产品定义签发/兑换流程 + 新 schema（`invite_codes` 表含 `used_at`/`expires_at`/`bound_email`）。
**验收标准**：
- [ ] 已用码二次校验失败（E2E：兑换一次→再用同码 → invalid）。
- [ ] 过期码失败；随机 6–32 位串失败（回归 `invite-strictness.spec.ts`）。
- [ ] 仓内无硬编码邀请码常量（grep `VALID_CODES`/`COURT-` 应仅在迁移/seed）。

### BL-06 · 收窄 /api/court/* 公开面 〔P1 · 🔐后端+🖥️前端 · S〕
**源**：AUTHZ-LANE-06
**现状**：`PUBLIC_PREFIXES` 把整段 `/api/court/*` 放行，依赖"后端 FENGQUN_AUTH 自鉴权"的隐含假设。
**目标**：只对确属纯代理且后端强制鉴权的具体前缀放行，其余纳入 cookie 验签门；为 court route handler 加统一鉴权封装。
**依赖**：后端确认每个 court 子路由的鉴权归属（清单）。
**验收标准**：
- [ ] 提供"哪些 court 子路由公开 / 哪些需会话"的明确清单（文档 + proxy 常量）。
- [ ] E2E：一个标记为受保护的 court 路由匿名访问 → 401。
- [ ] SSE 代理（`court/events/stream`）契约不被破坏（回归现有 SSE E2E）。

### BL-07 · governance/hanlin 本地 store 租户隔离 〔P1 · 🖥️前端+🔐后端 · M〕
> **状态**：🟡 governance bill store 部分**已落地并验证**（`resolveTenantId` + `billTenant` + getBill/listBills/transition/audit/dashboard/deliberate/scribe-extract 全部按租户 scope；含对抗性安全复核发现并修复的 3 处旁路 — audit 详情/audit 概览/scribe 抽取；E2E `governance-tenant-isolation.spec.ts` 3 用例绿）。**剩余**：hanlin `_store.ts`（awards/contributions 等）仍无租户维度，待后续按同模式补。
**源**：AUTHZ-LANE-07
**现状**：`bill-store`/`hanlin/_store` 无 tenant 维度；JWT 有 `tenantId` 但授权链从不消费。
**目标**：授权从已验签 JWT 取 `tenantId`，store 读写按 tenantId 强制 scope（key 前缀或 `WHERE tenant_id=`）。
**依赖**：BL-01（可信 tenantId）+ store API 加 tenant 参数。
**验收标准**：
- [ ] 跨租户读：租户 A 会话列不出租户 B 的议案/翰林贡献（E2E：两租户 token 各自 `listBills` 互不可见）。
- [ ] 跨租户写：A 不能 transition B 的议案（403/404）。
- [ ] 现有单租户行为不回归（默认 tenant 路径仍通过）。

---

## EPIC B · 治理完整性（Governance Integrity）

### BL-08 · 跨进程写串行化（乐观锁基础设施）〔P1 · ⚙️基础设施+🔐后端 · M〕
**源**：GOV-LOCK-01
**现状**：本轮已在 API 层强制 `expectedEventCount`（缺失 400）+ 进程内 `withBillLock`；但多副本共享卷下两进程同时通过乐观锁仍存极窄竞态。
**目标**：跨进程写串行——`flock(2)` 文件锁 / 外部 advisory lock / 单写实例。
**依赖**：运维确定部署形态（单写实例 vs 多副本共享卷）。
**验收标准**：
- [ ] 并发压测：N 进程对同一 `under_review` 议案并发 `approve`+`reject_final`，最终事件链无分叉（仅一个终态事件落盘）。
- [ ] `OptimisticLockError`（409）在版本号陈旧时正确触发（集成测试）。
- [ ] 部署形态与锁策略写入运维文档。

### BL-09 · degraded 议案只读隔离策略 〔P2 · 📋产品+🖥️前端 · S〕
**源**：GOV-FSM-02
**现状**：本轮已透出 `Bill.degraded`/`corruptedCount`（getBill 标记）；但"哪些 BillState 算关键、degraded 是否禁后续 transition、人工解封流程"属产品决策。
**目标**：定义并实现 degraded 议案处置策略。
**依赖**：产品定义策略。
**验收标准**：
- [ ] 产品文档明确：degraded 案是否只读 / 禁 transition / 需人工复核解封。
- [ ] 实现后 E2E：含 corrupted 帧的议案按策略被拒绝后续 transition（若选只读）或告警。
- [ ] 审计页对 degraded 案显式标注（不再静默继续推进）。

### BL-10 · per-user 祖训持久化 store 〔P1 · 🔐后端+📋产品 · M〕
**源**：TCE-AUTH-01-STORE
**现状**：本轮以薄封装 `loadConstitutionsForUser(userId)` 占位（未就绪返回 []，行为等价现状）；`deliberate` 服务端已取 userId。但祖训仍主要由客户端 `body.constitutions` 传入 → 用户可传空祖训架空门下省。
**目标**：祖训入库（DB 表 + CRUD 端点 + tenantId 隔离），服务端按 userId 加载，客户端传入仅叠加不可覆盖。
**依赖**：后端持久化层 + 产品确认祖训生命周期/编辑 UI；BL-03 的 userId 派生链。
**验收标准**：
- [ ] E2E：用户提交空 `body.constitutions` 时，服务端仍加载其持久化祖训并据此判决（不再恒"准"）。
- [ ] 祖训 CRUD 端点带 tenant 隔离（A 改不动 B 的祖训）。
- [ ] 客户端传入的祖训只能"叠加"不能"清空"服务端硬约束（断言）。

### BL-11 · 尚书执行失败补偿执行器（saga）〔P2 · 🔐后端 · L〕
**源**：TCE-EXEC-01-COMPENSATE-EXEC
**现状**：本轮已附加 `ExecutionStep.compensatingAction` 字段 + `blastRadius` 由内容推导；但"失败时真正逆序执行补偿"需执行/编排运行时（与蜂群编排耦合）。
**目标**：尚书 dispatch 后六部真实执行 + 失败按 DAG 逆序触发补偿（saga）。
**依赖**：后端编排层 + BL-12（状态机接入）。
**验收标准**：
- [ ] 集成测试：多步执行链中第 K 步失败 → 前 K-1 步的 `compensatingAction` 被逆序触发。
- [ ] 执行态可观测（每步 pending/done/compensated）。
- [ ] 部分失败后六部不停留在不一致中间态。

---

## EPIC C · 蜂群编排（Swarm Orchestration）

### BL-12 · 真实下旨流程接入 9 态状态机 〔P1 · 🔐后端+🖥️前端 · L〕
**源**：SWARM-FSM-01
**现状**：本轮取"保留裸 SQL runtime + 文档化"最小破坏方向；`state-machine.ts` 仍是零业务 import 的"防护假象"。
**目标**：`agents/run`/`triggerLlm` 改走 `createAgentRun→transitionAgentRun→broadcast`，`events` 改 `subscribeAgentRun`；或确定走轮询则删死代码消除契约假象。
**依赖**：后端 `/agents/invoke` 回调能驱动中间态（assigned/summarizing…）。
**验收标准**：
- [ ] 非法状态序列被 `canTransition` 拒（单测：archived→running 抛 `IllegalTransitionError`）。
- [ ] 状态变更触发 `broadcastAgentRun`，`events` 经 `subscribeAgentRun` 推送（不再 2s 轮询）。
- [ ] 若选删除：`state-machine.ts` 死代码移除，schema/路由层显式约束 status 取值。

### BL-13 · 蜂群运行集中式速率/并发限制 〔P1 · ⚙️基础设施 · M〕
**源**：SWARM-RUN-02
**现状**：本轮已落入口鉴权 + 进程内 Map 限流 + DB COUNT 并发兜底（best-effort，多实例非原子）。
**目标**：跨实例原子速率/并发限制（Redis/Upstash 令牌桶 或 网关 `limit_req`）。
**依赖**：BL-16（集中式存储）/ 网关配置。
**验收标准**：
- [ ] 多实例压测：全局速率上限被严格遵守（不再 ×副本数放大）。
- [ ] 超限返回 429 且不触发上游 LLM 调用（成本不外泄）。
- [ ] 进程重启不清零计数（外部存储持久）。

### BL-14 · events SSE 推送总线（消除轮询放大）〔P2 · ⚙️基础设施+🖥️前端 · M〕
**源**：SWARM-SSE-05
**现状**：本轮仅做排序确定化 + 注释；仍每连接 2s 全表轮询，N 客户端 ×0.5 QPS。
**目标**：进程内单例 fan-out（`subscribeAgentRun` 推送）；多实例用 Redis pub/sub。
**依赖**：BL-12（写路径调 `broadcastAgentRun`）+ 多实例需 BL-16。
**验收标准**：
- [ ] N 个并发 SSE 连接下 DB 查询量与连接数解耦（不再线性放大）。
- [ ] 状态变更 P95 推送延迟 < 1s（无需等 2s 轮询周期）。
- [ ] 慢查询不再因 `setInterval` 重入造成查询风暴。

---

## EPIC D · LLM 预算 / 限流基础设施

### BL-15 · 跨实例预算原子计数 〔P1 · ⚙️基础设施 · M〕
**源**：LLM-BUDGET-02, LLM-BUDGET-03
**现状**：本轮已修单实例 reload+累加一致性 + check-then-act 收敛；但 ledger 是进程内 Map，多副本各算各的，并发仍可击穿硬限。
**目标**：集中式 ledger（Postgres/Redis）做原子 read-modify + 预扣（reserve→结算）模型。
**依赖**：BL-16（集中式存储）。
**验收标准**：
- [ ] 多实例并发：月度硬限不被 ×N 超过（压测：同用户跨实例并发，总花费 ≤ 限额 + 单请求容差）。
- [ ] 预扣模型：`checkBudget` 原子预占 estCost，调用结束按真实 cost 结算差额。
- [ ] 进程重启/扩容不丢账、不双重计费。

### BL-16 · /api/chat 集中式限流 〔P1 · ⚙️基础设施 · S〕
**源**：LLM-RL-07
**现状**：`_rl` 进程内 Map，多实例 ×副本放大、重启清零。
**目标**：集中式限流（Redis 令牌桶 / 网关 `limit_req`）。
**依赖**：与 BL-13/BL-15 共用集中式存储基础设施决策。
**验收标准**：
- [ ] 多实例下 per-user chat 速率上限被严格遵守。
- [ ] 重启/扩容窗口计数不清零。
- [ ] 限流后返回 429，叠加预算（BL-15）后 chat 既受限流又受预算约束。

### BL-17 · /api/chat 软限降级行为 〔P2 · 📋产品 · S〕
**源**：LLM-CHAT-01-forceCheap
**现状**：本轮已落 chat 硬限 over_monthly=402 拦截 + `recordSpend`/`recordCall` 遥测；但 over_daily 软限"强制走更便宜模型"会改变用户可感回复质量，属产品决策（chat 当前硬编码 Sonnet/OpenAI 直连，无 router 选型层）。
**目标**：产品确认软限降级行为是否可接受 + 是否将 chat 接入 router 选型。
**依赖**：产品决策。
**验收标准**：
- [ ] 产品文档明确软限触发时的降级策略（降级模型 / 提示用户 / 拒绝）。
- [ ] 若接入 router：chat 经 `callLLM` 选型，软限 `forceCheap` 生效（集成测试）。
- [ ] 降级对用户可见/可知（不静默改变质量）。

---

## 汇总表

| ID | 标题 | 优先级 | Owner | 工作量 | 依赖 |
|----|------|--------|-------|--------|------|
| BL-01 | BFF JWT 真正验签 | P0 | 🔐 | M | — |
| BL-02 | proxy 验签门 | P1 | 🔐🖥️ | S | BL-01 |
| BL-03 | 显式 role/dept claim | P0 | 🔐 | M | BL-01 |
| BL-04 | 省份/部门授权隔离 | P1 | 🖥️ | M | BL-03 |
| BL-05 | DB 化一次性邀请码 | P2 | 🔐📋 | M | — |
| BL-06 | 收窄 court 公开面 | P1 | 🔐🖥️ | S | — |
| BL-07 | store 租户隔离 | P1 | 🖥️🔐 | M | BL-01 | 🟡 governance 已落地·hanlin 待补 |
| BL-08 | 跨进程写串行化 | P1 | ⚙️🔐 | M | — |
| BL-09 | degraded 议案隔离策略 | P2 | 📋🖥️ | S | — |
| BL-10 | per-user 祖训持久化 | P1 | 🔐📋 | M | BL-03 |
| BL-11 | 尚书补偿执行器(saga) | P2 | 🔐 | L | BL-12 |
| BL-12 | 状态机接入真实流程 | P1 | 🔐🖥️ | L | — |
| BL-13 | 蜂群集中式限流 | P1 | ⚙️ | M | BL-16infra |
| BL-14 | events SSE 推送总线 | P2 | ⚙️🖥️ | M | BL-12 |
| BL-15 | 跨实例预算原子计数 | P1 | ⚙️ | M | infra |
| BL-16 | /api/chat 集中式限流 | P1 | ⚙️ | S | infra |
| BL-17 | chat 软限降级行为 | P2 | 📋 | S | — |

**P0（先做）**：BL-01、BL-03 —— 鉴权可信根基，解锁其余授权项。
**基础设施前置**：BL-13/15/16 共用集中式存储（Redis/PG）决策，建议合并立项。
