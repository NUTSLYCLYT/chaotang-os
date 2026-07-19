# 变更摘要：fix-p8-p9-frontend-residual-cleanup-20260718

Packet ID: P14

| 字段 | 值 |
| --- | --- |
| Change ID | fix-p8-p9-frontend-residual-cleanup-20260718 |
| 类型 | fix |
| 状态 | IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260718 |

## 范围

- 主线：P8/P9 前端残余清理，删除零引用翰林 mock 并锁定尚书房 canonical API 路径。
- 文件：删除 1 个零引用 mock、新增 1 个 node 回归测试、本 root change 证据。
- 验证：引用扫描、相关 node tests、TypeScript、REAL 模式 build、前端/根级 doctor、diff check。

## 边界

- 精确基点：`origin/feature-chaotang-ext` = `6ee6d8d542127174f4d899f940d4937b6fa2b70f`（P13 已发布）。
- 不修改页面、组件、生产调用、API 契约、source label、视觉或交互。
- 不恢复 P8/P9 旧 change 目录，不夹带门下省、工部、M1 或其他本地提交。
- 本包不宣称 P8/P9 总体验收完成；只清理 P12 遗留的两个前端残余。

## 候选结果

- `hanlin-home-mock.ts` 删除前已确认生产源码零引用，删除后 TypeScript/build 通过。
- 尚书房生产调用继续使用 `/api/shangshufang/finance-intel-loop/complete`，新增测试阻止旧 court-prefixed 路径回流。
- 等待独立 Claude Code 对精确候选 SHA 复审；GO 前不得合入或推送 ext。
