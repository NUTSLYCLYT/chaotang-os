# 变更摘要：R0-W08 D4A exact-H continuation

状态：GOVERNANCE_CANDIDATE

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w08-d4a-exact-h-activation-20260812 |
| 类型 | docs |
| 状态 | GOVERNANCE_CANDIDATE |
| Owner | Codex |
| 创建日期 | 20260812 |

本候选为 D4A DOCX provenance 产品候选增加独立、fail-closed 的 exact-H continuation 验证。它保留并重验既有 G7 overlay，不修改 manifest 或激活证据。

- 旧晋升 B：`df6c82cfa3f3b449da7c5a4500c643c3f45501fd`
- 被拒绝产品 P：`10dd07acaeaeac55a452f29b6d7d4beb538a7147`（exact-H QA 发现 DOCX 格式枚举错配）
- 被拒绝产品 P2：`d40572077e8add49b8929bdd9b457785f7a6bfdd`（缺真实 upload→audit-row 集成断言）
- 当前产品 P3：`e25706c0c5d689354d2424f483446a1e243b58ec`
- 当前产品 tree：`1bc77790d7327b364a6e972620de456aa913f699`
- 当前产品 binary diff SHA-256：`9e5ff0c70dbafc96700ea2479fec886b21e9926263f6406e435adc92b9a9002d`

拓扑要求：`G` 是 `P` 的直系子提交；未来 `A` 是 `G` 的直系子提交；最终 promotion merge 的 parents 必须为 `[B,A]` 且 tree 等于 `A`。
