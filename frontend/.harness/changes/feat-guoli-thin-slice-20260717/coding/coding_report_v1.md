# 实现报告 v1

## 改动

- 新增 `guoli-overview` Zod 边界模型，只从响应数组选择 `yushi_rejection_rate`。
- 新增 canonical `/api/guoli/overview` client 与六部顶部御史指标卡。
- 卡片覆盖 LIVE、NO_DATA、loading、契约/网络错误，并显示七类契约字段。
- 新增默认开启、显式关闭的 `NEXT_PUBLIC_GUOLI_THIN_SLICE` 回滚门。
- 后端补齐 source/window/as_of/includes_demo 元数据，避免前端写死事实。
- 时间窗口按解析后的绝对时间取首尾，保留原始带 offset 时间戳，避免字符串排序误判。
- 按用户授权修复累计 smoke 暴露的上书房 canonical-path 回归：生产调用改走 `backendFetch('/api/shangshufang/finance-intel-loop/complete')`，不新增兼容 route/BFF。

## 取舍

- 沿用六部暗金宫苑视觉，只增加可撤回 overlay，不改画布和部门卡。
- 不建立独立国力页，不展示另外三项，不新增 BFF/mock fallback。
- NO_DATA 显示文字空态而非 `0%`。

## 验证

- node 4 passed；pytest 3 passed；typecheck/build/doctor PASS。
- Playwright 同轮捕获 API body 与 DOM，状态/样本/来源/窗口/DEMO 标记一致。
- 统一上书房 smoke 2/2 通过：授权裁决闸与缺证据补证分支均符合当前安全语义。
