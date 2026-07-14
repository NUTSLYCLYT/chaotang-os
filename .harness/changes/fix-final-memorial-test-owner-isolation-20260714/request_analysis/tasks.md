# 任务：fix-final-memorial-test-owner-isolation-20260714

## 任务 1

- 目标：让正式奏折测试在保持对象级授权的前提下使用一致 owner/认证身份。
- 前置条件：现有 focused RED；保留其他脏工作区。
- 输入：全局测试用户 `1`、隔离内存 Session、正式奏折候选。
- 输出：owner-aligned seed 和明确 API success 断言。
- 涉及文件：`backend/tests/test_final_memorial_gate.py`、根 change、launch blueprint。
- 状态 / 数据变化：仅内存测试 DB；真实 DB 不变。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：单提交反向回滚；生产代码/数据不变。
- 完成定义：8 项文件测试与 41 项主链通过，真实 DB hash/size/mtime 不变。
