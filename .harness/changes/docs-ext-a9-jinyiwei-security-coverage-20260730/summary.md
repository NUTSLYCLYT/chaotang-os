# 变更摘要：docs-ext-a9-jinyiwei-security-coverage-20260730

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-ext-a9-jinyiwei-security-coverage-20260730 |
| 类型 | docs |
| 状态 | DESIGN_READY / USER_SPEC_REVIEW_PENDING / IMPLEMENTATION_NOT_AUTHORIZED |
| Owner | EXT Master Governance / Codex |
| 创建日期 | 20260730 |
| 基线 | `feature-chaotang-ext@4f28d048296140431108bb429c1e2dbebc922363` |
| 资产来源 | `task/pkt-a1-jinyiwei-real-fetch@9651be5235c3ae5c79acd699ccb34cace62b0a11` |

## 范围

- 主线：EXT-A9-E1 锦衣卫真实数据源与共享证据池安全覆盖审计。
- 文件：仅本 change Packet；不修改后端、前端、数据库 schema 或运行配置。
- 验证：Git ancestry、聚焦后端测试、authority、根 Harness doctor 和文档 diff。

## 结论

- 历史锦衣卫候选分支相对当前 EXT 没有独有提交，不需要 merge 或 cherry-pick。
- SEC EDGAR、Tavily、锦衣卫可信度门、共享证据池和租户隔离均已存在于 EXT。
- 当前实现存在两个 P1 级候选缺口，进入实现前必须先用失败测试证实：
  1. `fill-gap` 只校验 `user_id`，未使用现有 tenant + user 双重 ownership helper。
  2. 调用方自带 findings 可以声明 `tier="一手"`，并被持久化为 tenant 共享的
     `jinyiwei_verified` 证据。
- 输入上限、检索限流、错误信息和 Tavily 多源语义列为 P2 加固候选。
- 现有固定外联目标、环境变量密钥、8 秒超时、失败诚实降级、数据库唯一约束和
  tenant-scoped 查询属于已覆盖控制。

## 治理决定

该资产从 `ABSORB_AFTER_SECURITY_REVIEW` 更新为：

`SUPERSEDED_BY_EXT_HEAD / SECURITY_REMEDIATION_CANDIDATE`

本 Packet 不授予修复权。书面规格经用户复核后，才允许生成 TDD 实施计划和精确
scope amendment。
