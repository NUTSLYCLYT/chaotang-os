# 变更摘要：fix-pr3-required-doc-consistency-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | fix-pr3-required-doc-consistency-20260719 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：根级产品文档与产品发布门；不修改前端、后端或运行时。
- 文件：产品宪法、R0/R1 PRD、产品融合决策记录、收敛指南及本 change 证据。
- 修复：冻结 R0 真实数据禁入边界；拆分合同风险与 release/运营 P0/P1 命名空间并定义分母；统一 R1 退出到 R2 的 5/3/1/1 统计口径。
- 验证：差异/冲突扫描、Markdown 相对链接、根级 harness doctor，以及 documents-only 相关回归测试。
