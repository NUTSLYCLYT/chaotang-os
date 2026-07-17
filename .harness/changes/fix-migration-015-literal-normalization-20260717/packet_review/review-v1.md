# review-v1｜Packet P5.2 独立只读审查报告

## 1. 身份与对象

| 字段 | 值 |
| --- | --- |
| 审查员 | 独立 Claude Code reviewer（只读） |
| Packet ID | P5.2 |
| change_id | `fix-migration-015-literal-normalization-20260717` |
| B（前序 ext） | `86c83a48f98efd3e16ac19dcdec98b532bae9a85` |
| H（实现头） | `2f0a9b4e2ecaa7b7c86882091052ae356c696c1e` |
| 审查范围 | B..H 两提交 + 最终树，未复用前一 P5.1 GO |
| 执行边界 | 无编辑/提交/切分支/装依赖/真实库/网络写；临时变异均逐字节还原 |

开始与结束均确认：HEAD 精确为 H，工作树 clean，B 是 H 祖先，远端
`origin/feature-chaotang-ext` 精确为 B，B..H 恰两提交。

## 2. 015 blob 与 Alembic 图

| 位置 | 015 blob |
| --- | --- |
| B:`backend/alembic/versions/015_schema_contract_guard.py` | `ad5f06a5ea24c3f9f5d835c0dbf3e34d5caf35d8` |
| H:同路径 | `ad5f06a5ea24c3f9f5d835c0dbf3e34d5caf35d8` |
| 工作树 `git hash-object` | `ad5f06a5ea24c3f9f5d835c0dbf3e34d5caf35d8` |

`git diff B..H -- 015_schema_contract_guard.py` 为空；015 最终树与 B 逐字节一致。

Alembic 图实证：单 base、单 head、17 revisions，无分叉或孤儿。唯一 head 为
`016_schema_literal_contract_guard`，其 `down_revision="015_schema_contract_guard"`。

新增 016 而非修改 015 的设计成立：已 stamp 015 的库执行 `upgrade head` 不会重跑
015；head 推进到 016 后必然执行 016 `_validate`。这是覆盖存量库的必要条件。

## 3. 独立实跑证据

测试环境：venv `backend/.venv-alembic`，从 linuxbrew site-packages 尾部借 pytest；
venv SQLAlchemy 2.0.51 / Alembic 1.18.5 保持优先，未安装依赖。

### 已 stamp 015 的大小写漂移 e2e

```text
test_016_rechecks_an_already_stamped_string_default_that_differs_only_by_letter_case
1 passed in 3.53s
```

测试建立 013 链，手工创建结构合法但 `role DEFAULT 'USER'` 的 identity 表，stamp 015，
再 upgrade head。016 必须报 `users.role`，且 `version_num` 保持
`015_schema_contract_guard`；全部满足。

### 旧 RED / 新 GREEN

```text
015._validate(DEFAULT 'USER') -> ACCEPTED
016._validate(DEFAULT 'USER') -> REJECTED: users.role has incompatible server default
015 collapses 'USER' == 'user'? True
016 collapses 'USER' == 'user'? False
```

前一 P5.1 review 登记的 F-A 在 B 实证复现，在 H 实证关闭。

### 代表集与 marker-only 升降级

- 007–016 / authority / adoption / runtime DDL 九文件：`56 passed in 15.40s`，与
  `ci_summary.md` 精确一致。
- 合法库 015→016：version marker 到 016，`sqlite_master` 对象 75→75，逐行相同。
- 016→015 downgrade：version marker 回 015，零 DDL；可再次升级到 016。
- 漂移库：016 拒绝并停在 015。

## 4. normalization 对抗结果

对 31 条手工用例与 119 条生成语料覆盖单/双引号、大小写、内部/外部空白、重复引号、
括号、SQL 关键字、`datetime('NOW')`、CAST 和拼接：

```text
corpus=119  NEW-FAIL-OPEN=0  TIGHTENED=34
manual=31   NEW-FAIL-OPEN=0
```

| 输入 | 015 | 016 | 判定 |
| --- | --- | --- | --- |
| `'USER'` | `user` | `USER` | 收紧 |
| `"USER"` | `user` | `USER` | 收紧 |
| `' user '` | `user` | ` user ` | 收紧 |
| `' '` | 空 | 单空格 | 收紧 |
| `CURRENT_TIMESTAMP` / `(CURRENT_TIMESTAMP)` / `NOW()` | `current_timestamp` | `current_timestamp` | 合法路径不回归 |
| `DATETIME('NOW')` | `current_timestamp` | `datetime('NOW')` | fail-closed 收紧 |
| `'US''ER'` | `us''er` | `US''ER` | 对期望值均 fail-closed |

