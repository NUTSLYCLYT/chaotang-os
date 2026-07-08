# 朝堂 OS 后端缺口审计

日期：2026-06-01

## 结论

当前仓库不是纯前端。它已经有 Next.js BFF、jiqun 后端代理、SSE 代理、认证路由、史馆/军机/治理/蜂群等 API 面。

但“2026 级一人公司操作系统”的核心闭环还缺正式后端底座：统一数据库、任务队列、审计事件表、跨设备会话、权限边界、可观测性。现在我们刚补的建设台账属于可用的轻量持久化，不是最终生产级数据层。

## 已具备

- Next BFF：`src/app/api/**`
- jiqun 代理：`/api/court/chaotang/*`、`/api/jiqun/*`
- 军机处任务流：通过 jiqun BFF 和 SSE 代理接入
- 建设台账：`/api/court/build-ledger`
- 台账治理：按 `taskId` 查询、导出、清理
- 上书房/户部/史馆客户端闭环：已读写同一建设台账
- 后端健康检查：`/api/court/operating-loop/health`

## 关键缺口

| 缺口 | 当前状态 | 风险 | 应补方案 |
| --- | --- | --- | --- |
| 生产数据库 | 缺 `DATABASE_URL`，建设台账写 `.chaotang/build-ledger.json` | 多人协作、部署重启、横向扩容不可靠 | Postgres/Supabase/Neon，先建 operating loop schema |
| 任务队列 | 缺 Redis/QStash/队列配置 | agent 运行、重试、定时日报不可控 | BullMQ/Redis 或 QStash |
| 统一任务模型 | 军机任务在 jiqun，建设预算/复盘在本仓静态/台账 | taskId 难以贯穿预算、执行、复盘 | `build_tasks` + `task_links` 表 |
| 审计事件 | 只有局部 store 和台账 | 无法追责“谁在何时下旨/修改/归档” | `audit_events` append-only |
| 权限模型 | BFF 层已有保护，但本地台账接口未细分权限 | 多用户后容易越权 | session user + tenant/role checks |
| 后台作业 | 上书房每日建议仍主要客户端合成 | 不能自动生成“每日经营简报” | scheduled job 写 `operating_signals` |
| 可观测性 | 有 health，但缺统一 traces/metrics/errors | 线上问题定位慢 | Sentry + structured logs + `/health` probes |

## 推荐后端落地顺序

1. 数据库边界  
   建表：`build_ledger`、`build_budgets`、`build_retrospectives`、`operating_signals`、`audit_events`。

2. 台账迁移  
   保留 `/api/court/build-ledger` 契约，把文件 store 换成数据库 store。前端不改。

3. 军机任务绑定  
   立项成功后写 `build_ledger.task_id`，并存 `source/suggestion/evidence/ministers`。

4. 史馆复盘持久化  
   评分结果写 `build_retrospectives`，而不是只在客户端计算。

5. 上书房每日任务  
   定时任务从 `build_retrospectives` 和 `operating_signals` 生成次日建议。

6. 权限与审计  
   所有写接口记录 `audit_events`，并绑定用户、组织、来源 IP、请求 ID。

## 当前判断

短期继续开发 MVP：够用。  
要做真实一人公司工作台：缺后端数据库和队列。  
要到 2026 顶级产品标准：必须把经营闭环从“BFF + 文件台账 + 客户端合成”升级为“数据库 + 队列 + 审计 + 可观测性”。
