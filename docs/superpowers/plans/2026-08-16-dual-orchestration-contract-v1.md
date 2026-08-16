# Dual Orchestration Contract V1 Plan

## 1. Contract

- Task：`DUAL-ORCHESTRATION-CONTRACT-V1-20260816`
- Base/tree：`9283375334fa22a0396a5f7f976a296eba5c559f` /
  `995a615426bcbe457f2553e6f209ec6875810a70`
- Reapproval：前次批准随六部 readiness provenance 前向修复链落地主线而失效；只重钉基线身份，
  不改变 task、6 条产品路径、非目标、合同设计或验证矩阵。
- Shared source：`origin/ext-dev`。
- Product candidate：approval commit 的精确单亲子，只允许任务文件中的 6 个产品路径。
- Exit：公共合同和 24 案例存在但没有运行时接线；Direct/Graph adapter 均未实现。

## 2. State and Ownership

公共状态只表达：

```text
request identity -> execution plan -> ordered event/checkpoint -> terminal result/failure
```

- Owner 是唯一产品 governor；客户端不得提供或切换 owner。
- 公共合同绑定 `owner_user_id`、`run_id`、`decree_id`、输入 digest 和资源 manifest digest。
- `engine_kind` 仅允许 `DIRECT`/`LANGGRAPH`；`engine_version` 使用语义版本。
- `engine_state_ref` 是不透明引用；公共层不得读取 LangGraph checkpoint 或 Direct 私有状态。
- 公共终态只保存 refs/digests，不保存模型 trace、密钥、HTTP 响应或数据库连接。

## 3. RED to GREEN

1. RED：`backend.app.orchestration` 不存在；测试导入失败。
2. GREEN：最小 frozen/closed models 与 `OrchestrationEngine` Protocol。
3. RED：缺 24 案例、分类错误、重复 ID、未排序、资源 digest 漂移、synthetic=false。
4. GREEN：单文件 versioned dataset，8/8/4/4 精确分类与稳定顺序。
5. RED：成功结果缺三条建议、非法 single/multi、跨 owner、重复 side effect 或 reply_count != 1。
6. GREEN：合同校验失败关闭；不增加任何运行时 import/call site。
7. Regress：专项 pytest、ruff、全量 pytest、M0 authority 与根 Harness。

## 4. Dataset Shape

每例至少包含：

```text
case_id, category, synthetic, decree_text, owner_ref, route,
resource_manifest_digest, provider_budget, expected_invariants,
failure_injection, expected_terminal_state
```

- 8 single：覆盖六部、无明确路由兜底、证据充分/不足。
- 8 multi：覆盖两部至六部，严格按批准顺序串行；不得 fan-out。
- 4 recovery：超时、可重试 Provider、checkpoint 恢复、终态后重放。
- 4 security：跨 owner、篡改 digest、缺 adopted evidence、重复归档副作用。
- 案例只定义输入和不变量，不预写模型正文，不把 synthetic 当真实 Outcome。

## 5. Future Parallel Tracks

本任务通过后才可各自创建独立 approval：

```text
feature/<id>-direct       -> Direct adapter paths only
feature/<id>-langgraph    -> LangGraph adapter paths only
```

两条线不得同时修改公共合同、共享 fixtures、业务模型、API、前端、素材、史馆或 Evidence Spine。
若公共合同需要变化，停止两条 adapter 线，先由单一 contract task 修改并重新冻结 dataset digest。

## 6. Proof Matrix

```bash
cd backend && /usr/bin/python3 -m pytest -q \
  tests/test_orchestration_contracts.py \
  tests/test_orchestration_comparison_cases.py
cd backend && /usr/bin/python3 -m ruff check \
  app/orchestration \
  tests/test_orchestration_contracts.py \
  tests/test_orchestration_comparison_cases.py
cd backend && /usr/bin/python3 -m pytest -q
node --test scripts/product-authority.test.mjs
node scripts/check_harness.mjs
```

所有命令必须离线，测试写入只允许 `tmp_path`。本任务没有浏览器或真实 Provider 验收。

## 7. Stop and Rollback

立即 STOP：approval 非 GO、远端离开 approval commit、产品路径扩大、共享业务行为改变、测试访问
公网/真实数据库、ADR 0028 不变量无法表达、24 案例不足以区分公共与引擎私有状态。

回滚：revert 单一产品候选；approval commit 只保留审计事实，不授权第二个 child。