016 接受集是 015 接受集的严格子集，未发现新 fail-open。016 的
`_normalize_default` / `_normalize_sql_syntax` 与已独立 GO 的 runtime
`src/schema_adoption.py` 实现逐字节相同。

## 5. 冻结契约与测试承重

- 015 与 016 `_SPECS` 完全相同；运行期比较为 `True`。
- 014 DDL 的 `CURRENT_TIMESTAMP`、`user`、空串、1、0 与 `_SPECS` 对应。
- users tenant FK、tenants/users/invites unique 形状与 014 一致。
- 与 runtime identity specs 的 columns/pk/unique/defaults 零冲突。
- 变异 016 `_normalize_sql_syntax` 为恒等函数后 2 tests failed，证明语法折叠方向承重。
- 变异 `_normalize_default` 回退 015 lower 后新 e2e 失败，证明负例承重。
- 每次变异后均逐字节还原并复核 clean。

## 6. 发布、回滚与 strict head

- 015→016 和 016→015 均 marker-only、零 DDL。
- 错误库停在 015；合法库到唯一 head 016。
- `test_schema_authority.py` 明确锁住 head 016，adoption/013/014 断言同步更新。
- 真实部署未执行。部署后 strict authority 要求升级 016，属于预期 fail-closed 行为。

## 7. 包几何与中间态

| 检查 | 结果 |
| --- | --- |
| 新增根 summary | 恰 1：`fix-migration-015-literal-normalization-20260717/summary.md` |
| `Packet ID` | 恰 1 条，`P5.2` |
| P6 内容 | 零修改；只在边界声明中提及冻结 |
| B..H 文件 | 9 个：1 新 migration + 4 tests + 4 change evidence |
| 状态 | `READY_FOR_CLAUDE_REVIEW`；H 下无 approval/report |

中间提交 `54b0f00` 曾修改 015，但最终提交 `2f0a9b4` 已恢复 B 原始 blob。候选 tree
由 H 决定，B..H 对 015 的最终 diff 为空；中间态不影响候选树，且如实记录了送审前
设计复核否决“直接改 015”的过程。

## 8. 发现项

### F-1｜MEDIUM｜非阻断｜`backend/alembic/versions/016_schema_literal_contract_guard.py:23-60`

identity 契约事实源存在三份：冻结 015 `_SPECS`、016 `_SPECS`、runtime
`schema_adoption.py` identity specs。当前实证一致，但没有测试把三者锁在一起；未来
identity DDL 变化需要手工同步。当前算法与 runtime 逐字节一致、三份 specs 零冲突，
因此登记为后续锁测试，不阻断本包。

### F-2｜LOW｜非阻断｜`016:69-70`

重复引号未反转义，`'US''ER'` 归一为 `US''ER` 而不是 SQL 值 `US'ER`。对当前
`_SPECS` 方向为 fail-closed，与 runtime 同源，非新增安全风险。

### F-3｜LOW｜非阻断｜`016:67-68`

外层括号循环对 `(a) + (b)` 可能误剥；对当前期望值集合 fail-closed，spec 已登记非目标。

### F-4｜LOW｜信息项｜`016:71-74`

`DATETIME('NOW')` 从 015 接受变为 016 拒绝。014 只 emit 无引号的
`CURRENT_TIMESTAMP`，56 passed 证明合法链无误报；这是收紧方向。

### F-5｜LOW｜信息项

Reviewer 自身环境未找到 ruff，未独立复现该一项；但 016 和测试已由 56 tests 与变异
实际 import/执行。包方另有 `ruff check` 全绿证据。无 HIGH 或阻断项。

## 9. 验收映射与裁决

| 验收标准 | 独立证据 | 状态 |
| --- | --- | --- |
| 旧 015 RED、新 016 GREEN且版本保持 015 | 015 ACCEPT / 016 REJECT；e2e 1 passed | 完成 |
| 007–016 全链通过 | 56 passed | 完成 |
| 无新 fail-open | 119+31 对抗语料：0 new fail-open | 完成 |
| strict/marker-only/回滚 | head 锁 + sqlite_master 全等 | 完成 |

GO。015 最终字节未动；016 是覆盖已 stamp 015 数据库的正确机制；缺陷真实关闭；
对抗与变异证明 0 新 fail-open 且测试承重；发布/回滚为 marker-only；几何合规、远端
零漂移、无 P6 内容。F-1 至 F-5 均为非阻断登记项。

PACKET_REVIEW_GO
