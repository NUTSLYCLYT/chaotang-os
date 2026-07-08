# 租户隔离迁移 · 打孔清单（2026-06-29）

> 把 `guard:tenant` 的 15 个洞变成可机械执行的清单。配套 `dev/handoffs/多租户Token与租户隔离方案.md`。
> **前置铁律**：先 C1（后端 jiqun 真验签，让 cookie 的 `tid` 可信）再 C3（数据层按 tid 过滤）。
> **铁律1**：前端禁把 decode-only `tid` 当安全判断——所以这清单的过滤**只在 C1 落地、tid 可信后才真安全**；
> 在 C1 前先把数据层改成"接受 tid 参数 + 默认过滤 + fail-closed"，C1 一通，同一份代码即真生效。

## 关键发现：15 端点 = 只有 3 个数据层读函数
**改 3 个函数（数据层 SSOT），不改 15 个路由**——这正是方案 §4"把租户过滤从'程序员记得加 WHERE'变成'数据层默认带上'"。

### ① `listPrimaryTasks` / `getPrimaryTaskFull`（表 `tasks`）→ 解 6 端点
- `/api/court/backend/tasks`、`/api/court/backend/tasks/[id]`、`/api/court/bingbu/overview`、`/api/court/hubu/overview`、`/api/qintian/scenarios/generate`、`/api/v1/tasks/board`
- **改**：两函数加 `tenantId` 参数 → SQL 默认 `WHERE tenant_id = ?`；无 tid → 返回空（fail-closed）。`getPrimaryTaskFull` 额外校 `row.tenant_id === tid` 否则 404。
- **前置**：`tasks` 表加 `tenant_id` 列 + 写入盖章（方案 §4 六表之一）。
- ⚠️ **爆炸半径大**：各部 overview/board 全靠这俩函数喂数据——改完必须回归各部页（dev 单租户应仍见自己的任务）。

### ② `getReview` / reviews 存储（表 `courtos_decisions`/reviews）→ 解 7 端点
- `/api/reviews`(POST+list)、`/api/reviews/[review_id]/{decision,departments,followup,memorial,progress,run}`
- **改**：`getReview(id, tenantId)` 校 review 属此租户否则 404；list 默认按 tid 过滤。
- **前置**：reviews/courtos_decisions 表加 `tenant_id` 列 + 写盖章。

### ③ `getArchive` / shiguan（表 `shiguan_archives`）→ 解 2 端点
- `/api/shiguan/archives`、`/api/shiguan/archives/[archive_id]`
- **改**：`getArchive(id, tenantId)` 校归属；list 按 tid 过滤。（court_archives 已修 1aacd09 是范式）
- **前置**：`shiguan_archives` 表加 `tenant_id` 列（审计判的遗留 HIGH 三表之一）。

## 每个函数配一条回归断言（方案 §10）
跨租户读返回空——租户 A 写、租户 B 读断言 0 条（照 `decision-judgment` 实测 userA 见/userB 空 范式）。
- `listPrimaryTasks(tidB)` 不含 tidA 的任务
- `getReview(idA, tidB)` → 404/空
- `getArchive(idA, tidB)` → 404/空
`guard:tenant` 转绿后升 strict 进发布硬门（现 warn·15）。

## 执行顺序（不可跳）
1. **后端 jiqun**：C1 真验签，cookie 带可信 `tid`（根·非本仓）。
2. **本仓数据层**：3 表加 `tenant_id` 列 + 3 读函数加 tid 默认过滤 fail-closed + 3 条回归断言。
3. **路由**：15 端点从会话取 tid 传给数据层（多数已有 requireSessionUserId 可扩为取 tid）。
4. `guard:tenant`→0 升 strict 进门。

**本仓现状**：① registry 误报已剔（16→15）；② 此清单备好；③ 真执行**等后端 C1**——在它前做 C3 是假安全（铁律1）。
