# P5.1 复审 v2：CHECK/default 规范化修复（Claude reviewer）

| 项 | 值 |
| --- | --- |
| 修复 commit | `8ae79eb fix(p5): preserve SQL literal case in adoption checks` |
| P5.1 HEAD | `8ae79eb`（task/p5-1-alembic-review-hardening） |
| 前序 | v1 NO_GO（p5-1-check-normalization-blocker.md，覆盖对抗 GO） |
| 时间 | 2026-07-17 08:2x（命令戳） |

## 缺陷闭合（实证复核）

| 项 | v1 缺陷 | v2 实测 | 判定 |
| --- | --- | --- | --- |
| _normalize_check_sql 字面量 | IN('OPEN')==IN('open') | **不等价** True | CLOSED |
| _normalize_check_sql 语法层 | — | STATUS in == status IN（关键字仍归一，未矫枉过正） | ✅ |
| _normalize_default 字面量 | 'OPEN'=='open' | **不等价** True | CLOSED |

## 修法核对

新增 `_normalize_sql_syntax`：逐字符解析，引号外折叠大小写/空白，
**引号内字面量原样保留**——正是立案要求的"只归一语法层"。
`_normalize_default` 剥引号后直接 return，不再 lower。

## 负例回归

- `test_check_sql_normalization_preserves_string_literal_case`
- `test_default_normalization_preserves_string_literal_case`
两条大小写负例就位；adoption+authority 套件 8 passed/1 skip（审查者重跑）。

## 裁决

PACKET_REVIEW_GO（v2，取代 v1 NO_GO）

后续：P6 rebase 到修复后 P5.1（丢弃 bbb1000 带病 merge）；P5/P5.1/P6
顺链一次性干净收敛合 ext。事故（p5-1-nogo-bypass-incident.md）遏制成立：
带病版从未进 ext/未 push。
