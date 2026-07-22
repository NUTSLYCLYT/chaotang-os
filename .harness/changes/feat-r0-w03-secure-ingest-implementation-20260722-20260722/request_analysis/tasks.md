# 任务：feat-r0-w03-secure-ingest-implementation-20260722-20260722

## 任务 1：secure_ingest 核心模块（格式检测 + 结构安全 + 摘要 + 存储）

- 目标：REQ-001 对象级安全摄取，假 MIME/损坏/加密/宏/zip-bomb 一律拒收不当放行
- 前置条件：execution-authority v2 对 R0-W03 返回 GO
- 输入：OQ-02 冻结值（20MB/100页）+ `_shiguan_archive_projection` 租户隔离范式
- 输出：`schema.py`/`limits.py`/`mime_sniff.py`/`ooxml_structure.py`/`digest.py`/`storage.py`
- 涉及文件：`backend/src/secure_ingest/{schema,limits,mime_sniff,ooxml_structure,digest,storage}.py`
- 状态 / 数据变化：纯新增模块，无既有文件修改
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：删除新文件即可，无依赖方
- 完成定义：`test_secure_ingest_format_matrix.py` 全绿

## 任务 2：注入扫描 + 攻击 fixture 覆盖

- 目标：REQ-002 宏/zip bomb/注入文本一律标记，命中原文绝不落库落日志
- 前置条件：任务 1 完成
- 输入：`\N{ZERO WIDTH SPACE}` 等命名转义（避免源码里出现不可见字符导致 Edit 工具误判）
- 输出：`text_scan.py` + `tests/fixtures/secure_ingest_fixtures.py`（含宏/zip-bomb/注入合成样本）
- 涉及文件：`backend/src/secure_ingest/text_scan.py`、`backend/tests/fixtures/secure_ingest_fixtures.py`
- 状态 / 数据变化：纯新增
- 验证命令与证据：`test_secure_ingest_attack_fixtures.py`
- 回滚边界：删除新文件即可
- 完成定义：命中类别名列表可断言不含原文片段

## 任务 3：purpose authz + 下载票据 + provider policy + 路由 + 数据层

- 目标：REQ-019 tenant/user/object/purpose 任一缺失一律拒绝；provider 未声明合规字段拒绝出站
- 前置条件：任务 1、2 完成
- 输入：admin 零例外/provider 全 UNKNOWN 两项已批准设计决策
- 输出：`purpose_authz.py`/`download_ticket.py`/`provider_policy.py`/`audit.py` + 3 张新表 +
  `web/routers/secure_ingest.py` + `alembic/versions/017_secure_ingest_tables.py` +
  `config/provider_policy.yaml`
- 涉及文件：`backend/src/secure_ingest/{purpose_authz,download_ticket,provider_policy,audit}.py`、
  `backend/src/db/models.py`（追加 3 个新类）、`backend/web/routers/secure_ingest.py`、
  `backend/web/main.py`（追加 2 行挂载，用 `git add -p` 与并行任务的改动分离）、
  `backend/alembic/versions/017_secure_ingest_tables.py`、`backend/config/provider_policy.yaml`、
  `backend/requirements-core.txt`（新增 `python-docx>=1.2.0`）
- 状态 / 数据变化：新增 3 张表 + 1 条路由；既有文件仅追加，不改既有内容
- 验证命令与证据：`test_secure_ingest_authz_matrix.py`（含 TestClient 集成用例：跨租户 404、
  票据重放 409、对象替换摘要不符 409、admin 默认拒绝、provider 未声明拒绝）
- 回滚边界：`git revert` 摘除路由挂载即可下线；`alembic downgrade` 撤销新表（迁移文件已带
  `downgrade()`，未在此沙盒环境实跑，因 alembic 包本身未安装）
- 完成定义：`test_secure_ingest_authz_matrix.py` 全绿 + backend/root doctor 0 错误
