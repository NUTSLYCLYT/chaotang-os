# Flask → FastAPI 迁移进度

> 阶梵式全量替换：保留 `web/app.py` 不动，新代码进入 `web/main.py`，逐阶段迁移路由。

## 🎉 全量迁移完成 ✅（2026-05-17 阶段 6 收尾）

**131/131 路由 100% FastAPI 化**，共 128 个冒烟测试 + 65 个 pytest 通过。
旧 Flask 代码已完全清除。

### 阶段 6 全部完成项

**6a — 非破坏性 cleanup**
- ✅ `tests/test_web_api.py` 改写为 FastAPI TestClient — **65/65 pytest 通过**
- ✅ `gunicorn.conf.py` 默认 `worker_class` 切到 `uvicorn.workers.UvicornWorker`
- ✅ `DEPLOYMENT.md` / `PROJECT_OVERVIEW.md` / `CLAUDE.md` 所有 `web.app:app` 引用切到 `web.main:app`

**6b — 破坏性 cleanup（已执行）**
- ✅ 删除 `web/app.py` (4787 行)
- ✅ 删除 `web/voice_api.py` (207 行)
- ✅ 删除 `src/auth_middleware.py` (87 行)
- ✅ 从 `requirements-core.txt` 移除 `flask>=3.0.0` 依赖
- ✅ 清理 DEPLOYMENT.md / PROJECT_OVERVIEW.md 中过时的 `_validate_run_id` / Flask troubleshooting 段落
- ✅ FastAPI app 版本号收尾为 `2.0.0`（去掉 `stage4d` 字样）
- ✅ 验证：0 个 lingering ref、app 启动正常、65/65 pytest 通过

**总计删除 5081 行 Flask 代码。**

> **阶段 5 SSE 端到端实测成功**：POST /api/runs/async 启动 LLM 调用后，订阅 /api/runs/stream/{task_id} 即时收到 `flow_start → step_start → 9× token` 共 11 个真实事件，确认 threading + queue + StreamingResponse 模式工作正常。

> 4-C 中 9 个端点返回 500：根本原因是 `src/agent_communication.py`、`src/deploy_manager.py`、`src/approval_manager.py` 在当前 codebase 中**不存在**，加上 `chromadb` 和 `fcntl`（Windows）依赖缺失。**Flask 旧版会返回完全相同的 500**，已逐条核对 detail 文本一致 → 行为等价、迁移正确。

| 路由 | 旧 Flask | 新 FastAPI | 状态 |
|------|----------|------------|------|
| `GET  /api/health` | `web/app.py` | `web/routers/health.py` | ✅ 验证通过 |
| `POST /api/auth/login` | `web/app.py` | `web/routers/auth.py` | ✅ 验证通过 |
| `GET  /api/auth/me` | `web/app.py` | `web/routers/auth.py` | ✅ **修复了白名单 bug** |
| `POST /api/auth/logout` | `web/app.py` | `web/routers/auth.py` | ✅ 验证通过 |
| `GET  /api/admin/tenants` | `web/app.py` | `web/routers/admin.py` | ✅ 新增 admin 权限校验 |
| `POST /api/admin/tenants` | `web/app.py` | `web/routers/admin.py` | ✅ |
| `GET  /api/admin/users` | `web/app.py` | `web/routers/admin.py` | ✅ |
| `POST /api/admin/users` | `web/app.py` | `web/routers/admin.py` | ✅ |
| `GET  /api/flows` | `web/app.py` | `web/routers/flows.py` | ✅ 验证通过 |
| `GET  /api/flows/{filename}` | `web/app.py` | `web/routers/flows.py` | ✅ 新增路径穿越防御 |
| `PUT  /api/flows/{filename}` | `web/app.py` | `web/routers/flows.py` | ✅ |
| `POST /api/flows` | `web/app.py` | `web/routers/flows.py` | ✅ |
| `GET  /api/tools` | `web/app.py` | `web/routers/tools.py` | ✅ |
| `POST /api/voice/process` | `web/voice_api.py` | `web/routers/voice.py` | ✅ Pydantic 校验 |
| `GET  /api/voice/health` | `web/voice_api.py` | `web/routers/voice.py` | ✅ |
| `GET  /api/voice/sessions` | `web/voice_api.py` | `web/routers/voice.py` | ✅ |
| `GET  /` | `web/app.py` | `web/main.py` | ✅ FileResponse |
| `GET  /docs` | — | `web/main.py` | ✅ **新增自动 OpenAPI** |

