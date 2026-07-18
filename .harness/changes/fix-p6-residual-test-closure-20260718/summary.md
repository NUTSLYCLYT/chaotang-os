# 变更摘要：fix-p6-residual-test-closure-20260718

Packet ID: P13

| 字段 | 值 |
| --- | --- |
| Change ID | fix-p6-residual-test-closure-20260718 |
| 类型 | fix |
| 状态 | IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260718 |

## 范围

- 主线：P6 后端已知红灯核销与 legacy router 遥测回归护栏。
- 文件：3 个后端测试、已知红灯台账、本 root change 证据。
- 验证：RED 基线、4 项定向回归、后端全量 pytest、后端/根级 doctor、diff check。

## 边界

- 精确基点：`origin/feature-chaotang-ext` = `bf7d4cccc3ca5e3ea80865801e032352357a58db`。
- 不恢复 `bf7d4cc..9f756ae` 中 48 个过期 packet 证据文件。
- 不包含 P8/P9 前端残余、门下省后续修复、工部安全修复、M1 或本地领先远端的其他提交。
- 不宣称 14 天 legacy 零调用窗口、router 退役、P8/P9 总体验收或 campaign DONE。

## 候选结果

- 远端基线的 roster 旧断言已由 RED 复现；当前定向回归 4 passed。
- 后端全量为 `2723 passed / 37 skipped / 4 warnings / 0 failed`。
- 等待独立 Claude Code 对精确候选提交复审；复审 GO 前不得合入或推送 ext。
