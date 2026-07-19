# 变更摘要：fix-d6-legacy-review-resolution-20260719

Packet ID: P20

| 字段 | 值 |
| --- | --- |
| Change ID | fix-d6-legacy-review-resolution-20260719 |
| 类型 | fix |
| 状态 | READY_FOR_INDEPENDENT_REVIEW_V2 |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：D6 从“只识别标准 review-vN.md”升级为“标准 review + packet_review 树内所有 legacy Markdown”双轨终态检查。
- 规则：legacy review 必须有唯一机器 verdict；NO_GO/证据不足必须显式指向一个或多个最新标准 GO，缺元数据、缺目标、旧版本或非 GO 一律 fail closed。
- 兼容：为当前 Opus 历史 NO_GO 标注 P16/P17 两条解决链；为 P4.5 非标准 GO 标注机器 verdict。原审查正文与结论不删除、不改写。
- 文件：core verifier、Node TDD、wiki、两份 legacy review 元数据与本 change 证据。
- 边界：仍为 LOCAL_FEEDBACK_ONLY，不是 Gitee required check 或安全边界。

PACKET_READY_FOR_CLAUDE_REVIEW_V2
