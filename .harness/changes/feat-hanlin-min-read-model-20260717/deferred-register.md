# P9 deferred register

P9 只闭合翰林院第一条真实只读线。以下差集没有被本 change 静默吸收：

| 项目 | 当前状态 | Owner / 波次 | 进入条件 |
| --- | --- | --- | --- |
| contributions / reviews / recommendations / awards | 后端保持诚实空响应；前端旧写控件调用未存在的契约 | Hanlin product owner / Wave 3 | 先定义事实源、状态机、权限与验收，不得以页面字段倒推出写模型 |
| scouting / incubation / export-offerings | 后端仅空读或 404；不存在持久化写契约 | Hanlin product owner / Wave 3/6 | 有真实 owner、数据来源和回滚方案后另立 change |
| 页面内 `readHanlinRole()` 与 `x-hanlin-role` | 仅 UI capability 提示；不是服务端权限事实源 | Auth owner / Wave 3 | JWT 明确角色 claim 后统一迁移；此前后端只认 `require_admin` |
| `reset-demo` | 保留兼容 GET/POST，但为 admin-only 诚实 no-op；P9 UI 已无调用 | Hanlin owner / Wave 3 | 证明仓内外调用清零后删除端点 |
| 完整翰林域、独立表/状态机/provider/prompt | 未建立 | FULL_COURT_V2 backlog | 真实业务闭环与 owner 获批；不得从 P9 薄读模型扩建 |
| public/pilot 发布 | `/hanlin` 仍为 internal-only | Release owner / Wave 6 | 安全、产品和真实用户验证完成 |

## 明确不算 P9 完成

- 上述空端点不等于功能已实现。
- 客户端角色徽标不等于授权。
- `truth_ledger` 投影只证明离线确定性判定可读，不证明贡献、发奖、修典或出海闭环。
