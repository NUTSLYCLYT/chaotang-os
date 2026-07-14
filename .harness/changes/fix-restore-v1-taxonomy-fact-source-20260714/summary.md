# 变更摘要：fix-restore-v1-taxonomy-fact-source-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-restore-v1-taxonomy-fact-source-20260714 |
| 类型 | fix |
| 状态 | DELIVERED |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：根项目（docs 事实源）+ 后端（测试锚点）
- 文件：`docs/chaotang-v1-taxonomy.json`（重建，程序化生成）
- 验证：`cd backend && python3 -m pytest -q tests/test_chaotang_department_protocol.py` → 13 passed（此前该文件缺失导致 `test_v1_taxonomy_matches_project_fact_source` 长期失败）

## 背景

`docs/chaotang-v1-taxonomy.json` 是 v1 产品分类的外部事实锚点，被
`test_v1_taxonomy_matches_project_fact_source` 用来对照 `departments.yaml` 的 `v1_taxonomy`
块，防止分类漂移。该文件在 2026-07-09 的文档清理提交中被误删（`1d5679a` 是最后触碰记录），
之后这条测试作为"已知无关失败"被绕过了一整天——2026-07-14 审计（CT-CONV-004）判定必须恢复。

本次用 Python 从 `departments.yaml` 的 `v1_taxonomy` 程序化生成（非手写），文件内含
`generated_from` 溯源字段。测试通过即证明 yaml↔json 一致。
