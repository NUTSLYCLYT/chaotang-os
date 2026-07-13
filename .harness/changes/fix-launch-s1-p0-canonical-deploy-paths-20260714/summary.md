# 变更摘要：fix-launch-s1-p0-canonical-deploy-paths-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-launch-s1-p0-canonical-deploy-paths-20260714 |
| 类型 | fix |
| 状态 | DRAFT |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：S1 唯一代码真源；跨前端部署入口与后端 service。
- 文件：六个部署配置/文档、一个根级路径门禁、根/前端 change 记录。
- 验证：TDD RED→GREEN；候选 PR verification-loop（结果见 `ci_result/ci_summary.md`）。
- 边界：不接管服务、不生成发布 artifact、不推进 S2–S10，状态保持 DRAFT 等待用户确认。