**18 路由已迁移。**

### 阶段 4-A 新增 27 路由

| 路由 | 旧 Flask | 新 FastAPI | 状态 |
|------|----------|------------|------|
| `GET  /api/runs` | `web/app.py` | `web/routers/runs.py` | ✅ 损坏 run 容错 |
| `GET  /api/runs/{run_id}` | `web/app.py` | `web/routers/runs.py` | ✅ |
| `GET  /api/runs/{run_id}/steps/{step_index}` | `web/app.py` | `web/routers/runs.py` | ✅ |
| `POST /api/run` | `web/app.py` | `web/routers/runs.py` | ✅ Pydantic 校验 |
| `PUT  /api/runs/{run_id}/final-output` | `web/app.py` | `web/routers/runs.py` | ✅ |
| `GET  /api/runs/{run_id}/quality` | `web/app.py` | `web/routers/runs.py` | ✅ |
| `GET  /api/runs/{run_id}/optimize/trigger` | `web/app.py` | `web/routers/runs.py` | ✅ |
| `POST /api/runs/{run_id}/rerun` | `web/app.py` | `web/routers/runs.py` | ✅ |
| `GET  /api/analytics` | `web/app.py` | `web/routers/analytics.py` | ✅ Query 参数校验 |
| `GET  /api/runs/{run_id}/feedback` | `web/app.py` | `web/routers/feedback.py` | ✅ |
| `POST /api/runs/{run_id}/feedback` | `web/app.py` | `web/routers/feedback.py` | ✅ |
| `GET  /api/feedback` | `web/app.py` | `web/routers/feedback.py` | ✅ |
| `GET  /api/compare` | `web/app.py` | `web/routers/compare.py` | ✅ |
| `GET  /api/compare/quality` | `web/app.py` | `web/routers/compare.py` | ✅ |
| `GET  /api/compare/export` | `web/app.py` | `web/routers/exports.py` | ✅ 复用 build_compare_payload，无 test_request_context hack |
| `GET  /api/runs/{run_id}/export/final` | `web/app.py` | `web/routers/exports.py` | ✅ |
| `GET  /api/runs/{run_id}/steps/{step_index}/export/prompt` | `web/app.py` | `web/routers/exports.py` | ✅ |
| `GET  /api/runs/{run_id}/steps/{step_index}/export/output` | `web/app.py` | `web/routers/exports.py` | ✅ |
| `POST /api/runs/{run_id}/repair` | `web/app.py` | `web/routers/repairs.py` | ✅ Pydantic 校验阈值范围 |
| `GET  /api/repairs` | `web/app.py` | `web/routers/repairs.py` | ✅ |
| `GET  /api/repairs/{session_id}` | `web/app.py` | `web/routers/repairs.py` | ✅ |
| `GET  /api/repair-insights` | `web/app.py` | `web/routers/repairs.py` | ✅ |
| `GET  /api/drafts` | `web/app.py` | `web/routers/drafts.py` | ✅ |
| `GET  /api/drafts/stats` | `web/app.py` | `web/routers/drafts.py` | ✅ |
| `GET  /api/drafts/{draft_id}` | `web/app.py` | `web/routers/drafts.py` | ✅ |
| `POST /api/drafts/{draft_id}/approve` | `web/app.py` | `web/routers/drafts.py` | ✅ |
| `POST /api/drafts/{draft_id}/reject` | `web/app.py` | `web/routers/drafts.py` | ✅ |
| `POST /api/drafts/{draft_id}/execute` | `web/app.py` | `web/routers/drafts.py` | ✅ |
| `POST /api/runs/{run_id}/optimize/apply` | `web/app.py` | `web/routers/optimize.py` | ✅ |

**45 路由小计 (阶段 1-3 + 4-A)。**

### 阶段 4-B 新增 27 路由

