# 规格说明：fix-launch-s1-p0-canonical-deploy-paths-20260714

## 背景

S1 要冻结 `chaotang-os` 为唯一代码真源，但 P0 compose、systemd 模板和恢复手册仍指向已退役的前后端独立仓库。部署入口若继续读取旧路径，即使当前仓库检查全绿，也无法证明线上运行来自当前 monorepo。

## 范围

- 仅修复 `frontend/docker-compose.yml`、两份前端部署 service、后端 service、前端部署 README 与 env 标题中的旧事实源。
- 新增跨线静态门禁，逐文件拒绝已确认的旧路径并要求 canonical path。
- 事实源固定为 `/home/ubuntu/Projects/chaotang-os/{frontend,backend}` 与 `git@gitee.com:msxn/chaotang-os.git`。

## 非目标

- 不停止、替换或重启当前 3050/8081/4444 进程。
- 不构建不可变 artifact，不配置外部发布信任锚，不宣称生产 READY。
- 不清理 cron、监控、环境探测脚本中的旧路径；它们属于后续最小闭环。
- 不修改端口、鉴权、worker 数或启动策略。

## 验收标准

- 每个目标文件先由独立子测试产生 RED，再经相同测试转为 GREEN。
- 六个 P0 入口不再包含已确认旧路径，并包含 canonical monorepo 路径。
- 三层 harness doctor、相关生产生命周期回归、类型检查、diff 与敏感信息检查通过；未运行项明确披露。

## 验证计划

- `node --test scripts/canonical-deploy-paths.nodetest.mjs`
- `cd frontend && pnpm exec tsc --noEmit`
- 相关 production lifecycle node tests
- systemd/compose 静态验证
- 根、前端、后端 harness doctor
- `git diff --check`、敏感信息扫描与最终 diff 审查
