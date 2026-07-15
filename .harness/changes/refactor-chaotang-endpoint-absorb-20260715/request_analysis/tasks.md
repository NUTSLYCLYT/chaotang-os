# 任务：refactor-chaotang-endpoint-absorb-20260715

## 任务 1 — P3a scribe canonical read

- 目标：移除史官对旧复盘存储与冻结王座投影的双读，改读 canonical 归档。
- 前置条件：P2 tripwire/观测守门已合入 ext；王座保持冻结。
- 输入：`ShiguanArchive` + 可选 `FinalMemorial`。
- 输出：既有 lessons / CourtDoc 响应形状。
- 涉及文件：`backend/web/routers/scribe.py`、scribe/flywheel 相邻测试、本 change 证据。
- 状态 / 数据变化：只读投影；无 schema、写入或迁移。
- 验证命令与证据：`ci_result/ci_summary.md`，22 passed。
- 回滚边界：P3a 原子 commit；恢复 legacy 需走 P2 临时程序。
- 完成定义：结构依赖清零；正常/失败/权限/租户/去重/来源测试通过。
- 状态：VERIFIED，待原子 commit。

## 任务 2 — P3b taskDetail / stream

- 状态：PENDING；P3a commit 后开始。

## 任务 3 — P3c manor / direct dispatch

- 状态：PENDING；P3b commit 后开始。

## 任务 4 — P3d daemon / runstate

- 状态：PENDING；物理拆除受 P2 deprecation 计数证据门约束。

## 任务 5 — P3e whitelist zero

- 状态：PENDING；完成后才汇总整包并请求独立审查。