| 路由 | 旧 Flask | 新 FastAPI | 状态 |
|------|----------|------------|------|
| `GET  /api/prompts` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `GET  /api/prompts/grouped` | `web/app.py` | `web/routers/prompts.py` | ✅ 按蜂群分组 |
| `GET  /api/prompts/upgrades` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `POST /api/prompts/upgrades/check` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `GET  /api/prompts/{key}` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `PUT  /api/prompts/{key}` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `GET  /api/prompts/{key}/files` | `web/app.py` | `web/routers/prompts.py` | ✅ 5 文件结构 |
| `PUT  /api/prompts/{key}/files/{filename}` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `POST /api/prompts/{key}/files/{filename}/accept` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `POST /api/prompts/{key}/files/{filename}/reject` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `GET  /api/prompts/{key}/versions` | `web/app.py` | `web/routers/prompts.py` | ✅ |
| `GET  /api/ab-tests` | `web/app.py` | `web/routers/ab_tests.py` | ✅ |
| `GET  /api/ab-tests/{test_id}` | `web/app.py` | `web/routers/ab_tests.py` | ✅ |
| `POST /api/ab-tests` | `web/app.py` | `web/routers/ab_tests.py` | ✅ Pydantic 校验 |
| `GET  /api/requirements` | `web/app.py` | `web/routers/requirements.py` | ✅ |
| `GET  /api/requirements/{req_id}` | `web/app.py` | `web/routers/requirements.py` | ✅ 新增路径穿越防御 |
| `POST /api/requirements/save` | `web/app.py` | `web/routers/requirements.py` | ✅ |
| `GET  /api/cases/pending` | `web/app.py` | `web/routers/cases.py` | ✅ |
| `GET  /api/cases/approved` | `web/app.py` | `web/routers/cases.py` | ✅ |
| `POST /api/cases/{filename}/approve` | `web/app.py` | `web/routers/cases.py` | ✅ |
| `POST /api/cases/{filename}/reject` | `web/app.py` | `web/routers/cases.py` | ✅ Pydantic body |
| `GET  /api/swarm/sessions` | `web/app.py` | `web/routers/swarm.py` | ✅ |
| `GET  /api/swarm/sessions/{session_id}` | `web/app.py` | `web/routers/swarm.py` | ✅ 含 graph 节点+边 |
| `POST /api/swarm/run` | `web/app.py` | `web/routers/swarm.py` | ✅ Pydantic 校验 |
| `GET  /api/swarm/config` | `web/app.py` | `web/routers/swarm.py` | ✅ |
| `GET  /api/swarm/timeline` | `web/app.py` | `web/routers/swarm.py` | ✅ |
| `GET  /api/models` | `web/app.py` | `web/routers/models.py` | ✅ LiteLLM 优先 + 回退 |

**72 路由小计 (阶段 1-3 + 4-A + 4-B)。**

### 阶段 4-C 新增 38 路由

