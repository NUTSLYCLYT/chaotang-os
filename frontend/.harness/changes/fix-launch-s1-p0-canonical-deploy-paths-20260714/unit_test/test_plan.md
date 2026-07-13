# 单测计划

## 覆盖范围

- compose build context、web unit、两份 backend unit、恢复手册、env 标题。
- 每个目标独立检查旧值消失与 canonical 值存在。

## 命令

- `node --test scripts/canonical-deploy-paths.nodetest.mjs`

## 未覆盖风险

- 静态测试不证明目标路径上已经安装依赖或服务已成功启动。
- 本批之外的旧 cron/监控/探测路径尚未纳入门禁。
