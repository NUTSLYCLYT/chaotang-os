# 规格说明：fix-final-memorial-test-owner-isolation-20260714

## 背景

对象级授权加入后，`test_live_quality_passed_candidate_is_formalized_once` 将任务 owner 写成 `formal-memorial-tester`，但全局 API 测试身份是 `user_id=1`。状态接口正确返回“无权查看该任务”，测试却直接读取 `data.formal_memorial`，形成既有 RED。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | RED 响应为 `success=false,error=无权查看该任务` | `backend/tests/test_final_memorial_gate.py` focused pytest | pytest | 是 |
| 已确认事实 | `isolated_session_local` 已 monkeypatch `src.db.engine.SessionLocal`，router 在调用时动态 import | `backend/tests/conftest.py:138`；`backend/web/routers/shangshufang.py:1330` | 代码审查 | 否 |
| 已确认事实 | 测试前后真实 DB hash/size/mtime 相同 | `10dbcf...59e2`、`2121728`、`1783863664` | 主链测试前后命令 | 否 |
| 推测 | 无 | 不适用 | 不脑补 | 否 |
| 未知问题 | 全仓所有测试是否均有 production-path tripwire | 本闭环仅跑正式主链 6 文件 | S2 后续全仓隔离门 | 是 |

## 数据流与调用链

`pytest -> isolated_session_local(StaticPool memory DB) -> seed DecisionTask(owner=authenticated user) -> formalize_memorial -> TestClient -> get_current_user(user_id=1) -> runtime-imported patched SessionLocal -> ownership check -> formal memorial/status/home assertions`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 测试认证身份 | `backend/tests/conftest.py::_authenticated_api_user` | FastAPI `get_current_user` override | `user_id=1` |
| 测试任务 owner | `_seed_candidate(..., user_id="1")` | status/decision/home API | 必须与当前测试身份一致；跨用户测试另行显式传 owner |
| 隔离 Session | `isolated_session_local` | 业务代码与 TestClient | in-memory StaticPool；测试结束 drop/dispose |

## 范围

只修正式奏折测试 fixture 的 owner 契约，并增强失败消息；更新根 change 与 launch blueprint。

## 非目标

不修改生产授权、不放宽管理员越权、不修改数据库实现、不建立全仓 tripwire、不重启服务。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| owner 与当前认证用户一致 | API 可读取并完成正式奏折闭环 | focused/full-file pytest |
| owner 不一致 | 生产 API 继续拒绝 | 既有 P0-B 跨用户测试；本轮不改生产代码 |
| 主链测试运行 | 真实 DB hash/size/mtime 不变 | 前后快照 |

## 风险与回滚边界

风险是为了让测试通过而削弱授权；本实现只改测试 seed，生产 router 零改动。回滚只回滚测试/文档提交。

## 计划确认记录

- 批准人：用户（“下一步”）
- 批准日期：2026-07-14
- 批准范围：S2 单一测试隔离闭环
- 明确未批准：生产授权修改、全仓测试重构、服务/数据库操作

## 验收标准

RED 明确证明 owner mismatch；测试文件全绿；正式主链全绿；真实 DB 三元证据不变；doctor/lint/diff/security 通过。

## 验证计划

focused RED→GREEN、全文件 pytest、正式主链 6 文件、真实 DB 前后快照、Python compile/lint、根/后端 doctor、scoped diff/secret scan。
