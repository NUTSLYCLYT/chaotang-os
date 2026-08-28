# Tenant Principal V1

任务 ID：`TENANT-PRINCIPAL-V1-20260828`

冻结基线：`origin/ext-dev@f00a0d925e7df48b12cdcb57a03a3b915ebe0f3c`

冻结 tree：`5b9d8dcbfb9dc319ab0c16418d340c9dfb9bec5e`

Proposed approval canonical digest：`sha256:40ef1ef640a77f808f99ab056a870f83cad408ecac072e9b3299f63aa535878b`

## Status

Draft

细分状态：`DRAFT_NON_AUTHORIZING / OWNER_DIGEST_CONFIRMATION_PENDING / PRODUCT_STOP`

本三文件治理草案不授予产品施工权。只有 Owner 精确确认 canonical approval digest、另行授权一次三文件治理提交，并且该提交成为未漂移的 `origin/ext-dev` 远端头后，`product-authority.m0.v1 --authorize --task TENANT-PRINCIPAL-V1-20260828` 才可能返回 `GO / APPROVED_FOR_ONE_CHILD`。

## Why This Comes First

“成果一键分享并持续获得贡献奖励”要求所有写操作同时经过服务端 tenant、owner、权限、幂等与安全校验。当前 `ext-dev` 的 `AuthenticatedUser` 只有 `id/username/email`，运行账本还明确处于 `OWNER_ONLY + tenant_id=null`。此时直接给 `RewardCandidate` 或 `ShareCandidate` 增加客户端可传的 `tenant_id` 会制造跨租户伪造边界。

因此全局路线的第一步不是分享按钮，也不是奖励表，而是建立最小的服务端租户身份上下文。该上下文只服务后续受控业务，不改变当前公开登录响应，不引入团队协作或多租户切换 UI。

## Product Definition

每个本地账户必须由服务端拥有一个且仅一个不可替换的个人租户成员身份，并以 `OWNER` 角色归属该租户。注册 API 的用户、个人租户、成员关系和首个 session 必须在同一 SQLite 事务中原子创建；已有 schema-v5 用户与 session 必须通过显式、可回滚的 v5→v6 迁移补齐个人租户、成员关系和 issuance-time membership 绑定。

活动会话解析不再只证明“这个 session 属于某个 user”，还必须证明该用户具有一个有效的个人租户 Owner membership。membership 缺失、重复、已撤销、tenant 类型或角色非法时统一失败关闭，不返回部分 principal，也不泄露具体内部原因。

对外 `register/login/me` 的公开 `user` JSON 与 session ID 形状保持不变。tenant ID、membership ID、角色和内部状态不进入现有公开认证响应，也不接受任何客户端 tenant/owner 输入。后续奖励与分享 API 只能从服务端 `CurrentUser`/principal 取得 tenant 与 owner。

## Frozen Contracts

### Domain

- 三字段 `AuthenticatedUser(id, username, email)` 保持不变；同文件新增内部不可变 `AuthenticatedPrincipal(AuthenticatedUser)`，其 `tenant_id`、`membership_id` 与 `tenant_role` 全部必填且无默认值，V1 角色只允许 `OWNER`。
- 个人租户由服务端生成 opaque ID；客户端不得选择、覆盖或猜测 tenant。
- 每个 V1 user 与 personal tenant 恰好一条不可替换 membership identity；`user_id` 与 `tenant_id` 均无条件唯一。
- valid principal 必须有且仅有一条未撤销的 PERSONAL/OWNER membership；撤销后零条 valid membership 是合法封禁状态。
- membership identity、user、tenant 与 role 不可修改；revocation 只允许 `NULL → timestamp`，V1 不允许 reactivation 或 replacement。
- 每个 session 持久绑定签发时的 `membership_id`；session 解析必须同时匹配 session/user/membership/tenant、PERSONAL、OWNER 和未撤销状态。旧 session 不得因未来 membership 变化重新获得权限。

### Storage

