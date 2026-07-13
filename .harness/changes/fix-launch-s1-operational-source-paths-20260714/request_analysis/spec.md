# 规格说明：fix-launch-s1-operational-source-paths-20260714

## 背景

部署入口与 8081 runner 已收敛后，八个实际 cron、监控和恢复文件仍引用退役前后端仓库。定时任务会从旧 checkout 执行，告警会给出错误恢复指令，造成“代码已统一但自动化仍运行旧代码”的双真源。

## 范围

- 仅修复八个 cron/monitor/restore 执行文件中的旧路径和手动恢复指令。
- 前端事实源固定 `/home/ubuntu/Projects/chaotang-os/frontend`，后端固定 `/home/ubuntu/Projects/chaotang-os/backend`。
- 手动 8081 恢复复用已验证的项目 venv gunicorn runner。
- 新增逐文件防回归门禁。

## 非目标

- 不修改 runtime env discovery、release gate 或 shared-env 的秘密搜索优先级。
- 不改写历史审计、handoff、fixture 或业务注释。
- 不安装 crontab，不执行会发 Telegram、写状态或调用真实蜂群的任务。
- 不修复本轮验证新发现的 restore dry-run 健康语义矛盾。

## 验收标准

- 八个文件分别先 RED，修改后相同测试 8/8 GREEN。
- Shell/Node 语法、联合部署契约、build/type/regression/doctor 通过。
- 受控 `system-restore --dry-run` 不重启服务；发现的语义缺陷必须如实记录。

## 验证计划

- operational/path/runtime 三组 node 契约测试。
- `bash -n`、`node --check`，按环境尝试 shellcheck。
- production build/typecheck/24 项回归、后端 28 项 pytest、compose/doctor。
- `system-restore --dry-run`、prod:doctor、scope/secret/diff scan。
