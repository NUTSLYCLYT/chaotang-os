# 变更摘要：feat-ext-d4a-docx-provenance-20260812

> 执行授权：`execution-authority.v2 / R0-W08 = GO`

| 字段 | 值 |
| --- | --- |
| Change ID | feat-ext-d4a-docx-provenance-20260812 |
| 类型 | feat |
| 状态 | IN_PROGRESS |
| Owner | Project Agent |
| 创建日期 | 20260812 |

## 范围

- 主线：`origin/feature-chaotang-ext@df6c82cfa3f3b449da7c5a4500c643c3f45501fd`
- 能力：安全摄取对 DOCX 正文、表格、页眉页脚、批注及修订/域指令采用同一规范文本面。
- 文件：`backend/src/secure_ingest/document_text.py`、现有 upload router、focused tests。
- 验证：3 个规范文本测试、现有 secure-ingest 测试、doctor、全量回归。
