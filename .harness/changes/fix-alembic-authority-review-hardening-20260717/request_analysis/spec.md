# 规格说明：fix-alembic-authority-review-hardening-20260717

## 背景

原 P5 在本轮独立 worktree 中经历两次 NO-GO hardening 时，远端并发落地了另一套
`346dc81 fix: make Alembic the sole runtime schema authority`，并已用于真实服务恢复。
因此旧 task 分支不能安全 rebase：它会产生双 014、双 authority 模块与同 change ID
冲突。本包以 `346dc81` 为唯一基线，只移植独立审查已证明仍缺失的 fail-closed 门。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 上游 P5 已有 strict startup、010/011 adoption、014 identity 与真实恢复 | `346dc81` diff/CI；2026-07-17 | 只读 Git / Project Agent | 否 |
| 已确认事实 | adoption 只校验列存在，不校验 PK/null/type/unique/index/未知形状 | `backend/src/schema_adoption.py` | 代码审查 + 临时 SQLite RED | 是 |
| 已确认事实 | 014 existing-table preflight 只校验列名 | `backend/alembic/versions/014_tenant_identity_tables.py` | 代码审查 + 临时 SQLite RED | 是 |
| 已确认事实 | strict/adoption inspect 对缺失 SQLite 文件会先 connect，可能创建文件 | authority/adoption 入口 | 临时路径 RED | 是 |
| 已确认事实 | 两个仓库 systemd 模板未锁 effective strict，`.env` 可覆盖 | backend/frontend service template | 源码契约 RED | 是 |
| 未知问题 | PostgreSQL DDL 行为 | 无隔离 PostgreSQL | 登记未验证 | 否；上游已显式阻断 production PostgreSQL |

## 数据流与调用链

`service startup -> prepare_database_schema(strict) -> SQLite path preflight -> exact head`

`operator check -> missing-file preflight -> candidate 011/010 complete fingerprint -> no write`

`operator apply -> complete fingerprint -> mandatory backup -> stamp candidate -> 012/013/014/015`

`014 -> create/adopt identity tables -> 015 validation-only frozen contract guard`

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| expected Alembic head | migration graph under `backend/alembic/versions` | startup/health | exactly one head |
| adoption candidate | 010/011 frozen schema + explicit 012/013 exclusions | operator tool | mismatch before backup/stamp |
| identity schema | `014_tenant_identity_tables.py` 创建，新增 `015_schema_contract_guard.py` 冻结验证 | tenant runtime | PK/null/type/unique/default/FK exact；已到 014 的库也必须重新过门 |
| production schema mode | service `ExecStart` effective environment | web lifespan | always strict despite `.env` |

## 范围

- 缺失 SQLite 文件/URI 零创建。
- 010/011 adoption candidate 的完整表结构与 named index 指纹。
- 新增 015，对 014 创建或既有 identity 表做全形状复验。
- systemd effective strict 与 operator CLI 契约。
- 对应测试、文档证据与 packet review。

## 非目标

- 不回退或替换上游 `346dc81`。
- 不改 outbox worker/poller、真实卡单或业务终态。
- 不停止/重启真实服务，不连接或迁移真实 DB。
- 不顺便修复全仓 6 个既有测试失败。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| missing SQLite path / file URI | check/strict 拒绝且文件不存在 | pytest |
| candidate 缺列、错 PK/type/null/unique/check/FK/index 或未知结构 | backup/stamp 前拒绝，`alembic_version` 不存在 | pytest |
| 合法 010 与 011 candidate | check 选最高兼容 revision，apply 到 head | pytest |
| 已在 014 的 identity 同名畸形表 | 015 拒绝，版本保持 014，不做 DDL | pytest |
| `.env` 声明非 strict | service `ExecStart` 仍强制 strict | 源码契约 pytest |

## 风险与回滚边界

所有 DDL 仅临时 SQLite。实现只收紧 adoption 并新增验证型 015；若误拒合法旧库，回滚本 remediation
commit 即恢复上游行为，不回滚已经迁移的真实库。真实服务和 DB 不在本包状态变化范围。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-17
- 批准范围：继续 P5、按顺序执行、收口提交上传；本包是远端并发 P5 的最小审查补强
- 明确未批准：真实 DB 写入、服务重启、无 GO 推送/合入、范围外业务修复

## 验收标准

- 上述缺口均有可解释 RED 与 GREEN。
- 合法 010/011 adoption 到唯一 015 head；失败在 stamp 前且零文件/版本副作用。
- 015 identity 形状 exact；生产 service effective strict。
- 定向/相邻测试、Ruff/compile、doctor、diff check 通过。
- 新 H 由独立 reviewer 签发 SHA-bound GO，之后才形成 no-ff candidate/push。

## 验证计划

先运行新增 RED；逐项 GREEN；运行全部 authority/adoption/migration 相关 pytest 与上游 P5
18 文件代表集；检查忽略产物、Ruff、compile、backend/root doctor；最后独立 review。
