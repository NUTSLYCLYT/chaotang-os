# 军机处私有案卷总台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让下旨者在军机处查询自己跨部会审案卷的真实进行状态与最终史馆回奏。

**Architecture:** 新增独立的 `app.junjichu_cases` SQLite 窄域，保存多部门会审案卷、真实检查点和唯一 `REPLY` 关联。丞相图通过注入的生命周期观察器写入检查点，保持既有同步串行执行与 HTTP 成功响应不变；FastAPI 和 Next.js BFF 只按当前认证会话读取案卷。

**Tech Stack:** Python 3.11、FastAPI、Pydantic、sqlite3、Next.js App Router、React、TypeScript、node:test、pytest。

## Global Constraints

- 仅 `multi` 路径创建案卷；`single` 永不进入军机处台账。
- 下旨仍是唯一写入入口；军机处页面、BFF 和 API 都不提供采纳、派发、补证或调查写入。
- `owner_user_id` 仅从 `CurrentUser` 获取；浏览器请求和 BFF 查询参数均不得携带 owner。
- 继续串行调用各部，不引入队列、并发、流式响应或 LangGraph checkpointer。
- 史馆仍仅生成一条 `REPLY`；案卷只关联 `reply_id`，不复制归档正文或证据。
- 全部测试使用临时 SQLite 和假模型；不得触发真实模型、外网或运行态数据库。

---

### Task 1: 建立私有案卷领域与 SQLite 存储

**Files:**
- Create: `backend/app/junjichu_cases/models.py`
- Create: `backend/app/junjichu_cases/storage.py`
- Create: `backend/app/junjichu_cases/__init__.py`
- Test: `backend/tests/test_junjichu_case_storage.py`

**Interfaces:**
- Produces `JunjichuCaseStatus = Literal["MINISTRY_REVIEWING", "COUNCIL_REVIEWING", "CHANCELLOR_FINALIZING", "ARCHIVED", "FAILED"]`.
- Produces `open_case(...)`, `record_checkpoint(...)`, `archive_case(...)`, `fail_case(...)`, `list_cases(owner_user_id, ...)` and `get_case(case_id, owner_user_id)`.

- [ ] **Step 1: 写失败测试**：覆盖跨用户查询返回空、状态倒退被拒绝、`single` 案卷不能构造、`reply_id` 只允许在 `ARCHIVED`、失败记录只保存固定脱敏原因。

```python
def test_list_cases_is_scoped_to_owner(tmp_path):
    case = storage.open_case(_multi_input(), owner_user_id="owner-a", db_path=tmp_path / "cases.sqlite3")
    assert storage.list_cases(owner_user_id="owner-b", db_path=tmp_path / "cases.sqlite3") == []
    assert storage.list_cases(owner_user_id="owner-a", db_path=tmp_path / "cases.sqlite3")[0].id == case.id
```

- [ ] **Step 2: 运行失败测试**：`backend/.venv/Scripts/python.exe -m pytest backend/tests/test_junjichu_case_storage.py -q`，预期因模块不存在而失败。
- [ ] **Step 3: 最小实现**：使用独立 `backend/data/junjichu_cases.sqlite3`、每次操作独立连接和 WAL；表包含 `id`、`owner_user_id`、原始旨意快照、部门 JSON、状态、处理路径 JSON、已完成部议 JSON、`council_verdict`、`reply_id`、`failure_reason`、创建/更新时间。所有查询 SQL 必须带 `owner_user_id = ?`。
- [ ] **Step 4: 验证**：重跑该测试，预期 PASS；再运行 `backend/.venv/Scripts/python.exe -m ruff check app/junjichu_cases tests/test_junjichu_case_storage.py`。

### Task 2: 在丞相多部门链路写入真实检查点

**Files:**
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: `backend/app/agents/junjichu/agent.py`
- Modify: `backend/app/api/decrees.py`
- Test: `backend/tests/test_chancellor_graph.py`
- Test: `backend/tests/test_decrees_api.py`

**Interfaces:**
- Consumes Task 1 的 `open_case`、`record_checkpoint`、`archive_case`、`fail_case`。
- Produces可选的 `CaseLifecycleObserver`；未注入时图的现有返回值和行为完全不变。

- [ ] **Step 1: 写失败测试**：注入记录器并断言 `multi` 顺序为创建 `MINISTRY_REVIEWING` → 每部完成时追加已完成部议 → `COUNCIL_REVIEWING` → `CHANCELLOR_FINALIZING`；`single` 无记录器调用；任一异常后写入 `FAILED` 且不泄露异常文本。
- [ ] **Step 2: 运行失败测试**：`backend/.venv/Scripts/python.exe -m pytest backend/tests/test_chancellor_graph.py backend/tests/test_decrees_api.py -q`，预期新断言失败。
- [ ] **Step 3: 最小实现**：为 `build_chancellor_graph` 和 `run_junjichu_council` 增加仅供注入的观察器；观察器只接收已验证的路由、部门顺序、部议、会审结论与处理路径。`submit_decree` 以 `current_user.id` 创建存储观察器，归档成功后用 `ArchiveDecreeResult.reply_id` 调用 `archive_case`；图或归档失败时写固定原因 `processing_failed` 后按既有 502/503 错误链继续抛出。
- [ ] **Step 4: 验证**：重跑两个测试文件，预期 PASS；确认既有 `test_decrees_api.py` 的 422 场景仍不构建图或创建案卷。

