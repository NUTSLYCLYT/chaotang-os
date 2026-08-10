# 变更摘要：docs-ext-a9-jinyiwei-security-coverage-20260730

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-ext-a9-jinyiwei-security-coverage-20260730 |
| 类型 | docs |
| 状态 | P1_SCOPE_APPROVED / IMPLEMENTATION_READY_ON_COMMITTED_PACKET |
| Owner | EXT Master Governance / Codex |
| 创建日期 | 20260730 |
| 审计起源基线 | `AUDIT_ORIGIN_BASE feature-chaotang-ext@4f28d048296140431108bb429c1e2dbebc922363` |
| 实施基线 | `BASE_COMMIT` 在 exact plan Packet 提交后从干净 EXT worktree 捕获 |
| 资产来源 | `task/pkt-a1-jinyiwei-real-fetch@9651be5235c3ae5c79acd699ccb34cace62b0a11` |

## 范围

- 主线：EXT-A9-E1 锦衣卫真实数据源与共享证据池安全覆盖审计。
- P1 runtime：`backend/web/routers/jinyiwei.py`、
  `backend/src/jinyiwei_agent.py`、`backend/src/real_department_engines.py`。
- P1 frontend honesty：仅现有锦衣卫 read model 与两个既有消费组件；不新增页面。
- P1 tests：scope amendment 中列出的 focused backend/frontend tests 与 fakes。
- Packet：本目录中的 scope、plan、CI、review 和 acceptance evidence。
- 禁止：P2、数据库 schema、W09、push、部署、迁移和 listener 3050。
- 执行条件：`R0-W08` 机器门返回 GO、用户批准的 scope amendment、以及已提交并
  固定 SHA/tree 的 exact implementation plan 三者同时成立。本 change record
  本身不授予 execution authority。

## 结论

- 历史锦衣卫候选分支相对当前 EXT 没有独有提交，不需要 merge 或 cherry-pick。
- SEC EDGAR、Tavily、锦衣卫可信度门、共享证据池和租户隔离均已存在于 EXT。
- 当前实现存在两个 P1 级候选缺口，进入实现前必须先用失败测试证实：
  1. `fill-gap` 只校验 `user_id`，未使用现有 tenant + user 双重 ownership helper。
  2. 调用方自带 findings 可以声明 `tier="一手"`，并被持久化为 tenant 共享的
     `jinyiwei_verified` 证据。
- 输入上限、检索限流、错误信息和 Tavily 多源语义列为 P2 加固候选。
- 现有固定外联目标、环境变量密钥、8 秒超时、失败诚实降级、数据库唯一约束和
  tenant-scoped 查询属于已覆盖控制。

## 治理决定

该资产从 `ABSORB_AFTER_SECURITY_REVIEW` 更新为：

`SUPERSEDED_BY_EXT_HEAD / SECURITY_REMEDIATION_CANDIDATE`

2026-07-30 用户在审阅书面规格后要求继续，并明确要求按 Harness 从 P1 开始执行
长时任务、次日验收。该指令批准本 Packet 的 P1 runtime scope amendment；P2、
W09、push、部署、数据库迁移和 3050 仍未批准。精确范围见
`authority_scope/p1-runtime-scope-amendment.md`。
