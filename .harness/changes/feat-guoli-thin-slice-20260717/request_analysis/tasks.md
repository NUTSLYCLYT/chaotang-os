# 任务：feat-guoli-thin-slice-20260717

## 任务 1：契约红灯

- 目标：锁定御史指标的窗口、来源、截止时间、DEMO 标记和 NO_DATA 语义。
- 前置条件：P7 发布基线与 P8 计划已确认。
- 输入：现有 guoli router 与 truth_ledger。
- 输出：先失败的后端与前端契约测试。
- 涉及文件：`backend/tests/`、`frontend/src/features/guoli/`。
- 验证命令与证据：pytest 与 node test 的 RED 输出。
- 回滚边界：仅删除新增测试。
- 完成定义：失败原因只指向尚未实现的 P8 行为。

## 任务 2：薄投影实现与验证

- 目标：实现最小契约补强和六部顶部指标卡。
- 输入：任务 1 的行为测试。
- 输出：后端元数据、前端 adapter/card/flag、浏览器证据。
- 涉及文件：后端 guoli router、前端 guoli feature、六部页面、E2E、change 记录。
- 验证命令与证据：pytest、node、typecheck、build、doctor、Playwright API/UI 对照。
- 回滚边界：关闭 `NEXT_PUBLIC_GUOLI_THIN_SLICE`；不恢复 mock。
- 完成定义：所有验收标准有机器证据且无范围外改动。

## 任务 3：累计 smoke 解阻（用户授权扩围）

- 目标：修复统一 smoke 实证的 P3 canonical-path 回归，不恢复退役页面或前端 BFF。
- 输入：当前 `/shangshufang` 404、后端 canonical route、人工授权裁决边界。
- 输出：统一 transport 调用、路径回归测试、当前 UI smoke。
- 验证命令与证据：node RED/GREEN；Playwright 2/2 与 trace。
- 回滚边界：只撤销上书房 canonical 调用和对应测试校准，不影响 P8 国力开关。
- 完成定义：真实浏览器不再 404；成功分支停在授权裁决，缺证据分支不可归档。
