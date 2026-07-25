# 史馆运行库未迁移导致测试假绿

## Summary

2026-07-24 检查 `harness-only` 的史馆时发现，代码已经要求 SQLite schema v3，但本机
`backend/data/shiguan.sqlite3` 仍停留在 v2。后端 Ruff、pytest 和 harness 全部通过，
真实史馆读取却稳定抛出“史馆旧库需要显式迁移后才能使用”，导致史馆查询、旧案召回和新回奏
证据快照归档不可用。

问题暴露后，Codex 先报告了测试绿色结果，却没有在 schema 变更交付时检查被 Git 忽略的真实
运行库，也没有立即按照项目规则写入失败记忆。这使一次可复发的运行态迁移遗漏没有及时固化。

## Root Cause

- `e2ff27c1` 为锦衣卫采纳证据增加了 `archive_evidence_references`，把史馆 schema 从 v2
  升级为 v3；代码同时采用 fail-closed 策略，已有数据库不是 v3 时拒绝读写。
- `backend/data/` 被 Git 忽略，切换分支、拉取代码和提交不会迁移本机 SQLite。代码版本和
  运行库版本因此可以独立漂移。
- `migrate_v2_to_v3()` 已实现并有临时数据库测试，但没有接入启动前检查、运维命令或本地服务
  启动流程；交付过程也没有执行“备份真实运行库、迁移、重启、读回验证”。
- pytest 使用临时路径创建全新的 v3 数据库，只证明新建库和迁移函数在隔离样本上工作，不能
  证明现存、被 Git 忽略的本地运行库已迁移。
- Codex 把“测试通过”错误地当成运行状态完成证据，没有把 schema 变更与真实运行库检查列为
  同一个验收门禁，也漏用了 `record-failure`。

## Prevention

- 任何持久化 schema 版本变更必须在同一交付中登记运行库升级步骤：停止写入、生成可恢复备份、
  执行明确版本的迁移、验证 schema 和数据完整性、重启服务并执行真实读回。
- schema 迁移必须继续 fail-closed，不能为消除报错而在普通请求或启动期间静默改写业务数据。
- 为史馆提供显式、幂等且输出脱敏结果的迁移/预检入口；入口必须报告数据库路径、当前版本、
  目标版本和迁移是否执行，但不得输出档案正文或证据内容。
- 产品任务和 Implementation Report 只有同时包含“临时库测试证据”和“真实运行库迁移证据”
  才能宣称本地交付完成。若运行库不存在，应明确记录为不适用，不能用新建临时库替代。
- 出现用户可见、可复发或假绿问题时，修复或继续交付前必须执行 `record-failure`；不得等待用户
  再次提醒。

## Detection

- 本地服务启动前必须以 SQLite 只读模式检查 `backend/data/shiguan.sqlite3` 的
  `PRAGMA user_version`、`PRAGMA integrity_check` 和必需表；当前代码目标版本为 v3，且必须存在
  `archive_evidence_references`。
- 迁移后必须运行真实存储读回，例如调用 `app.shiguan.storage.list_archives()`，并确认不再抛出
  `ShiguanStorageError`；随后验证史馆 HTTP 查询和一次不触发真实模型的归档测试。
- CI 无法直接发现开发者机器上被 Git 忽略的 SQLite，因此 CI 绿色不能作为该项证据。自动化尚未
  提供独立预检命令前，交付记录必须附上上述只读检查的脱敏输出；缺失即判定未完成。
- `node scripts/check_harness.mjs` 继续检查失败记忆章节完整性，但它只保证记录存在，不能替代
  真实运行库版本检查。

## Evidence

- 版本门禁与迁移函数：`backend/app/shiguan/db.py`
- 迁移测试：`backend/tests/test_shiguan_migrations.py`
- 锦衣卫证据快照测试：`backend/tests/test_shiguan_adopted_evidence.py`
- 运行库忽略规则：`.gitignore`
- schema v3 引入提交：`e2ff27c1 feat: add archive-first MCP evidence routing`
- 现场只读检查：运行库 `user_version=2`、`integrity_check=ok`、4 条 `REPLY`、
  缺少 `archive_evidence_references`；真实存储读取抛出
  `ShiguanStorageError: 史馆旧库需要显式迁移后才能使用`。
