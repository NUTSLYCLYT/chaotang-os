# 规格说明：fix-restore-v1-taxonomy-fact-source-20260714

## 背景

见 summary.md。审计报告 `docs/chaotang-os-duplication-conflict-audit-2026-07-14.md` 十项优先级第 4 项。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 文件缺失，测试失败 | `test -f docs/chaotang-v1-taxonomy.json` → MISSING（20260714 审计） | 已验证 | 是（消除） |
| 已确认事实 | 生成后测试全绿 | `pytest tests/test_chaotang_department_protocol.py` → 13 passed | 已验证 | 否 |

## 范围

仅新建 `docs/chaotang-v1-taxonomy.json`，零代码改动。

## 非目标

- 不改 `departments.yaml`、测试文件或前端 `chaotang-v1-modules.ts`。
- 不裁决 yaml 与前端配置之间的既有差异（如 libu_rites 的 status/href 两套语义），测试只对齐 yaml↔json。

## 验收标准

`test_v1_taxonomy_matches_project_fact_source` 通过，且整个 test_chaotang_department_protocol.py 无失败。

## 验证计划

`cd backend && python3 -m pytest -q tests/test_chaotang_department_protocol.py`