| 路由 | 旧 Flask | 新 FastAPI | 状态 |
|------|----------|------------|------|
| `GET  /api/knowledge/search` | `web/app.py` | `web/routers/knowledge.py` | ✅ Query 必填校验 |
| `GET  /api/knowledge/stats` | `web/app.py` | `web/routers/knowledge.py` | ⚠️ 500 (chromadb 未装) |
| `POST /api/knowledge/index` | `web/app.py` | `web/routers/knowledge.py` | ⛔ K0C legacy writer blocked；固定 409 |
| `GET  /api/knowledge/sources` | `web/app.py` | `web/routers/knowledge.py` | ✅ |
| `GET  /api/knowledge/health` | `web/app.py` | `web/routers/knowledge.py` | ✅ 30s 内存缓存 |
| `POST /api/knowledge/upload` | `web/app.py` | `web/routers/knowledge.py` | ⛔ K0C legacy writer blocked；固定 409 |
| `GET  /api/presets` | `web/app.py` | `web/routers/knowledge.py` | ✅ |
| `GET  /api/memory` | `web/app.py` | `web/routers/memory.py` | ⚠️ 500 (fcntl Windows) |
| `POST /api/memory` | `web/app.py` | `web/routers/memory.py` | ⚠️ 同上 |
| `GET  /api/memory/{filename}` | `web/app.py` | `web/routers/memory.py` | ⚠️ 同上 |
| `PUT  /api/memory/{filename}` | `web/app.py` | `web/routers/memory.py` | ⚠️ 同上 |
| `DELETE /api/memory/{filename}` | `web/app.py` | `web/routers/memory.py` | ⚠️ 同上 |
| `POST /api/memory/search` | `web/app.py` | `web/routers/memory.py` | ⚠️ 同上 |
| `POST /api/memory/rebuild-index` | `web/app.py` | `web/routers/memory.py` | ⚠️ 同上 |
| `GET  /api/memory/stats` | `web/app.py` | `web/routers/memory.py` | ⚠️ 同上 |
| `GET  /api/preferences/{user_id}` | `web/app.py` | `web/routers/preferences.py` | ✅ |
| `POST /api/preferences/{user_id}` | `web/app.py` | `web/routers/preferences.py` | ✅ |
| `POST /api/preferences/{user_id}/corrections` | `web/app.py` | `web/routers/preferences.py` | ✅ |
| `POST /api/preferences/{user_id}/accepted-designs` | `web/app.py` | `web/routers/preferences.py` | ✅ |
| `POST /api/preferences/{user_id}/suggest-flow` | `web/app.py` | `web/routers/preferences.py` | ✅ |
| `GET  /api/critic/run/{run_id}` | `web/app.py` | `web/routers/critic.py` | ✅ run_id 校验 |
| `POST /api/critic/analyze` | `web/app.py` | `web/routers/critic.py` | ✅ |
| `GET  /api/kpi/latency` | `web/app.py` | `web/routers/kpi.py` | ✅ Query 校验 |
| `GET  /api/kpi/slo` | `web/app.py` | `web/routers/kpi.py` | ✅ |
| `GET  /api/kpi/business` | `web/app.py` | `web/routers/kpi.py` | ✅ |
| `POST /api/kpi/business/{run_id}` | `web/app.py` | `web/routers/kpi.py` | ✅ Pydantic 校验 |
| `POST /api/kpi/calibration` | `web/app.py` | `web/routers/kpi.py` | ✅ |
| `GET  /api/kpi/calibration/stats` | `web/app.py` | `web/routers/kpi.py` | ✅ |
| `GET  /api/kpi/regression` | `web/app.py` | `web/routers/kpi.py` | ✅ |
| `GET  /api/agents/registry` | `web/app.py` | `web/routers/agents.py` | ⚠️ 500 (src.agent_communication 缺失) |
| `GET  /api/agents/discover` | `web/app.py` | `web/routers/agents.py` | ⚠️ 同上 |
| `GET  /api/votes/proposals` | `web/app.py` | `web/routers/votes.py` | ⚠️ 同上 |
| `POST /api/votes/proposals` | `web/app.py` | `web/routers/votes.py` | ⚠️ 同上 (但 Pydantic 422 校验仍工作) |
| `POST /api/votes/proposals/{proposal_id}/vote` | `web/app.py` | `web/routers/votes.py` | ⚠️ 同上 |
| `GET  /api/feature-flags` | `web/app.py` | `web/routers/feature_flags.py` | ⚠️ 500 (src.deploy_manager 缺失) |
| `PUT  /api/feature-flags/{name}` | `web/app.py` | `web/routers/feature_flags.py` | ⚠️ 同上 |
| `GET  /api/approval/pending` | `web/app.py` | `web/routers/approval.py` | ⚠️ 500 (src.approval_manager 缺失) |
| `GET  /metrics` | `web/app.py` | `web/routers/metrics.py` | ✅ Prometheus text/plain |

**110 路由小计 (阶段 1-3 + 4-A + 4-B + 4-C)。**

### 阶段 5 新增 15 路由（流式 / 异步 / 会话）

