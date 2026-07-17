# 独立 Packet 审查报告 — P5.1 字面量规范化 ext 修复

## 1. 身份与对象绑定

| 项 | 值 |
| --- | --- |
| Packet ID | P5.1 |
| change_id | `fix-p5-1-literal-normalization-repair-20260717` |
| B (PREDECESSOR_INTEGRATION_SHA) | `bbb100004845331b314e5196e645125f25199a5f` |
| H (REVIEWED_HEAD_SHA) | `5851f13ce47839eae295556e5b0ecddb6eaa9aad` |
| 分支 | `task/p5-1-literal-normalization-repair` |
| 工作树 | `/home/ubuntu/Projects/.fullcourt-worktrees/p5-1-literal-normalization-repair` |
| 审查模式 | 只读；无编辑、无提交、无 git 写、无网络写、未连接真实数据库/服务 |
| 复用旧 GO | 否。本裁决独立于 `8ae79eb` 的 review-v2 |

## 2. 开始与结束核验

| 核验 | 开始 | 结束 |
| --- | --- | --- |
| HEAD == H | ✅ `5851f13…` | ✅ `5851f13…` |
| 分支正确 | ✅ | ✅ |
| 工作树 clean | ✅ 0 路径 | ⚠️ 1 未跟踪路径——由本审查者的全量测试产生，见 F-C |
| B 是 H 祖先 | ✅ | ✅ `merge-base --is-ancestor` 通过 |
| 远端 ext == B | ✅ `bbb1000…99a5f` | ✅ 零漂移 |
| B..H 提交数 | 5 | 5 |

## 3. 命令与结果（全部本人实跑）

测试环境：venv `chaotang-os/backend/.venv-alembic`（SQLAlchemy 2.0.51 / Alembic 1.18.5），pytest 9.0.2 由 `sys.path.append` 从 `/home/linuxbrew/.linuxbrew/lib/python3.14/site-packages` 尾部借用。已实证 venv 的 SQLAlchemy 优先加载，未安装任何包。

| 命令 | 结果 | 与 ci_summary 声明 |
| --- | --- | --- |
| 旧实现 (B) 纯函数 RED | `old_check_equal=True`、`old_default_equal=True` | ✅ 逐字相符 |
| 新实现 (H) 纯函数 GREEN | 两项均 `False` | ✅ |
| `tests/test_unversioned_database_adoption.py` | **20 passed** | ✅ 声明 20 |
| 007/008/011/012/013/014 + authority + adoption + runtime-DDL 代表集 | **55 passed** | ✅ 声明 55 |
| 全量 `backend/tests` | **7 failed, 2727 passed, 30 skipped** (331.52s) | ✅ 逐数相符 |
| `ruff check` 变更文件 | All checks passed | ✅ |
| `node scripts/harness-doctor.mjs` | 0 errors, 0 warnings | ✅ |
| `scripts/harness_doctor.py` | 0 errors, 0 warnings | ✅ |
| `node --test packet-review-local-feedback.nodetest.mjs` | 29/29 pass | ✅ |

## 4. 移植漂移核对（对比原修复头 `8ae79eb`）

零漂移，blob 级逐字节相同：

| 文件 | `8ae79eb` blob | H blob | 结论 |
| --- | --- | --- | --- |
| `backend/src/schema_adoption.py` | `baf9e6fe…` | `baf9e6fe…` | 相同 |
| `backend/tests/test_unversioned_database_adoption.py` | `952c269f…` | `952c269f…` | 相同 |
| `p5-1-check-normalization-blocker.md` | `41809e09…` | `41809e09…` | 相同 |
| fix-alembic 四份 change docs | — | — | 四份全部相同 |

唯一文档差异是 `p5-1-nogo-bypass-incident.md`（`5851f13` 的事故更正），属本包应有内容，见 §6。B..H 未触碰任何 P6/orphan 路径；`git branch -a --contains 5851f13` 仅返回本任务分支。

## 5. 对抗性核对

`_normalize_sql_syntax` / `_normalize_check_sql` / `_normalize_default` 全部实跑通过（`backend/src/schema_adoption.py:143-179`）：

- 单/双引号：`IN ('OPEN')` vs `IN ('open')`、`"OPEN"` vs `"open"` 均判不等价。
- 重复引号（转义）：`'it''s OK'` 正确保留，引号状态正确闭合；`x IN ('a''b') AND Y` → `x in ('a''b') and y`，尾部关键字仍被折叠。
- 内部空白：`'a  b'` vs `'a b'` 判不等价。
- 语法关键字 / 外部空白：大小写、多空格、Tab/换行、首尾空白仍正确折叠为等价。
- FALLBACK 迁移事实源：`006_jinyiwei_evidence.py:38` 与 `009_decree_event_ledger.py:31` 均为 `server_default="FALLBACK"`。`_EXPECTED_SERVER_DEFAULTS` 校正为 `"FALLBACK"` 是必需且正确的。

