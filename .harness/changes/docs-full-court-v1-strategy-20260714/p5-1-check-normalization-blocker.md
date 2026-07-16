# P5.1 阻塞立案：CHECK 规范化字面量误判（Claude reviewer，覆盖对抗通道 GO）

| 项 | 值 |
| --- | --- |
| 目标 | `task/p5-1-alembic-review-hardening` @ 64a2369 |
| 缺陷 | `backend/src/schema_adoption.py:174` `_normalize_check_sql` |
| 严重度 | HIGH（收养器是数据安全工具，误判等价=漏收养=约束差异被静默吞） |
| 与对抗通道关系 | 对抗 review-v1 出 GO 且审到"check constraint"层，但**未红队规范化函数本身**——遗漏本缺陷；stop-review 第三方抓到；本立案以实证覆盖该 GO |

## 实证复现（审查者实跑，2026-07-17 03:4x）

```python
from src.schema_adoption import _normalize_check_sql
a = _normalize_check_sql("status IN ('OPEN','CLOSED')")   # -> status in ('open','closed')
b = _normalize_check_sql("status IN ('open','closed')")   # -> status in ('open','closed')
assert a == b   # 成立——两个语义不同的 CHECK 被误判等价
```

## 机理

`_normalize_check_sql` 对**整条表达式** `.lower()`，把单/双引号内的**字符串
字面量**一起小写。对大小写敏感列，`IN ('OPEN')` 与 `IN ('open')` 是不同约束，
却被判等价。收养器据此认为"约束一致"，放行一个约束语义已漂移的旧库。

## 修复要求

- 规范化只作用于 SQL 语法层（关键字/空白折叠），**保护引号内字面量原样**；
  或最保守——CHECK 做去外层括号+首尾空白后的**精确大小写比较**，不 lower。
- 负例回归：同列同结构、字面量仅大小写不同的两个 CHECK 必须判**不等价**。
- 同类自查：`_normalize_default`（:129）**同病已实证**——
  `_normalize_default("'OPEN'") == _normalize_default("'open'")` 为 True
  （2026-07-17 07:3x 审查者实跑）。默认值 `'OPEN'` 与 `'open'` 对大小写敏感
  列是不同默认，被误判等价。两函数同一病根：规范化时折叠了字面量大小写。
  两处一并修，各附大小写负例回归。

## 裁决

PACKET_REVIEW_NO_GO（覆盖 64a2369 的对抗 GO；该 GO 因 H4 后代码未变本应
仍有效，但其审查遗漏了实证可复现的 HIGH 缺陷，故失效）。

## 流程记录

双通道**首次分歧**：对抗 GO vs 本通道 NO_GO。分歧仲裁原则：**实证复现优先**
——有可跑复现的缺陷判定压过无复现的放行。此原则建议写入 bootstrap 流程。
