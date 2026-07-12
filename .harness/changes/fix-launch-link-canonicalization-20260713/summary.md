# 变更摘要：fix-launch-link-canonicalization-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-launch-link-canonicalization-20260713 |
| 类型 | fix |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：军机处/大殿退役链接改到首发页面，户部移除重复 basePath 拼接。
- 文件：军机处页、大殿组件/数据、户部链接/跳转、2 条回归测试与两层 change。
- 验证：2 tests、tsc/build 通过；production harness 军机处、大殿、户部全部 PASS，总计 8/9。