- 新库直接创建 schema v6。
- schema v5 运行库必须显式执行 v5→v6；`get_connection()` 对 v5 保持 fail closed。
- 迁移在写入保留锁覆盖的单一一致性边界内，为每个已有 user 创建 personal tenant 与 active OWNER membership，并把每个既有 session 绑定到该 membership；任一 pre-commit 检查失败则 schema、数据与版本整体回滚。
- 迁移是明确的 offline-only 运维动作：服务必须停止；maintenance 还要取得 SQLite 写入保留锁，使用 SQLite backup API 生成不可覆盖的一致 v5 snapshot，拒绝裸复制主文件与遗漏 WAL。
- v5 preflight 与 backup 必须验证 registry 中冻结的 predecessor schema digest、`integrity_check=ok`、空 `foreign_key_check`、精确对象集合和旧表内容摘要；迁移 commit 前验证 v6 digest、FK/完整性、旧表内容守恒、tenant/member/user 等量和 session binding 完整。
- v6 包含单行持久化 migration verification 状态。新库直接为 `VERIFIED`；v5→v6 在同一迁移事务中写入 `PENDING_VERIFICATION`，commit 后只有 maintenance 的显式完整 readback 成功才能单向变为 `VERIFIED`。`get_connection()`、readiness 与统一 backup 在 PENDING/缺失/非法状态下跨进程持续失败关闭。
- commit 后异常不自动反向改写数据库：状态保持 `PENDING_VERIFICATION`，启动与备份持续阻断并保留已验证 backup；恢复必须走单独获批的 restore rehearsal。T0 的“整体回滚”只指 commit 前事务回滚。
- v1→v2→v3→v4→v5 的既有历史迁移语义不变；测试链最后显式增加 v5→v6。
- `runtime_data_registry.py` 同步成为 v6 readiness、backup、restore 与 release evidence 的唯一当前 schema 事实源；任何 v5 运行库继续被 readiness 拒绝。

### HTTP

- `RegisterRequest`、`LoginRequest` 继续 `extra=forbid`，tenant/owner/membership 等字段一律 422。
- `PublicUserResponse` 与 `SessionResponse` 字段逐字不变。
- `/register` 使用单事务 registration primitive；若 session 插入失败，user/tenant/membership/session 全部不落库。
- 登录在密码验证后只为 active personal OWNER principal 创建绑定 membership 的 session；principal 无效时与未知用户/错误密码返回逐字相同 401，且不插入 session。
- `require_current_user` 只接受可解析为签发时 active personal OWNER principal 的 bearer session。
- membership 缺失、撤销或异常与无效 session 共用稳定 401，不暴露 tenant 存在性。

## Exact14 Scope

1. `backend/app/api/auth.py`
2. `backend/app/auth/models.py`
3. `backend/app/auth/storage.py`
4. `backend/app/operations/runtime_data_registry.py`
5. `backend/app/operations/sqlite_backup.py`
6. `backend/app/shiguan/db.py`
7. `backend/app/shiguan/maintenance.py`
8. `backend/tests/test_auth_api.py`
9. `backend/tests/test_auth_storage.py`
10. `backend/tests/test_daily_memorial_scheduler.py`
11. `backend/tests/test_readiness.py`
12. `backend/tests/test_shiguan_adopted_evidence.py`
13. `backend/tests/test_shiguan_migrations.py`
14. `backend/tests/test_sqlite_backup.py`

需要第十五条产品路径、修改前端/BFF、迁移既有业务表 tenant 列、引入团队/邀请/切换、修改 Harness/Authority/ADR/CI 或新增依赖时立即 STOP，重新申请独立任务。

## Affected Modules

- 模块：内部认证 principal、Auth/史馆共享 SQLite schema、runtime schema registry、运行库维护 CLI、readiness/backup 与 Auth/史馆迁移测试
- 允许路径：`backend/app/api/auth.py`, `backend/app/auth/models.py`, `backend/app/auth/storage.py`, `backend/app/operations/runtime_data_registry.py`, `backend/app/operations/sqlite_backup.py`, `backend/app/shiguan/db.py`, `backend/app/shiguan/maintenance.py`, `backend/tests/test_auth_api.py`, `backend/tests/test_auth_storage.py`, `backend/tests/test_daily_memorial_scheduler.py`, `backend/tests/test_readiness.py`, `backend/tests/test_shiguan_adopted_evidence.py`, `backend/tests/test_shiguan_migrations.py`, `backend/tests/test_sqlite_backup.py`

