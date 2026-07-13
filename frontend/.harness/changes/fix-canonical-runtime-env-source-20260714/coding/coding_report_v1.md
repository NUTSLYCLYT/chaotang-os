# 实现报告 v1

## 改动

- 三个 candidate list 增加 `CHAOTANG_BACKEND_ENV_FILE`，自动默认改为 `../backend/.env`。
- 删除 `jiqun_ai*`、`fengQun` 和绝对路径自动探测。

## 取舍

- 保留旧显式 override 作为迁移兼容；优先级低于 canonical 新变量。

## 验证

- source contract、S1 regression、type/build、doctor。