| 路由 | 旧 Flask | 新 FastAPI | 状态 |
|------|----------|------------|------|
| `POST /api/runs/async` | `web/app.py` | `web/routers/runs_stream.py` | ✅ Flow + Swarm 双分支 |
| `GET  /api/runs/stream/{task_id}` | `web/app.py` | `web/routers/runs_stream.py` | ✅ **StreamingResponse + 同步 generator** |
| `GET  /api/runs/stream/{task_id}/status` | `web/app.py` | `web/routers/runs_stream.py` | ✅ |
| `POST /api/runs/stream/{task_id}/approve` | `web/app.py` | `web/routers/runs_stream.py` | ✅ Event 解锁等待中的回调 |
| `POST /api/runs/stream/{task_id}/reject` | `web/app.py` | `web/routers/runs_stream.py` | ✅ |
| `POST /api/runs/stream/{task_id}/openclaw_reply` | `web/app.py` | `web/routers/runs_stream.py` | ✅ 交互+自动循环双模式 |
| `POST /api/runs/stream/{task_id}/openclaw_proceed` | `web/app.py` | `web/routers/runs_stream.py` | ✅ |
| `GET  /api/tasks` | `web/app.py` | `web/routers/tasks.py` | ✅ running+recent 快照 |
| `POST /api/flows/test_step` | `web/app.py` | `web/routers/flows_test.py` | ✅ 共享 task_registry |
| `POST /api/runs/{run_id}/repair/async` | `web/app.py` | `web/routers/repair_async.py` | ✅ |
| `GET  /api/chat/sessions` | `web/app.py` | `web/routers/chat.py` | ✅ |
| `POST /api/chat/sessions` | `web/app.py` | `web/routers/chat.py` | ✅ |
| `GET  /api/chat/sessions/{session_id}` | `web/app.py` | `web/routers/chat.py` | ✅ 旧 turn 自动补 assistant_output |
| `DELETE /api/chat/sessions/{session_id}` | `web/app.py` | `web/routers/chat.py` | ✅ |
| `POST /api/chat/sessions/{session_id}/turns` | `web/app.py` | `web/routers/chat.py` | ✅ **4 类分支 + 槽位填充 + FlowEngine** |

**125 路由小计 (阶段 1-3 + 4-A + 4-B + 4-C + 5)。**

### 阶段 4-D 新增 6 路由（throne 聚合 + OpenAI 兼容）

| 路由 | 旧 Flask | 新 FastAPI | 状态 |
|------|----------|------------|------|
| `GET  /api/throne/overview` | `web/app.py` | `web/routers/throne.py` | ✅ 11 群臣 + 风险 + 经营摘要 + 系统状态 |
| `GET  /api/throne/memorials` | `web/app.py` | `web/routers/throne.py` | ✅ status/dept/priority/q/limit/offset 过滤 |
| `GET  /api/throne/runs/{run_id}` | `web/app.py` | `web/routers/throne.py` | ✅ Memorial + steps + qaResult + fullContent |
| `POST /api/throne/runs/{run_id}/transfer` | `web/app.py` | `web/routers/throne.py` | ✅ 11 部门校验 + 落档 |
| `POST /api/throne/runs/{run_id}/digest` | `web/app.py` | `web/routers/throne.py` | ✅ Markdown 纪要 + case archive 入档 |
| `POST /v1/chat/completions` | `web/app.py` | `web/routers/openai_compat.py` | ✅ Pydantic 校验 + OpenAI 错误格式 |

**总计 131/131 路由已迁移 (100%) 🎉。**

### 阶段 4-D 顺便规范化

1. **`/v1/chat/completions` Pydantic 校验**：旧版手动 `data.get('model')`，新版 422 直接拦截。
2. **OpenAI 错误格式独立 helper**：旧版每个分支重复 `jsonify({"error":{"message":...,"type":...}})`，新版 `_openai_error()` 一次封装。
3. **throne run_id 走 validate_run_id**：旧版无路径穿越防御。
4. **transfer operator 从 `Depends(get_current_user)` 取**：旧版用 `g.user`（Flask 全局），现框架无关。
5. **Memorial 60s 缓存独立到 router 模块**：旧版藏在 web/app.py 全局。

### 阶段 5 核心设计决策

**保留 threading + queue.Queue，不重构为 asyncio**：
- FlowEngine / repair_cycle / 槽位 LLM 调用全部是同步代码
- 它们的 callback 必须能 `.wait()` 阻塞和 `.put()` 推事件
- 切到 `asyncio.Event` 会被迫做"跨线程信号"，复杂度反而更高
- FastAPI `StreamingResponse` 接受同步 generator，会自动 wrap 到 threadpool，event loop 不会被阻塞