- 内部认证 principal：只扩充服务端解析所得的 tenant/membership identity，不改变公开用户响应。
- Auth/史馆共享 SQLite：新库 schema v6 与显式 v5→v6 migration。
- Runtime registry/readiness/backup：同步接受唯一精确 v6 schema；生产 `probe_synthetic_retention()` 创建并验证 user/tenant/membership/bound-session sentinel，backup/restore/rehearsal 的 retention digest 必须覆盖四者。
- 运行库维护 CLI：增加 offline-only、写锁覆盖、一致 snapshot、可验证的 v5→v6 操作。
- Auth、scheduler、readiness、backup 与史馆迁移测试：覆盖原子性、失败关闭、数据守恒和历史迁移链。

除 exact14 外没有受影响模块；奖励、分享、前端、BFF、现有业务表 tenant 回填均明确不在本任务。

## Technical Plan

1. 在 auth/storage 与 API 测试中先建立 RED：原子创建 personal tenant、membership 失效关闭、客户端字段走私拒绝、公开响应不变。
2. 在史馆迁移测试中建立 RED：新库 v6、v5 显式迁移、全事务回滚、backup、数据守恒和 v1→v6 链。
3. 保持 `AuthenticatedUser` 不变，新增 required-only `AuthenticatedPrincipal`；注册事务内创建 user/tenant/membership/session，所有 session 固定绑定 membership；公开 DTO 不变。
4. 增加 closed v6 schema、严格 validator、offline-only 一致 snapshot、`migrate_v5_to_v6` 与 maintenance 入口；不自动迁移真实运行库。
5. 更新唯一 runtime schema registry 与生产 retention probe，并通过 readiness、scheduler 与 backup/restore synthetic retention 验证 v6；retention evidence 必须绑定 user/tenant/membership/session 四类 sentinel。
6. 运行 approval manifest 冻结的 focused/full/ruff/identity/Harness/convergence 矩阵，并做独立 Python、安全和迁移复审。

逐步实现、失败处理和负向矩阵以配套 Plan 为准；任何路径或契约扩张均重新申请授权。

## Delivery Constraints

- 治理三文件与产品 candidate 必须是两个独立单亲提交；治理提交只能包含三条 `approvalCommitPaths`。
- Owner 确认 canonical approval digest、另行授权治理 commit/push、远端精确到位并由机器返回 GO 前，不得创建产品 RED 或改 exact14。
- 产品 candidate 只能修改 exact14，且十四条均为既有 `100644` 文件；不允许新增、删除、改 mode 或第十五路径。
- 所有数据库验证使用临时 SQLite；禁止读取、迁移、备份或修改真实运行库。
- 不安装依赖，不访问公网、模型、secret、生产数据，不改变发布与部署。
- candidate 验证、独立复审和 Owner 接受必须绑定同一 SHA/tree；旧证据不得跨候选复用。

## Acceptance Criteria