### 新 fail-open 检查

对 36 条对抗性输入做全配对等价类比较：

| 函数 | NEW 合并但 OLD 未合并的配对（新 fail-open） | NEW 拆分 OLD 合并的配对（fail-closed 收紧） | 等价类 |
| --- | --- | --- | --- |
| `_normalize_default` | **0** | 34 | 13 → 23 |
| `_normalize_check_sql` | **0** | 15 | 21 → 31 |

新等价关系是旧关系的严格细化：每一处行为改变都是 fail-closed 方向。未发现任何新 fail-open。

被保护的 CHECK 是真实可达的：`src/db/models.py:412-414` 声明 `ck_emperor_decisions_kind = "kind IN ('edict_confirm', 'compat_dispatch', 'final_verdict')"`，`012_emperor_decision_kind.py:19` 为对应迁移侧。

## 6. 事故更正准确性

| 事故文档主张 | Git 实证 | 结论 |
| --- | --- | --- |
| 远端 ext 精确为 `bbb1000` | `git rev-parse origin/feature-chaotang-ext` = `bbb1000…99a5f` | ✅ 准确 |
| `bbb1000` 把旧实现 `64a2369` 合入 | B = `merge(346dc81, 64a2369)`；`64a2369` 是 B 的祖先 | ✅ 准确 |
| 原“未污染上传线”结论作废 | 已作废并更正（incident `:18-26`） | ✅ 准确且诚实 |
| 修复头 `8ae79eb` 不满足现远端几何 | `8ae79eb` 不是 B 的祖先；approval-v2 绑定 `predecessor=346dc81`，非 B | ✅ repair 有必要 |
| `8ae79eb` 已获 review-v2 GO | `c99687a` approval-v2 绑定 `reviewed_head_sha=8ae79eb…`，verdict 为 GO | ✅ 准确 |

不改写共享历史而以 fast-forward repair 是安全选择。B 是 H 的祖先，ff 可行；避免 force-push 是本情境下唯一不可逆风险的正确规避。

## 7. 集成几何

| 闸规则 | 状态 |
| --- | --- |
| H 由 B 派生，且恰新增一个根 change summary | ✅ `fix-p5-1-literal-normalization-repair-20260717/summary.md` |
| summary 恰含一条精确 `Packet ID: P5.1` | ✅ `summary.md:11`，全文仅此一条 |
| R 只加 review-vN.md + approval-vN.json | ✅ H 下 `packet_review/` 尚不存在 |
| change_id 合法 | ✅ 匹配 `[a-z0-9][a-z0-9-]*` |

仓库中现有两份 change record 携带 `Packet ID: P5.1`。闸只校验新增根 summary 的自身内容，不做全局唯一性约束，不构成阻断。

## 8. 发现项

### F-A｜MEDIUM｜非阻断｜`backend/alembic/versions/015_schema_contract_guard.py:63-74`

015 保留了一份未修复的 `_normalize_default` 副本，缺陷与 blocker 判定的 HIGH 同类。

实证：

```text
guard015._normalize_default("'OPEN'") == guard015._normalize_default("'open'")  -> True
guard015._normalize_default("'USER'") == "user"                                -> True
```

第二条是真实 fail-open：015 在 `:41` 声明 `users.role` 期望默认为 `"user"`，`:134` 用该副本比较，一个 `DEFAULT 'USER'` 的漂移库会被 015 静默判为兼容。

不阻断的理由：015 在 B 处已存在且 B..H 未触碰，已随 `bbb1000` 进入远端 ext。合入本包使 ext 严格变好；阻断只会让 ext 同时留着两处缺陷并继续冻结 P6。但 `ci_summary.md:47` 的 DoD 行在仓库口径上言过其实；本报告将该项正式登记，须另立包修复。

### F-B｜LOW-MEDIUM｜非阻断｜`backend/tests/test_unversioned_database_adoption.py:19-32`

两条新负例是单向锁，折叠方向零覆盖，已用变异测试实证。把 `_normalize_sql_syntax` 替换为恒等函数后重跑仍为 20 passed。没有测试锁住“关键字/引号外空白仍应折叠”这一半契约。

不阻断：B..H 之前这两个函数零测试覆盖，本包严格增加了覆盖，未移除任何覆盖；当前 schema 的 DDL 文本本就精确匹配，规范化是防御性而非承重的。

### F-C｜LOW｜非阻断｜审查测试副产物

