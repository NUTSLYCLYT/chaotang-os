# P9 coding report v1

## 结果

- 后端以 router-level `require_admin` 保护全部 Hanlin API。
- 第一条真实数据线复用既有租户级 `truth_ledger`；只有至少一条确定性记录才可声明 `TRUTH_LEDGER`。
- 前端统一走认证 transport，来源未知、字段缺失或确定性计数为 0 时 fail-closed 为 `FALLBACK`。
- 首页和实验池只读；删除 355 行零引用 mock、实验伪写动作和默认可见静态规划样例。
- 没有新增表、状态机、provider、prompt 或新的业务事实源。

## TDD 轨迹

| RED | 最小修正 | GREEN |
| --- | --- | --- |
| 普通用户/匿名访问期望 403/401，旧实现返回 200 | router 级 `Depends(require_admin)` | 权限反例通过 |
| read-model 模块不存在 | 新增严格来源归一与 ledger view | 正常、缺失、未知来源通过 |
| `fetchHanlinJson` 不存在 | 复用 `backendFetch` | Bearer 与 403 测试通过 |
| 非确定性-only 账本仍标 `TRUTH_LEDGER` | 后端要求 `deterministic_entries > 0`，前端二次校验 | 双端 fail-closed 测试通过 |
| 权限收紧后静态守门列出 7 个裸 fetch 页面 | 全部 Hanlin 调用迁移认证 transport | 守门由 7 页失败变为 0 页 |

## 回滚

- UI 投影与 transport 可整体回滚，但不得恢复匿名 Hanlin API 或隐式 mock。
- 删除文件可从 Git 历史恢复；若将来需要 demo，必须另立 change、显式 flag 与来源标签。
- 本 change 无数据库写入或迁移，代码回滚无需数据回滚。