- [ ] 新用户注册在一个事务中创建 user、personal tenant、active OWNER membership 和首个 membership-bound session；任何一步失败均无孤儿记录，API 不产生不可恢复的 409 陷阱。
- [ ] 同一用户名/邮箱并发注册继续保持现有唯一性语义，且不会产生孤儿 tenant/membership。
- [ ] `AuthenticatedUser` 三字段构造和既有调用保持兼容；只有 required-only `AuthenticatedPrincipal` 可进入 `CurrentUser` 授权边界。
- [ ] 登录、session 恢复与 `/auth/me` 只在 session 签发时绑定的 active personal OWNER membership 唯一成立时成功。
- [ ] membership 缺失、重复、撤销、替换、错误 role、错误 tenant kind、错误 session binding 均统一失败关闭，公开错误不泄露内部原因且不插入新 session。
- [ ] 注册/登录请求夹带 `tenant_id`、`owner_id`、`membership_id` 或角色字段均被严格拒绝。
- [ ] 公开 `register/login/me` 的 user JSON 和 session ID 形状不变。
- [ ] 新库直接为 schema v6；现有 schema v5 在未显式迁移前拒绝运行。
- [ ] v5→v6 迁移为每个现有 user 精确创建一个 personal tenant 和一个 active OWNER membership，把每个现有 session 绑定到其唯一 membership，并保留全部原用户、session、档案和决策数据。
- [ ] offline maintenance 在同一写锁保护窗口内使用 SQLite backup API 创建并验证一致 v5 snapshot；并发写、WAL、损坏 backup、重复 backup 或不健康源库失败关闭。
- [ ] commit 前任一故障整体回滚到精确 v5；commit 后 readback 异常持久保留 `PENDING_VERIFICATION`，新进程启动/readiness/backup 继续阻断并保留 verified backup；只有显式完整验证成功才能单向清除阻断。
- [ ] runtime registry、readiness、scheduler 与统一 SQLite backup/verify/restore/rehearsal 精确接受 v6；生产 retention probe 与 evidence digest 保留并核验 synthetic user/tenant/membership/session 四者。
- [ ] 既有 v1→v5 迁移链、史馆 adopted evidence 与 auth 全量行为无回归。
- [ ] exact14 focused/full pytest、ruff、Authority 回归、Harness 与 convergence 全部通过。
- [ ] 独立安全与代码复审无未关闭 P0–P2。

## Explicit Non-goals

- 不实现 RewardCandidate、RewardDecision、功勋/算筹账本、奖励卡、申诉或冲正。
- 不实现 ShareCandidate、脱敏、翰林院审核、公开发布或 Qualified Use。
- 不把现有史馆、任务、成果、锦衣卫或执行账本批量迁移为 tenant scoped。
- 不实现团队租户、邀请、成员管理、tenant 切换或前端组织 UI。
- 不改变公开认证响应、cookie/BFF、session ID 格式、密码或外部身份提供商。
- 不安装依赖，不访问真实网络、模型、secret、生产数据或运行库。

## Global Follow-on Sequence

```text
T0 Tenant Principal（本任务）
→ R0 Reward Truth Kernel
→ R1 结果奖励卡 + 申诉/冲正
→ S1 只读分享入口投影
→ S2 私有共享草稿
→ S3 脱敏/版权/安全/沙箱
→ S4 预览与用户确认
→ S5 翰林院审核/申诉
→ S6 发布与正式收录奖励
→ S7 Qualified Use 与受限持续奖励
```

每阶段建立独立 approval、candidate、测试和复审；前一阶段的测试绿或聊天确认不自动授权下一阶段。

## Stop Conditions

- `origin/ext-dev` 从冻结 base 漂移或 approval commit 不能成为它的精确单亲子。
- product authority 不返回 exact Task ID 的 `GO / APPROVED_FOR_ONE_CHILD`。
- 实现需要 exact14 之外路径或改变公开认证 JSON。
- 需要客户端提供 tenant/owner，或以 owner 冒充 tenant。
- 迁移不能在临时 SQLite 上证明全事务回滚、备份与数据守恒。
- 任何测试需要公网、真实模型、secret、生产库或用户现有运行数据。

## Rollback

产品候选只允许按完整 candidate commit 回滚，并需单独授权。运行库迁移采用预迁移 backup 恢复；禁止用 `git reset --hard`、直接降 `PRAGMA user_version`、删除 tenant 表或手工改运行库冒充回滚。

## Implementation Report

只读盘点与三路独立架构/安全会审已完成。治理草案已重锚到包含 P10-A claim-evidence pure kernel 的最新 `ext-dev`；该上游变更不触碰 T0 exact14、认证、租户或 SQLite 迁移边界。产品 RED、GREEN、candidate、commit、push、运行库迁移、发布和部署均未开始。

## Acceptance Review

Owner digest review：Pending。Machine Authority：STOP。Product acceptance：Pending。