**共享状态集中到 `web/task_registry.py`**：
- 旧版散落在 `web/app.py` 顶层全局（`_task_registry`、`_approval_events` 等 7 处）
- 现在抽出 9 个生产者/消费者辅助函数（`register_task` / `mark_status` / `deliver_approval` 等）
- 4 个 router（runs_stream / tasks / flows_test / repair_async / chat）共享同一份单例

**槽位填充集中到 `web/slot_filling.py`**：
- 旧版 4 类 Flow 的 SLOT_ORDER/LABELS/EXTRACT_SYSTEM/CONV_SYSTEM 散落在 web/app.py 540-700 行
- 抽出为模块级常量 + 3 个识别函数（`is_medical_flow` / `is_slot_flow` / `is_ops_flow`）
- 提取 `extract_slots_llm` / `build_conv_history` / `send_appointment_email` / `validate_config_path` 公共函数

**会话存储集中到 `web/session_store.py`**：
- `SESSIONS_DIR` / `load_session` / `save_session` / `list_sessions_meta` / `delete_session`

### 阶段 5 顺便规范化

1. **路径安全校验抽出为 `validate_config_path()`**：旧版在 `/api/runs/async`、`/api/flows/test_step` 重复 3 次，现统一一处。
2. **`OpenClawReplyRequest.message` Pydantic 校验**：旧版用 `request.get_json(silent=True) or {}` 然后人工 400，现 422 自动。
3. **请求体 Pydantic 校验**：`RunAsyncRequest` / `TestStepRequest` / `ChatSessionTurnRequest` 全部带 `min_length=1` 校验。
4. **响应模型 `TasksSnapshot` / `TaskStatusResponse`**：自动 OpenAPI 文档。
5. **`/api/runs/{run_id}/repair/async` 走 `validate_run_id` Depends**：旧版无 run_id 路径穿越防御。

### 阶段 4-C 顺便规范化

1. **memory router 路由顺序**：`search / rebuild-index / stats` 显式先于 `/{filename}` 注册。
2. **延迟导入兼容 Windows**：`src.typed_memory` 顶层 import `fcntl`，必须在 handler 内部 import（与旧 Flask 一致）。
3. **`/metrics` 端点 `include_in_schema=False`**：避免 Prometheus 端点污染 OpenAPI 文档。
4. **`/api/knowledge/search` Query 校验**：旧版 `query = request.args.get('query','')` 空时人工 400；新版 `Query(..., min_length=1)` 直接 422 结构化错误。
5. **`/api/feature-flags/{name}` `roll_percentage` 范围校验**：Pydantic `ge=0.0, le=100.0`，超出范围直接 422，旧版无校验。
6. **`/api/votes/proposals` 必填字段校验**：`proposal_id` 与 `topic` 通过 Pydantic 校验，避免 `data["proposal_id"]` KeyError。

### 阶段 4-B 顺便规范化

