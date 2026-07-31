# Exact Accounting Decree Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将财务报表旨意精确锁定为户部会计司单部门路径，并消除旧进程与伪造执行图造成的假绿。

**Architecture:** 已批准路由仍是正式执行的唯一部门事实源。六部层为财务报表意图增加精确司集合约束并绕过锦衣卫证据调查；HTTP 边界根据批准路由和财务意图校验完整处理路径。真实跨层测试使用实际正式图验证路径和 Excel 交付。

**Tech Stack:** Python 3.14、FastAPI、LangGraph、Pydantic、pytest、openpyxl、PowerShell

## Global Constraints

- 遵守 ADR 0028：单部门不经军机处，保留丞相首末节点与部级补充。
- 用户完整原旨意的业务承办单位恰好为户部和会计司。
- 不修改原始财务数据，不扩大外部访问或 Git 权限。
- 所有生产行为修改必须先有可观察的失败测试。

---

### Task 1: 精确司级选择与无调查执行

**Files:**
- Modify: `backend/tests/test_ministries_agent.py`
- Modify: `backend/app/agents/ministries/agent.py`

**Interfaces:**
- Consumes: `detect_accounting_report_intent(decree_text).requested`
- Produces: `invoke_ministry_agent(...)` 对财务报表仅执行 `required_bureaus`

- [x] **Step 1: 写失败测试**

增加模型先后返回 `["会计司", "审计司"]` 的测试，断言第二次仍含额外司时在任何司调用前抛出 `MinistryAgentInvocationError`；增加一次纠正为仅会计司的成功测试，并断言传给会计司的 `evidence_session` 为 `None`。

- [x] **Step 2: 验证测试按预期失败**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_ministries_agent.py -q`

Expected: FAIL，现有实现允许额外审计司或向会计司传递证据会话。

- [x] **Step 3: 最小实现**

在 `invoke_ministry_agent` 中识别户部财务报表意图，将选择条件从 required subset 改为 selected list 精确等于 required list；纠正提示仍不回显模型原文。调用会计司确定性报表路径时不传 `evidence_session`。

- [x] **Step 4: 验证绿色**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_ministries_agent.py -q`

Expected: PASS。

### Task 2: 正式 API 完整路径防线

**Files:**
- Modify: `backend/tests/test_decrees_api.py`
- Modify: `backend/app/api/decrees.py`

**Interfaces:**
- Consumes: `ApprovedRouteSnapshot`、`decree_text`、正式图结果
- Produces: 与批准路由一致的 `ChancellorDecreeResponse`

- [x] **Step 1: 写失败测试**

为已批准户部/会计司结果分别注入军机处、礼部、工部、锦衣卫和额外户部司，断言 HTTP 502 且归档次数为零。

- [x] **Step 2: 验证测试按预期失败**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_decrees_api.py -q`

Expected: FAIL，当前边界只检查处理路径是非空字符串数组及必选司为子集。

- [x] **Step 3: 最小实现**

将 `decree_text` 传入响应构建边界。财务报表意图要求实际司列表恰好等于批准司列表，并要求完整处理路径精确等于 `上书房、丞相（首次分流）、户部、户部·会计司、户部（部级补充）、丞相（最终汇总）`。

- [x] **Step 4: 验证绿色**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_decrees_api.py -q`

Expected: PASS。

### Task 3: 真实财务链路回归

**Files:**
- Modify: `backend/tests/test_accounting_report_cross_layer.py`
- Modify: `backend/tests/synthetic_accounting_acceptance_app.py`

**Interfaces:**
- Consumes: 真实 `DraftAuthorityRegistry`、`build_chancellor_graph` 和报表会话
- Produces: 可下载 Excel 与精确处理路径证据

- [x] **Step 1: 收紧真实链断言**

使用用户完整原旨意，断言精确处理路径、`single`、仅户部/会计司、无 council verdict、无军机处案卷、Excel 可下载。

- [x] **Step 2: 移除验收假图**

合成验收应用不得再把 `get_chancellor_graph` 替换为 `_AccountingGraph`；只允许注入离线模型和合成总账数据。

- [x] **Step 3: 运行跨层测试**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_accounting_report_cross_layer.py -q`

Expected: PASS。

### Task 4: 失败记忆与运行态验证

**Files:**
- Modify: `docs/failures/2026-07-30-draft-execution-route-drift.md`
- Test: existing harness and live backend

**Interfaces:**
- Consumes: 当前监听进程启动时间、工作区源码修改时间
- Produces: 可复核的防旧进程步骤

- [x] **Step 1: 记录旧进程根因和检测方式**

补充“测试新源码但运行旧进程”的根因、真实双 API/完整路径断言和启动时间核对。

- [x] **Step 2: 运行完整验证**

Run backend pytest + Ruff；frontend test/typecheck/lint/build；四条 harness；`git diff --check`；核对 8000 监听进程启动时间晚于本次实现。

Expected: 所有命令退出码 0，真实路径精确且无禁止节点。
