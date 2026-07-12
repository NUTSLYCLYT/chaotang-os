# 变更摘要：fix-mobile-decree-input-overflow-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-mobile-decree-input-overflow-20260713 |
| 类型 | fix |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：御前输入操作行在手机宽度允许换行，消除右侧溢出。
- 文件：DecreeInput、移动回归测试与两层 change。
- 验证：test/tsc/build 通过；390px production harness overflow=[]，页面矩阵 9/9。