1. **路由顺序显式分组**：prompts.py 把静态路由 `/grouped /upgrades /upgrades/check` 放在 `/{key}` 之前，避免被吞掉（旧 Flask 用装饰器顺序碰巧工作，新结构更安全）。
2. **`requirements/{req_id}` 防路径穿越**：新增 `_REQ_ID_RE` 校验，拒绝 `..` / `/` / `\`。
3. **AB 测试参数 Pydantic 校验**：`task / config_a / config_b` 必填，旧版裸字典 `data.get()` 易漏。
4. **swarm/run Pydantic 校验**：`task_input` 必填且非空。
5. **响应类型 `response_model`**：prompts/ab-tests/swarm/cases 均带类型，自动 OpenAPI 文档。

### 阶段 4-A 顺便修复 / 规范化

1. **`/api/compare/export` 不再 hack**：旧版用 `app.test_request_context()` 内部调用 `api_compare()` 取数据，新版抽出 `build_compare_payload()` 直接复用。
2. **Pydantic 校验阈值范围**：repair 的 `max_retries(1-10)` / `min_score(0-5)` / `min_dimension_score(0-5)` 在请求阶段拦截，旧版裸字典无校验。
3. **路径参数防御统一**：所有 `/api/runs/{run_id}/*` 都通过 `Depends(validate_run_id)` 校验，旧版部分端点遗漏。
4. **Query 参数类型校验**：`/api/analytics?days=` 和 `/api/feedback?days=` 自动校验为 int 且限定范围。
5. **未捕获异常变 500 → HTTPException**：旧版裸 `try/except: raise` 会丢失上下文，新版统一返回结构化错误。


## 规范化变更（不破坏前端契约的改动）

1. **`/api/auth/me` 行为修复**：旧版因白名单导致永远返回 `authenticated=false`；新版只要 token 有效就识别用户。
2. **`/api/admin/*` 显式 admin 权限校验**：`FENGQUN_AUTH=true` 时强制 admin 角色，旧版无此校验。
3. **Pydantic 422 错误响应**：缺字段返回结构化错误（含字段路径），优于旧版手写 `{"error": "..."}`。
4. **路径参数校验集中化**：`/api/runs/{run_id}` 系列共用 `Depends(validate_run_id)`，旧版每个 handler 都重复一遍。
5. **路径穿越防御**：`/api/flows/{filename}` 显式拒绝 `..`、`/`、`\`。
6. **自动 OpenAPI 文档**：访问 `/docs` 即得 Swagger UI，CourtOS 集成方再不用手写接口表。

## 启动方式

```bash
# 开发（自动重载）
FENGQUN_RELOAD=true python -m web.main

# 或直接 uvicorn
uvicorn web.main:app --host 127.0.0.1 --port 8081 --reload

# 生产（gunicorn + UvicornWorker）
gunicorn -c gunicorn.conf.py \
    -k uvicorn.workers.UvicornWorker \
    web.main:app
```

旧 Flask 仍可独立启动：`gunicorn -c gunicorn.conf.py web.app:app`，两边互不干扰。

## 剩余工作（阶段 4-B / 4-C / 5 / 6）

| 阶段 | 端点组 | 估算 | 状态 |
|------|--------|------|------|
| **4-A** | runs / steps / feedback / quality / compare / repairs / drafts | 27 路由 | ✅ 完成 |
| **4-B** | prompts / ab-tests / requirements / cases / swarm / models | 27 路由 | ✅ 完成 |
| **4-C** | knowledge / presets / memory / preferences / critic / kpi / agents / votes / feature-flags / approval / metrics | 38 路由 | ✅ 完成 |
| **4-D** | throne (5) + openai_compat (`/v1/chat/completions`) | 6 路由 | ✅ 完成 |
| **5** | runs/async + runs/stream/* + chat/sessions/* + repair/async + flows/test_step + tasks | 15 路由 | ✅ 完成 |
| **6** | tests/test_web_api.py → httpx.AsyncClient；删除 web/app.py + web/voice_api.py + src/auth_middleware.py | 清场 | ⏳ 待启动 |

## 文件结构

```
web/
├── main.py                  # FastAPI app 入口
├── deps.py                  # Depends: get_current_user / try_get_current_user / require_admin / validate_run_id
├── security_mw.py           # ASGI 安全响应头中间件
├── run_utils.py             # 共享: FIELD_THRESHOLDS / compute_run_status / parse_run_meta / run_summary / make_preview / feedback_path / resolve_config_path / flow_semaphore
├── MIGRATION_STATUS.md      # 本文件
├── app.py                   # ⚠️ 旧 Flask（过渡期保留，阶段 6 删除）
├── voice_api.py             # ⚠️ 旧 Flask Blueprint（已被 routers/voice.py 替代，阶段 6 删除）
├── schemas/
│   ├── __init__.py
│   ├── common.py            # StatusResponse / ErrorResponse / IdResponse
│   ├── auth.py              # LoginRequest / LoginResponse / CurrentUser / AuthMeResponse
│   ├── admin.py             # TenantCreateRequest / TenantInfo / UserCreateRequest / UserInfo
│   ├── flows.py             # FlowSummary / FlowCreateRequest / ToolDescription
│   ├── health.py            # HealthResponse
│   ├── voice.py             # VoiceProcessJSONRequest / VoiceProcessResponse / VoiceSession
│   ├── runs.py              # RunFlowRequest / EditFinalOutputRequest / RerunRequest / FeedbackRequest
│   ├── repairs.py           # RepairRequest
│   ├── drafts.py            # DraftRejectRequest / DraftStats / DraftStatusResponse
│   ├── optimize.py          # OptimizeApplyRequest
│   ├── prompts.py           # PromptUpdateRequest / PromptFilesResponse / PromptGroupedResponse
│   ├── ab_tests.py          # ABTestRequest
│   ├── requirements.py      # RequirementSaveRequest / RequirementItem
│   ├── cases.py             # CaseRejectRequest / CaseActionResponse
│   ├── swarm.py             # SwarmRunRequest / SwarmConfigResponse / SwarmSessionSummary
│   ├── knowledge.py         # KnowledgeUploadResponse / KnowledgeSearchResponse
│   ├── memory.py            # MemoryCreateRequest / MemoryUpdateRequest / MemorySearchRequest
│   ├── preferences.py       # PreferenceUpdateRequest / CorrectionRecordRequest / SuggestFlowRequest
│   ├── critic.py            # CriticAnalyzeRequest
│   ├── kpi.py               # BusinessOutcomeRequest / CalibrationRequest
│   ├── agents.py            # AgentInfo
│   ├── votes.py             # ProposalCreateRequest / VoteRequest
│   ├── feature_flags.py     # FeatureFlagUpdateRequest
│   ├── approval.py          # ApprovalNotification
│   ├── streaming.py         # RunAsyncRequest / TestStepRequest / TaskAcceptedResponse / TasksSnapshot
│   ├── chat.py              # ChatSessionCreateRequest / ChatSessionTurnRequest
│   ├── throne.py            # TransferRequest / DigestResponse / OverviewResponse
│   └── openai_compat.py     # ChatCompletionRequest / ChatCompletionResponse
└── routers/
    ├── __init__.py
    ├── health.py
    ├── auth.py
    ├── admin.py
    ├── flows.py
    ├── tools.py
    ├── voice.py
    ├── runs.py              # /api/runs/* + /api/run
    ├── analytics.py         # /api/analytics
    ├── feedback.py          # /api/feedback + /api/runs/{id}/feedback
    ├── compare.py           # /api/compare + /api/compare/quality
    ├── exports.py           # /api/compare/export + /api/runs/{id}/export/*
    ├── repairs.py           # /api/runs/{id}/repair + /api/repairs + /api/repair-insights
    ├── drafts.py            # /api/drafts/*
    ├── optimize.py          # /api/runs/{id}/optimize/apply
    ├── prompts.py           # /api/prompts/* (11 路由)
    ├── ab_tests.py          # /api/ab-tests/*
    ├── requirements.py      # /api/requirements/*
    ├── cases.py             # /api/cases/*
    ├── swarm.py             # /api/swarm/*
    ├── models.py            # /api/models
    ├── knowledge.py         # /api/knowledge/* + /api/presets
    ├── memory.py            # /api/memory/* (8 路由，延迟导入兼容 Windows)
    ├── preferences.py       # /api/preferences/{user_id}/*
    ├── critic.py            # /api/critic/*
    ├── kpi.py               # /api/kpi/*
    ├── agents.py            # /api/agents/*
    ├── votes.py             # /api/votes/*
    ├── feature_flags.py     # /api/feature-flags/*
    ├── approval.py          # /api/approval/*
    ├── metrics.py           # /metrics  (Prometheus text/plain)
    ├── runs_stream.py       # /api/runs/async + /api/runs/stream/{task_id}/* (7 路由)
    ├── tasks.py             # /api/tasks (监控快照)
    ├── flows_test.py        # /api/flows/test_step (单步测试)
    ├── repair_async.py      # /api/runs/{run_id}/repair/async
    ├── chat.py              # /api/chat/sessions/* (5 路由 含复杂 turns)
    ├── throne.py            # /api/throne/* (5 路由 朝堂 OS 前端聚合)
    └── openai_compat.py     # /v1/chat/completions (OpenAI 兼容)
```

阶段 5 新增 3 个共享模块（不在 routers/ 下）：
- `web/task_registry.py` — 异步任务 + 审批 + OpenClaw 共享状态
- `web/session_store.py` — 聊天会话持久化
- `web/slot_filling.py` — 4 类 Flow 槽位常量 + LLM 提取 + validate_config_path

## src/auth_middleware.py 命运

- 阶段 2 已用 `web/deps.py` 完全替代其功能
- 旧 Flask `web/app.py` 仍 `init_auth(app)` 调用它，过渡期不能删
- 阶段 6 完成后删除文件
