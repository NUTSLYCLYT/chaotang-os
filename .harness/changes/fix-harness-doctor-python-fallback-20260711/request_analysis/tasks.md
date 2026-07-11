# 任务：fix-harness-doctor-python-fallback-20260711

## 任务 1：委托调用加 python3 兜底

- 目标：让根级 harness doctor 在只有 `python3`、没有 `python` 别名的环境下也能正确委托 backend doctor，不把"命令不存在"误报成"backend harness 不健康"。
- 输入：`scripts/harness-doctor.mjs` 现有的 `spawnSync('python', ...)` 调用点。
- 输出：同一调用点补一次 `error.code === 'ENOENT'` 判断后的 `python3` 重试。
- 验收：`node scripts/harness-doctor.mjs` 从 1 error 变成 0 errors, 0 warnings；已完成(见 summary.md)。
