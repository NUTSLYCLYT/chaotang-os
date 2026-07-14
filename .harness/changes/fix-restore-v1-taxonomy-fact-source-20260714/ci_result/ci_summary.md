# CI 摘要：fix-restore-v1-taxonomy-fact-source-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 生成脚本（python3 + yaml → json） | 0 | `written 6 liubu entries` | 文件生成 | 本次会话 20260714 |
| `cd backend && python3 -m pytest -q tests/test_chaotang_department_protocol.py` | 0 | `13 passed` | 全部协议测试含此前失败的 taxonomy 对照 | 本次会话 20260714 |

## 结果

此前作为"已知无关失败"被反复豁免的 `test_v1_taxonomy_matches_project_fact_source` 恢复绿色，
豁免记录作废。

## 未验证项

- 前端 `chaotang-v1-modules.ts` 与 yaml 之间的语义差异不在本变更范围（见 spec 非目标）。

## Diff 与回滚复核

- changed files：`docs/chaotang-v1-taxonomy.json`（新增）+ 本变更记录
- 回滚是否演练：删除文件即完全回滚，无需演练。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 协议测试套件全绿 | 13 passed | 完成 |

## 声明状态

- `VERIFIED_COMPLETE`