全量测试在工作树生成 `backend/knowledge/docs/ima_archived/doc-9ee8a429607b.md`，创建时间落在本审查者全量测试区间内。开始时工作树 clean，该未跟踪项由审查测试产生，不是本包缺陷。根因是既有测试卫生问题：`src/ima_knowledge_store.py:28` 的 `_ARCHIVED_DIR` 指向真实仓库树，某些测试未 monkeypatch。

审查者依只读授权未删除；操作者须在构建 merge candidate 前移除。

### 已登记、按授权不顺手修复的既有项

| 项 | 实证 | 是否 B..H 新增 |
| --- | --- | --- |
| `datetime('NOW')` 不再归一（fail-closed） | OLD→`current_timestamp`，NEW→`datetime('NOW')` | 否；且迁移不可达该形态 |
| 括号剥离误解析 | `:133-134` 对 `(a) OR (b)` 剥出 `a) OR (b` | 否，与 B 逐字相同 |
| `'current_timestamp'` 字面量碰撞 | 引号字符串与关键字同归一 | 否，OLD/NEW 皆碰撞 |
| 测试单向锁 | 见 F-B | 否（此前为零覆盖） |

## 9. 修复要求逐项核对

| blocker 要求 | 状态 | 证据 |
| --- | --- | --- |
| 规范化只作用于 SQL 语法层，保护引号内字面量原样 | ✅ 完成 | `_normalize_sql_syntax` 引号感知词法器；§5 全项通过 |
| CHECK 字面量仅大小写不同必须判不等价 | ✅ 完成 | 新负例，B RED / H GREEN |
| `_normalize_default` 一并修并附负例 | ✅ 完成（限 `schema_adoption.py` 口径） | 新负例，B RED / H GREEN |
| “同类自查”在仓库口径的完备性 | ⚠️ 未完成 | F-A：015 同类副本未修复 |

## 10. 全量 7 项失败的基线同类性

7 项与既有 P5.1 基线逐项同类，无一属于本包回归：

| 失败 | 类别 | 与本包关系 |
| --- | --- | --- |
| `test_commit_closeout_check.py::test_check_doc_duplicates_flags_overlapping_new_topic` | commit-closeout ×1 | 无 |
| `test_lawyer_rag.py` ×4 | lawyer RAG ×4 | 无 |
| `test_persona_registry.py::test_real_roster_splits_into_two_benches` | persona roster ×1 | 无 |
| `test_tianjian_verdict.py::test_forecast_endpoint_end_to_end` | tianjian verdict ×1 | 无 |

四个失败文件均不引用 `schema_adoption` / `alembic` / `_normalize`，全部落在本包爆炸半径之外。既有 ci_summary 亦记载这 7 项已在原始 B=`346dc81` 精确复现。

## 11. 证据、状态与回滚边界

| 声明 | Git 事实 | 结论 |
| --- | --- | --- |
| 状态 `READY_FOR_CLAUDE_REVIEW`，不构成 GO | H 下无 `packet_review/`，无 approval 信封 | ✅ 一致 |
| 无 P6 文件 | B..H 12 文件全部核对，零 P6/orphan 路径 | ✅ 一致 |
| 不改写共享历史；回滚仅为 revert 新 merge | B 是 H 祖先，ff 可行 | ✅ 一致且安全 |
| 不执行真实数据迁移，数据库回滚不适用 | 代码 delta 无 DDL/数据变更 | ✅ 一致 |
| ci_summary 全部数字 | 20 / 55 / 2727-30-7 / 0-0 doctors / ruff | ✅ 全部复现 |
| DoD“字面量大小写不折叠 = 完成” | 见 F-A | ⚠️ 仓库口径言过其实，已登记 |

## 12. 裁决

GO。判据：

1. 零移植漂移——代码与测试 blob 与已独立 GO 的 `8ae79eb` 逐字节相同。
2. 形式化安全性——新等价关系是旧的严格细化，0 个新 fail-open，49 处 fail-closed 收紧。
3. 缺陷确已修复——两条声明缺陷在 B 实证 RED、在 H 实证 GREEN，且保护真实可达约束。
4. 几何合规——B 是 H 祖先、远端零漂移、恰一个新根 summary、恰一条 `Packet ID: P5.1`。
5. 无本包回归——全量数字精确复现，7 项失败全在爆炸半径外。
6. 事故更正准确——每条主张均对 Git 实证通过，且诚实作废先前错误结论。

唯一实质发现 F-A 在 B 处已存在且本包未触碰，已随 `bbb1000` 进入远端；合入本包使 ext 严格变好，阻断只会让两处缺陷都留着。F-A 与 F-B 以本报告正式登记，须另立包处理；在 015 副本修复前，“字面量大小写折叠”这一缺陷类别不得对外宣称已关闭。

合入前操作者必须移除 F-C 中由本次审查产生的未跟踪文件。

PACKET_REVIEW_GO
