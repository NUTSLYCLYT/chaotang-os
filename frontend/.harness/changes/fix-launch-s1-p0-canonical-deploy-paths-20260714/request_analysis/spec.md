# 需求说明

## 背景

S1 已冻结 `chaotang-os` 为唯一代码真源，但前端拥有的 compose、systemd 模板与恢复手册仍引用退役的 `chaotang-web-lyt`、`jiqun_ai_fresh` 及旧绝对路径。这会让运维人员从错误代码启动 3050/8081。

## 范围

- 将前端 compose 的 backend build context 收敛到 `../backend`。
- 将前后端 service 模板收敛到 `/home/ubuntu/Projects/chaotang-os/{frontend,backend}`。
- 将恢复手册收敛为一次克隆 canonical monorepo。
- 用根级 node test 拒绝旧路径回归。

## 非目标

- 不修改页面、API、数据库或工作流业务逻辑。
- 不停止/重启生产进程，不执行 artifact build 或发布接管。
- 不处理本批 P0 文件之外的 cron、监控与探测脚本。

## 验收标准

- 六个独立旧路径断言先 RED、后 GREEN。
- 类型检查、相关生产生命周期回归和三层 doctor 通过。
- compose/systemd 静态检查通过，或把环境限制如实记录。

## 风险

- 固定绝对路径假设仅适用于当前标准 Linux 部署；异机部署仍需模板化方案。
- 两份后端 systemd unit 的启动器仍不一致；本步不扩大为运行策略统一。
- 外部 legal-agent 仍是独立依赖，不被误称为朝堂 OS 代码真源。

## 验证计划

- `node --test scripts/canonical-deploy-paths.nodetest.mjs`
- `pnpm exec tsc --noEmit`
- production lifecycle 相关 node tests
- compose/systemd 静态检查、三层 doctor、diff/secret 检查