### Task 3: 暴露所有者隔离的只读 API 与 BFF

**Files:**
- Create: `backend/app/api/junjichu_cases.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_junjichu_cases_api.py`
- Create: `frontend/src/app/api/junjichu/cases/route.ts`
- Create: `frontend/src/app/api/junjichu/cases/route.test.ts`
- Modify: `frontend/src/lib/backendClient.ts`
- Test: `frontend/src/lib/backendClient.test.ts`

**Interfaces:**
- Produces `GET /api/v1/junjichu/cases` 和 `GET /api/v1/junjichu/cases/{case_id}`，均从 `CurrentUser` 读取 owner。
- Produces同源 `GET /api/junjichu/cases`，只转发会话，不接受 owner 参数。

- [ ] **Step 1: 写失败测试**：后端验证无会话 401、不同用户读取同一 ID 为 404、状态/部门/关键词筛选只作用于自己的案卷；前端 BFF 验证缺会话 401、未知查询字段 400、后端错误被映射为既有脱敏响应。
- [ ] **Step 2: 运行失败测试**：分别执行 `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_junjichu_cases_api.py -q` 与 `cd frontend; npm test -- --test-name-pattern=junjichu`，预期失败。
- [ ] **Step 3: 最小实现**：Pydantic 响应仅包含台账允许字段；按 `updated_at DESC, id ASC` 返回。BFF 使用 `readSessionId` 与服务端 `backendClient`，不暴露后端地址、会话或 owner；浏览器契约将案卷与历史 `ReplyCaseView` 分离，避免把 `REPLY` 缺失的进行中案卷解码失败。
- [ ] **Step 4: 验证**：运行两个新增测试文件，预期 PASS；确认 API 不存在 POST/PATCH/DELETE 路由。

### Task 4: 实现会审主舞台状态投影

**Files:**
- Modify: `frontend/src/features/junjichu-visual/junjichuController.ts`
- Modify: `frontend/src/features/junjichu-visual/JunjichuClient.tsx`
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.tsx`
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.module.css`
- Test: `frontend/src/features/junjichu-visual/junjichuController.test.ts`
- Test: `frontend/src/features/junjichu-visual/JunjichuScene.test.ts`

**Interfaces:**
- Consumes `GET /api/junjichu/cases` 的 `{ status: "ok", cases: JunjichuCaseView[] }`。
- Produces `JunjichuControllerState`，包含案卷筛选、选中案卷、加载/空/错误状态，不包含 owner 或伪操作。

- [ ] **Step 1: 写失败测试**：断言进行中案卷排在归档前，状态/部门/关键词筛选保持选择一致；未完成席位显示等待；归档案卷只在有 `reply_id` 时显示史馆入口；页面源码不含采纳、驳回、补证、派发按钮或 owner 字段。
- [ ] **Step 2: 运行失败测试**：`cd frontend; npm test -- --test-name-pattern="junjichu"`，预期新断言失败。
- [ ] **Step 3: 最小实现**：替换仅查询 `REPLY_ARCHIVES_URL` 的控制器为案卷 BFF；左栏显示案卷、状态和更新时间，中央显示真实处理路径与当前节点，右栏以六部固定目录投影“未参与/办理中/已完成”。归档时显示军机处结论、丞相回奏摘要和史馆链接；进行中时不显示未来意见。
- [ ] **Step 4: 验证**：重跑上述测试，预期 PASS；在 320px、768px、1440px 下确认三栏按现有 CSS 断点折叠且主要内容仍可读。

### Task 5: 完成跨端回归和文档证据

**Files:**
- Modify: `docs/product/tasks/2026-07-28-owner-scoped-junjichu-case-ledger.md`
- Modify: `ARCHITECTURE.md`（仅在实现与 ADR 0029 一致后更新当前事实）
- Test: `backend/tests/test_junjichu_case_storage.py`
- Test: `backend/tests/test_junjichu_cases_api.py`

- [ ] **Step 1: 补充端到端离线测试**：用两个假用户和注入图响应，验证 multi 在处理时可查询、成功后关联一个 `REPLY`、失败时脱敏、single 不创建案卷。
- [ ] **Step 2: 运行后端质量门**：`cd backend; .venv\Scripts\python.exe -m ruff check .; .venv\Scripts\python.exe -m pytest -q`，预期 PASS。
- [ ] **Step 3: 运行前端质量门**：`cd frontend; npm run lint; npm run typecheck; npm test; npm run build`，预期 PASS。
- [ ] **Step 4: 运行仓库校验**：`node scripts/check_harness.mjs; node scripts/check_harness.mjs --self-test; node .agents/hooks/check-harness.mjs --self-test`，预期 PASS。
- [ ] **Step 5: 填写交付证据**：在产品任务的 Implementation Report 逐项记录实际命令、PASS/FAIL、未运行项与剩余风险；只有全部验收项有新鲜证据后才改为 `Implemented`。

## Self-Review

- 覆盖：Task 1–2 实现私有中间状态与真实检查点；Task 3 保障跨用户隔离；Task 4 实现 B 主舞台；Task 5 覆盖归档关联、单部门排除和全部质量门。
- 一致性：状态名、`reply_id` 语义和仅 `multi` 创建规则在任务间一致。
- 范围：未引入异步队列、通用任务系统、旧 dev 代码或新业务入口。
