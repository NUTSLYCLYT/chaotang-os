# 规格说明：fix-migration-015-literal-normalization-20260717

## 背景

P5.1 ext repair 的独立 review 在已发布的 validation-only migration 015 中发现另一份
`_normalize_default`：它对去引号后的值 `.lower()`，会把真实期望 `users.role='user'`
与漂移库 `DEFAULT 'USER'` 判为等价。该缺陷已存在于前序 ext `86c83a4`，不是前一
repair 引入，但会使“字符串字面量大小写不折叠”在仓库口径上仍未闭合。015 已经发布，
因此不能直接修改后宣称修复；必须新增 016 让已 stamp 015 的数据库重新过门。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 015 把 `'USER'` 与 `'user'` 归一为同值并升级成功 | 新增 e2e RED | 临时 SQLite / Project Agent | 是 |
| 已确认事实 | 直接修改已发布 015 不会保护已经 stamp 015 的库 | Alembic revision 只运行一次；设计复核 | migration graph | 是 |
| 已确认事实 | P5.1 repair reviewer 将其登记为 MEDIUM 非阻断既有项 | 前一 repair `packet_review/review-v1.md` F-A | Claude Code | 否 |
| 未知问题 | PostgreSQL inspector 默认值文本形态 | 无隔离 PostgreSQL | 登记未验证 | 否；本包认证 SQLite |

## 数据流与调用链

`already stamped 015 DB -> new 016 _validate -> inspector default -> literal-aware normalization -> exact expected comparison -> reject mismatch and remain at 015`

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| identity 默认值 | migration 014 DDL / 015 `_SPECS` | migration 015 validator | 引号字面量原样；SQL 语法层仍可折叠 |
| migration head | Alembic graph | authority/adoption | 016 validation-only，不产生 DDL；015 保持历史字节 |

## 范围

- 新增 016，复制 015 的冻结 identity contract，但采用已审的引号感知 default
  normalization，并添加从已 stamp 015 起步的 `users.role` 大小写漂移 e2e 负例。
- 保持 runtime `schema_adoption.py` 与 016 的引号感知语义一致；015 不修改。

## 非目标

- 不修既有 `datetime('NOW')`、括号剥离或 current_timestamp 字面量碰撞。
- 不改变 014/015 已发布文件、既有 DDL 或真实数据。
- 不修改 P6、主工作树或服务配置。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 合法 `DEFAULT 'user'` | 015 与 016 均通过，head=016 | fresh/existing identity 测试 |
| 已 stamp 015 且漂移 `DEFAULT 'USER'` | 016 报 `users.role` 并保持 version=015 | 新 e2e 负例 |
| `CURRENT_TIMESTAMP` 等 SQL 语法大小写 | 仍判等价 | 既有 fresh/existing 测试 |
| 重复引号/字面量内部空白 | 保持原样 | 对抗性 helper 验证 / review |

## 风险与回滚边界

风险是新增 head 会让 strict authority 在部署后要求数据库升级到 016；这是预期的
fail-closed 发布行为。016 只验证、不执行 DDL；合法库升级仅移动 version marker，漂移库
停在 015。回滚必须先在当前代码下授权 downgrade 016→015（仅 marker）再 revert 代码，
但本包不对真实库执行该流程。

## 计划确认记录

- 批准人：用户既有“回修 P5.1、同类自查”授权 + repair reviewer 正式发现
- 批准日期：2026-07-17
- 批准范围：闭合同类字面量大小写 fail-open，保持 P6 冻结。
- 明确未批准：真实数据库/服务操作、force-push、范围外债务。

## 验收标准

1. 新 e2e 在旧 015 RED、修复后 GREEN，并确认版本保持 014。
2. 014/015/016 全链与 007–016 代表集通过。
3. 新规范化器只收紧字面量，不引入新 fail-open。
4. 静态检查、双 doctor 与独立 review GO。

## 验证计划

- pytest 新 e2e、migration 014/015/016 链与相关代表集。
- Ruff、隔离 compileall、backend/root doctor。
- Claude 对精确 ext B 与实现 H 只读审查。
