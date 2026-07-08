# 朝堂 · 多租户 Token + 租户隔离 方案（2026-06-28）

> 部署模型：**多租户·公网共享**。本方案给"用户 token 怎么解决 + 租户隔离怎么做 + 后续要考虑什么"。
> 铁律边界：**前端/边缘 decode-only 不验签（铁律1）；token 签发+验签权威在后端 jiqun（铁律9）。**

## 0. 一句话方案
**后端签发带 `tenantId` 的真签名 JWT（修 C1）→ cookie 携带、前端只 decode → 后端验签后把 `tenantId` 注入"请求级租户上下文"→ 数据层每个查询默认 `WHERE tenant_id=?`（修 C3）。token 是租户隔离的载体，C1 是根、C3 是墙，先 C1 再 C3。**

## 1. 架构（中转站角色）—— 不用新建，收敛权威
```
浏览器 ──cookie──> nginx(3050) ──> Next BFF(中转·decode-only) ──> jiqun auth(签发+验签·权威)
                                         │                              │
                                         └─ 本地 Turso 读(按 tenant 过滤) ─┘
```
- **Next BFF 就是中转站**，不新建。它只 decode token 取 claims 用于路由/展示，**不验签**。
- **签发 + 验证收敛到后端 jiqun 一个权威**。多服务（BFF / 蜂群 / LLM 网关）都信同一 token：jiqun 验一次，往下传可信身份。

## 2. Token 生命周期
| 环节 | 方案 |
|---|---|
| **签发** | 后端 jiqun 签 JWT。alg 固定白名单（HS256 对称 或 RS256 非对称），claims：`{ sub:userId, tid:tenantId, roles:[...], iat, exp, iss, aud }` |
| **携带** | **access_token**（短期 15min）+ **refresh_token**（长期 7-30d）。都用 `httpOnly + Secure + SameSite=Lax` cookie；refresh 单独路径（`/api/auth/refresh`），不随每请求带 |
| **刷新** | access 过期 → 用 refresh 换新 access；**refresh 轮换（rotation）**：每次刷新发新 refresh、旧的作废，防重放 |
| **验证** | jiqun 权威验：**签名 + exp + iss/aud**；Next 仅 decode 取 `tid/roles` 用于 UI/路由，**绝不信任为安全判断** |
| **注销** | JWT 无状态难即时撤销 → **短 exp + refresh 撤销列表**；登出即作废 refresh |

## 3. C1 修复（token 可信 —— 根）
- ❌ **禁 `alg:none`**；服务端固定 alg 白名单，拒绝 header 里来的 alg。
- ✅ 验**签名 + exp + iss + aud**；密钥走环境变量/密钥管理器。
- ✅ 前端**禁 `jose.jwtVerify`/JWKS**（铁律1），只 `decode` 取展示用 claims。
- ✅ 密钥支持 **`kid` + 多密钥并存**，轮换时旧 token 仍可验、不让全员掉线。

## 4. C3 修复（租户隔离 —— 墙）
- token claims 带 `tid`；后端验签后注入**请求级租户上下文** `ctx.tenantId`。
- **数据层默认过滤**：每个 query 自动 `WHERE tenant_id = ctx.tenantId`——把租户过滤从"程序员记得加 WHERE"变成"数据层默认带上"，**漏写一个端点就泄露 → 改成漏不了**。
- **fail-closed**：无 `tid` → 拒绝/返回空，绝不全表（照 court_archives 范式）。
- **6 表迁移**（脊柱无租户字段，见 `朝堂成果评价与风险台账.md` §二）：`tasks`/`shiguan_archives`/`courtos_decisions`/`hubu_projects`/`agent_decisions`/`boss_preferences` 逐表「加列 + 写盖章 + 读过滤 + 回归」。
- `guard:tenant` 全绿进**发布硬门**。

## 5. 前后端分工（铁律9/铁律1）
| 谁 | 做什么 |
|---|---|
| **后端 jiqun** | 签发/验签/refresh/撤销；按 `tid` 过滤 jiqun 侧数据；token 安全的权威 |
| **前端 BFF（本仓）** | cookie 携带规范 + decode-only 注入 + **本地 Turso 读按 `tid` 过滤** + CSRF 同源 |
| **数据层** | 请求级租户上下文，默认 `WHERE tenant_id=?`，fail-closed |

---

## 6. 后续还要考虑的问题（上线后会咬你的，提前想）
1. **共享 vs 私有资源**：模板/旧案/知识库——哪些跨租户公共、哪些租户私有？**必须显式标**，否则要么泄露、要么各租户重复造。
2. **租户内多用户 + 角色（RBAC）**：一个 tenant 内 老板/员工 权限分级——谁能下旨、谁只读、谁管成员。token 的 `roles` claim 承载。
3. **Token 撤销与登出**：JWT 无状态——离职员工/泄露 token 怎么即时踢掉？短 exp + refresh 撤销列表 + 必要时黑名单。
4. **密钥轮换**：签名密钥泄露/到期，`kid` 多密钥并存，轮换不掉线。
5. **租户配额与限流**：按 tenant 限流（防一个租户烧爆 LLM/蜂群）+ 用量统计（为计费铺路）。
6. **数据导出/删除（GDPR/PIPL）**：租户有权导出或删除自己**全部**数据（被遗忘权）——租户隔离做对了，这个才做得到（按 tid 圈数据）。
7. **租户级审计**：每个决策/写入可追溯到 `tenant + user + 时间`；史馆/台账按租户隔离。
8. **新租户冷启动**：注册后是空的——引导 + 示例数据，但**示例必须标【演示】，绝不冒充真 LIVE**（铁律13.2）。
9. **跨服务信任**：jiqun / LLM 网关 / 法务 agent 都要信同一 token——统一验签点（网关验一次注入下游），别各搞一套。
10. **隔离的可测性**：每个读端点必须有"**跨租户读返回空**"的回归断言；`guard:tenant` 进 CI——否则迁移漏一个端点就是一个泄露口，且没人发现。

## 7. 实施顺序（塔勒布：先堵会要命的）
```
① C1：token 签发带 tid + 后端验签（根）          ← 没这步,下面全是假隔离
② 数据层请求级租户上下文 + 默认过滤（框架）
③ 6 表逐个迁移（加列+盖章+过滤+回归，每表会审）   ← 进度条:6×4=24 勾,guard:tenant 6洞→0
④ guard:tenant + guard:auth 进发布硬门（闸）       ← 全绿才许公网
⑤ 后续问题(RBAC/撤销/配额/导出)按上线节奏排期
```
**①②③④ 全绿 = 多租户公网安全门第一次打开。在那之前，禁公网开放。**
