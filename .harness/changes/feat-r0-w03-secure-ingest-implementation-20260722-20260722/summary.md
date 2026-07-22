# 变更摘要：feat-r0-w03-secure-ingest-implementation-20260722-20260722

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w03-secure-ingest-implementation-20260722-20260722 |
| 类型 | feat |
| 状态 | VERIFIED_COMPLETE |
| Owner | lyt（批准） / Claude Code 会话（实现） |
| 创建日期 | 20260722 |

## 范围

- 主线：`docs/r0-trusted-kernel-amendment-20260720`，execution-authority v2 已 GO 授权 R0-W03
- 文件：11 个新 `secure_ingest` 模块 + 1 个新路由 + 1 个 provider policy yaml + 1 个新迁移 +
  3 张新表 + 5 个测试文件(35 项)+ 1 个 fixture 构造器；`backend/web/main.py`/
  `backend/src/db/models.py`/`backend/requirements-core.txt` 仅追加，不改既有内容
- 验证：35 passed + 1 skipped(alembic 环境缺口，非本次引入)，backend/root doctor 0 errors，
  W02 回归 49/49，既有租户隔离回归 10/10 均未受影响
