# CI 摘要：fix-chaotang-department-audit-followups-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -c "import json; json.load(open('.harness/contracts/task.schema.json'))"` | 0 | `valid JSON` | task.schema.json 语法 | 本次会话，20260714 |
| `python3 -c "import ast; ast.parse(...)"`（models.py / prompts_court.py / chaotang_department_autosubmit.py） | 0 | `all valid Python` | 3 个 Python 文件语法 | 本次会话，20260714 |
| `cd backend && python3 -m pytest -q tests/test_chaotang_department_protocol.py tests/test_chaotang_department_autosubmit.py` | 1 | `16 passed, 1 failed` | 部门协议 + autosubmit 行为 | 本次会话，20260714 |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)`（含本 change 记录 `[ok] root change: fix-chaotang-department-audit-followups-20260714`） | 根级 harness 完整性 | 本次会话，20260714 |

## 结果

- 唯一失败项 `test_v1_taxonomy_matches_project_fact_source` 是预存在失败（`docs/chaotang-v1-taxonomy.json`
  文件缺失），与本变更无关——已用 `git stash` 验证过改动前该测试同样失败，不是本次改动引入的回归。
- `FLOW_DEPARTMENT_MAP` 派生自 `DEPARTMENT_ALIASES` 后，逐 key 对比确认 10 个旧 key 的值与改动前完全一致
  （`mismatches: NONE`）。

## 未验证项

- `agent_design/buildAgent/三省六部体系/` 是否仍被 `prompt_validator.py`/`prompt_composer.py` 实际处理——
  已在 spec.md 标注为"未知问题"，不阻塞本变更，留待后续调查。

## Diff 与回滚复核

- changed files：`task.schema.json`、`multi-agent-control-plane.md`、`chaotang_department_autosubmit.py`、
  `db/models.py`、`prompts_court.py`、`department-registry.ts`（6 个文件）
- diff review：全部改动都是文档/注释补充或字典派生重构，无新增业务逻辑分支，逐文件人工审阅确认。
- 回滚是否演练：未单独演练（风险评估为纯文档 + 零行为差异的重构，`git revert` 足够）。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 两张部门别名表消除维护漂移 | `FLOW_DEPARTMENT_MAP` 派生自 `DEPARTMENT_ALIASES`，测试验证零行为差异 | 完成 |
| control-plane 边界文档化 | `multi-agent-control-plane.md` 新增范围声明 | 完成 |
| 两套 task schema 互相加旁注 | `task.schema.json` + `models.py` 均已补充 | 完成 |
| 撤回两处错误 ORPHANED 标记 | `prompts_court.py` + `department-registry.ts` 已改为准确描述 | 完成 |

## 声明状态

- `VERIFIED_COMPLETE`
