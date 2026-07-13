# 变更摘要：fix-shangshufang-im-canonical-path-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-shangshufang-im-canonical-path-20260713 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：修复上书房 IM 浏览器请求使用退役 court alias 导致的 404。
- 文件：上书房页面、相关 E2E route mock、路径回归测试与两层 change 记录。
- 验证：node tests 5 passed、TypeScript/build 通过；真实 production 浏览器 4 GET + 3 POST 均 200、控制台 0 error；合同下旨成功，后端 outbox 持续 processing 成为下一阻塞。

## 2026-07-14 独立验收

- 结论：验收合入（提交 `af2e693`）；当前 canonical IM path 专项通过。
- 边界：只验收路径契约；outbox、正式奏折与生产身份由后续变更独立验收。
