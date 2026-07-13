# 变更摘要：feat-final-memorial-quality-gate-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | feat-final-memorial-quality-gate-20260714 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：候选奏折经过有效质量/来源门后，唯一晋升为正式奏折。
- 防绕过：皇帝 adopt/approve/archive 只能归档正式奏折。
- 验证：TDD RED→GREEN 与 verification-loop。

## 结果

- `CourtReview.memorial_json` 明确降级为候选奏折；新增一旨一条 `FinalMemorial` 正式事实源。
- quality failed、FALLBACK、DEMO、空候选均禁止晋升；任务进入 `awaiting_evidence`。
- adopt/approve/archive 必须存在正式奏折且有人类确认，史馆只归档正式快照。
- 事件账本新增 `memorial.formalized/blocked` 与 `decision.*`，status/home 读模型和前端类型已接入正式奏折。
- 当前分支确认为 `feature-chaotang-ext`；最终产品形态已写入产品文档和根架构。
- 因完整套件仍有 14 个范围外失败、Alembic CLI 不可用、未跑浏览器/部署验证，状态保持 `VERIFIED_PARTIAL`。
