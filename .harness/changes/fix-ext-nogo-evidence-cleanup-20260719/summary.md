# 变更摘要：fix-ext-nogo-evidence-cleanup-20260719

Packet ID: P19

| 字段 | 值 |
| --- | --- |
| Change ID | fix-ext-nogo-evidence-cleanup-20260719 |
| 类型 | fix |
| 状态 | READY_FOR_INDEPENDENT_REVIEW_V4 |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：清理 `4b0deee` 重新带入 ext 的 6 组悬挂 NO_GO、未终态或重复历史证据；历史仍由 Git 保存，当前树只保留可作为发布事实源的终态证据。
- 文件：删除 6 个 change 目录共 47 个文件；把一份正式 GO 复审的唯一终态行机械移到最后；新增本 change 的规格、任务、CI 与摘要。
- 验证：精确路径/数量核对、悬挂判词扫描、`git diff --check`、根/前端/后端三层 harness doctor、独立 Packet Review 与 D6。

## 明确保留

- `docs-department-agent-architecture-packet-spec-20260717/summary.md`：免责声明有价值，且同目录已有正式 `review-v1.md` 与 approval。
- `fix-alembic-single-authority-20260717/packet_review/review-v1.md`：内容和结论完整保留，只把既有唯一 `PACKET_REVIEW_GO` 从裁决标题后移到全文最后，满足 D6 终态格式。
- `known-red-baseline-ledger.md`：当前头部计数、表格 CLOSED 状态与分时核销记录一致。

## 发布纪律

- 本包不修改运行时代码，不宣称修复 D6 的文件名识别盲区。
- 当前树另有 `merge-p6-department-agent-consolidation-20260717/packet_review/independent-review-opus-20260718.md` 的历史 NO_GO；其缺陷已由 P16/P17 关闭，但记录无 superseded 标记且同样不被 D6 识别。本包只披露并移交 D6 加固包统一治理，不把它混入已核定的 47 项删除集合。
- D6 加固必须作为下一独立 packet，以本包成功上传后的远端 SHA 为前驱。

PACKET_CANDIDATE_V4_NOT_YET_REVIEWED
