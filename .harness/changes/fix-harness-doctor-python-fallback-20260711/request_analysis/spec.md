# 规格说明：fix-harness-doctor-python-fallback-20260711

## 背景

`feat-launch-readiness-hardening-20260711` 这轮改动做完前端/后端两层的验证后，用户要求"确保和 dev 先保持对齐"，顺带补跑了此前一直没跑过的根级 `node scripts/harness-doctor.mjs`，发现它报"delegated backend harness doctor failed"。定位后发现根因不是任何 harness 内容本身有问题，而是这段委托代码用 `spawnSync('python', ...)` 硬编码调用 `python` 命令，而当前这个 Linux 沙盒环境只安装了 `python3`(linuxbrew)，没有配 `python` 这个别名——命令本身就不存在(ENOENT)，跟 backend harness 的实际健康状况无关。`backend/AGENTS.md`、`backend/CLAUDE.md` 文档里写的调用方式也是 `python scripts/harness_doctor.py`，本次不改文档约定，只让委托脚本本身对"命令不存在"这一种失败模式更宽容。

## 范围

- `scripts/harness-doctor.mjs` 里委托 backend doctor 的那段 `spawnSync` 调用：优先按文档约定尝试 `python`；仅当返回结果的 `error.code === 'ENOENT'`(命令找不到，不是脚本内部报错)时，退回尝试 `python3`；两者都拿不到才判定为委托失败。

## 非目标

- 不改动 `backend/scripts/harness_doctor.py` 本身的检查逻辑。
- 不改动文档里写的 `python scripts/harness_doctor.py` 调用约定。
- 不在系统层面安装/软链 `python`，只让调用脚本自身更宽容。

## 验收标准

- 在只装了 `python3`、没有 `python` 别名的环境下，`node scripts/harness-doctor.mjs` 报 0 errors, 0 warnings。
- 在同时装了 `python` 和 `python3` 的环境下，行为不变(仍然优先走 `python`，不会因为这次改动多花一次进程调用)。

## 验证计划

- `node scripts/harness-doctor.mjs`(根级)
- `python3 scripts/harness_doctor.py`(backend 目录下单独确认原脚本本身健康)
