# 变更摘要：fix-rename-zhusi-zhuanshu-20260710

| 字段 | 值 |
| --- | --- |
| Change ID | fix-rename-zhusi-zhuanshu-20260710 |
| 类型 | fix |
| 状态 | DRAFT |
| Owner | Project Agent |
| 创建日期 | 20260710 |

## 范围

- 主线：将 1.0 一级模块“诸司”统一更名为“专署”，正式路由统一为 `/zhuanshu`，不保留旧 `/zhusi` 路由。
- 文件：前端模块配置、App Router 页面与导航；项目产品事实源；后端部门协议事实源与一致性测试。
- 验证：前端类型检查、路由单测、生产构建与页面核验；后端协议测试；三层 harness doctor。
