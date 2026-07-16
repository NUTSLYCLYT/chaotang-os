# 变更摘要：refactor-frontend-second-brain-sunset-20260716

| 字段 | 值 |
| --- | --- |
| Change ID | refactor-frontend-second-brain-sunset-20260716 |
| 类型 | refactor |
| 状态 | VERIFIED_PARTIAL（P4a 施工图完成；P4b/P4c 尚未实现） |
| Owner | Project Agent |
| 创建日期 | 20260716 |

## 范围

- 主线：P4 前端 second-brain 退役，收敛军机处/上书房重复读模型计算。
- 当前检查点：P4a 只读分析；从军机处实际 UI 消费字段反推后端 brief/memorial
  投影缺口，未修改运行时、接口或状态。
- 文件：`.harness/changes/docs-full-court-v1-strategy-20260714/p4a-read-model-gap-map.md`
  与本根级 change 记录。
- 结论：9 个缺口均可从现有 `court_doc`、brief、memorial 与 quality gate 纯派生，
  不需要新表或新状态机；P4b 应先删除已有后端等价物的本地叠加。
- 验证：commit diff check、根/backend harness doctor、backend closeout；无运行时代码测试需求。
