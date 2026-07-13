# 需求说明

## 背景

八个 cron、健康监控和恢复脚本仍从退役 checkout 执行或向值班人员输出旧恢复命令，使 canonical monorepo 无法成为真实运维事实源。

## 范围

- 两个前端 cron、self-healing、system-restore、health-monitor、daily-metrics 使用 canonical frontend/backend。
- 两个后端 cron/upgrade monitor 使用 canonical backend。
- 手动 8081 指令使用项目 venv gunicorn runner。
- 新增八项独立路径门禁。

## 非目标

- 不改 runtime env discovery/release gate，不改历史材料。
- 不安装或真实运行 cron、告警、升级监控和蜂群。
- 不在本闭环修改 restore dry-run 的健康判定逻辑。

## 验收标准

- 八项先 RED 后 GREEN，联合部署契约 18/18。
- Shell/Node 语法和完整 candidate verification-loop。
- 副作用脚本只做静态/受控 dry-run，并记录所有未覆盖项。

## 风险

- 绝对 canonical 路径仍是当前标准部署约定，异机参数化尚未设计。
- cron 尚未验证真实用户环境、PATH、权限和通知通道。
- dry-run 当前能在端口未监听时输出全绿，不能作为发布健康证据。

## 验证计划

- operational/path/runtime node tests、bash/node syntax。
- build/type/production tests/backend pytest/compose/doctor。
- restore dry-run、prod:doctor、安全与 diff 检查。
