# 变更摘要：fix-r0-w08-tenant-null-and-harness-remediation-20260801

> 执行授权：用户批准的 R0-W08 两项精确 amendment；候选仅在隔离 worktree 验证，不自动整合 EXT。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w08-tenant-null-and-harness-remediation-20260801 |
| 类型 | fix |
| 状态 | DRAFT |
| Owner | Project Agent |
| 创建日期 | 20260801 |

## 范围

- 主线：`feature-chaotang-ext`，基线 `8d17d3b1`。
- 安全修复：`backend/web/routers/shangshufang.py` 与其 focused tests，拒绝 tenantless 合同草稿/确认。
- Harness/测试修复：仅更新后端测试夹具/基线、P0-B swarm GET probes，以及前端测试运行器、合同校验器、YAML mirror、旧 BFF guards 和时间敏感测试夹具。
- 验证：后端完整 pytest、前端 `test:node`/`test:core`、真实模式 build、两级 harness doctor、W08 preflight。

## 非目标

- 不 push、不部署、不迁移数据库、不操作 3050、不整合 EXT。
- 不新增页面、Agent、BFF、状态机、数据库模型或产品合同字段。

## 当前结论

- 产品/治理验证候选：`VERIFIED_PARTIAL`。
- W08 closeout 仍被真实非开发用户验收记录阻塞；不得用 fixture 冒充。
