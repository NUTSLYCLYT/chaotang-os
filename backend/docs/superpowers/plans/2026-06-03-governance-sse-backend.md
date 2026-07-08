# 三档治理 + SSE 后端强化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给朝堂下旨系统加三档风险治理（低/中/高），低风险自动出动蜂群，中等风险丞相摘要后确认，高风险六部联署逐条批准后才出动。

**Architecture:** 新增 `src/risk_assessor.py` 用 DeepSeek flash (<$0.0003) 在拟旨时并行评估风险等级，将 `stakes` 字段写入 `draft_decree()` 返回值和 SSE 流；`decree/dispatch` 在中/高风险时向 SSE 队列发出 `governance.pause` 事件，前端收到后停止自动派遣并等待 `POST /api/chaotang/decree/{taskId}/proceed` 确认信号；大臣会审完毕后先发 `council.aggregated`，前端展示意见，用户点批准后再触发 group dispatch。

**Tech Stack:** Python 3.12, FastAPI, DeepSeek chat API (直连), queue.Queue SSE, existing `ModelAdapter`

---

## File Map

| File | Change |
|---|---|
| `src/risk_assessor.py` | New — DeepSeek flash 风险评估，返回 `{stakes, reason}` |
| `src/chaotang_orchestrator.py` | Modify — `draft_decree()` 并行调 assessor；`run_chaotang_task()` 在 council 完成后发 `governance.pause` 等待信号 |
| `web/routers/chaotang.py` | Modify — `decree/dispatch` 把 `stakes` 存 task registry；新增 `POST /decree/{taskId}/proceed` 端点 |
| `web/schemas/chaotang.py` | Modify — `DispatchRequest` 加 `stakes` 字段（可选，前端传回） |
| `web/task_registry.py` | Modify — 加 `governance_event` dict，存 proceed 信号用的 Event |
| `tests/test_risk_assessor.py` | New — unit tests |

---

### Task 1: 实现 risk_assessor.py

**Files:**
- Create: `src/risk_assessor.py`
- Create: `tests/test_risk_assessor.py`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_risk_assessor.py
import pytest
from unittest.mock import patch

def test_assess_stakes_low():
    with patch("src.risk_assessor._call_llm", return_value='{"stakes":"low","reason":"市场调研"}'):
        from src.risk_assessor import assess_stakes
        result = assess_stakes("查询竞品价格")
        assert result["stakes"] == "low"
        assert "reason" in result

def test_assess_stakes_high():
    with patch("src.risk_assessor._call_llm", return_value='{"stakes":"high","reason":"合同风险"}'):
        from src.risk_assessor import assess_stakes
        result = assess_stakes("签订1000万合同")
        assert result["stakes"] == "high"

def test_assess_stakes_fallback_on_error():
    with patch("src.risk_assessor._call_llm", side_effect=Exception("network error")):
        from src.risk_assessor import assess_stakes
        result = assess_stakes("任何任务")
        assert result["stakes"] == "medium"  # 保守fallback
        assert "reason" in result
```

- [ ] **Step 2: 运行确认测试失败**

```bash
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
.venv/bin/pytest tests/test_risk_assessor.py -v 2>&1 | tail -10
```
Expected: `ModuleNotFoundError: No module named 'src.risk_assessor'`

- [ ] **Step 3: 实现 risk_assessor.py**

```python
# src/risk_assessor.py
"""三档风险评估：low / medium / high。用 DeepSeek flash 极速判断，<0.2s $0.0003/次。"""
from __future__ import annotations
import json
import os
import re

_SYSTEM = (
    "你是风险评估官。根据任务描述判断风险等级。\n"
    '严格输出JSON: {"stakes":"low"|"medium"|"high","reason":"一句话原因"}\n\n'
    "low:   信息查询/市场调研/内容创作/知识整理/小红书策略/行业分析\n"
    "medium: 产品规划/报价方案/市场策略/选型建议/采购询价/财务分析\n"
    "high:  合同签署/重大财务承诺/PACK研发决策/法律风险/Stage Gate/人事决策"
)


def _call_llm(raw_command: str) -> str:
    from src.model_adapter import ModelAdapter
    adapter = ModelAdapter(
        model="openai/deepseek-chat",
        api_base="https://api.deepseek.com/v1",
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        max_tokens=80,
    )
    res = adapter.call(system_prompt=_SYSTEM, user_prompt=raw_command[:300])
    return res.get("output", "")


def assess_stakes(raw_command: str) -> dict:
    """返回 {"stakes": "low"|"medium"|"high", "reason": str}。失败时保守返回 medium。"""
    try:
        raw = _call_llm(raw_command)
        m = re.search(r"\{[^}]+\}", raw, re.DOTALL)
        if m:
            parsed = json.loads(m.group())
            if parsed.get("stakes") in ("low", "medium", "high"):
                return parsed
    except Exception:
        pass
    return {"stakes": "medium", "reason": "评估失败，保守设为中等风险"}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
.venv/bin/pytest tests/test_risk_assessor.py -v 2>&1 | tail -8
```
Expected: `3 passed`

- [ ] **Step 5: 提交**

```bash
git add src/risk_assessor.py tests/test_risk_assessor.py
git commit -m "feat(governance): add risk_assessor with three-tier stakes assessment"
```

---

### Task 2: task_registry 加 governance Event

**Files:**
- Modify: `web/task_registry.py`

- [ ] **Step 1: 读文件找注册函数**

```bash
grep -n "def register_task\|_approval_events\|governance" web/task_registry.py | head -15
```

- [ ] **Step 2: 加 governance event 存储**

在 `web/task_registry.py` 顶部全局字典区追加：

```python
# governance proceed signals — keyed by task_id
_governance_events: dict[str, threading.Event] = {}

def create_governance_event(task_id: str) -> threading.Event:
    ev = threading.Event()
    _governance_events[task_id] = ev
    return ev

def resolve_governance_event(task_id: str) -> bool:
    """Set the event (proceed signal). Returns True if event existed."""
    ev = _governance_events.pop(task_id, None)
    if ev:
        ev.set()
        return True
    return False

def get_governance_event(task_id: str) -> "threading.Event | None":
    return _governance_events.get(task_id)
```

确保 `import threading` 在文件顶部（已有则跳过）。

- [ ] **Step 3: 验证导入**

```bash
.venv/bin/python3 -c "from web.task_registry import create_governance_event, resolve_governance_event; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: 提交**

```bash
git add web/task_registry.py
git commit -m "feat(governance): add governance proceed event to task_registry"
```

---

### Task 3: orchestrator 集成风险评估 + pause gate

**Files:**
- Modify: `src/chaotang_orchestrator.py`

- [ ] **Step 1: 在 draft_decree() 里并行调 assess_stakes**

找到 `draft_decree()` 函数末尾的 `return {` 块（约第 116 行），在 `categories` 列表构建前加并行评估：

```python
# 在 draft_decree() 函数中，citations = _kb_search(...) 之后加：
import concurrent.futures as _cf

def draft_decree(raw_command: str) -> dict:
    with _cf.ThreadPoolExecutor(max_workers=2) as pool:
        citations_future = pool.submit(_kb_search, raw_command)
        stakes_future = pool.submit(_assess_stakes_safe, raw_command)
        citations = citations_future.result()
        stakes_result = stakes_future.result()
    # ... 后续原有逻辑不变 ...
    return {
        "draft": draft_text,
        "intent": intent,
        "recommendedCategories": categories,
        "source": source,
        "stakes": stakes_result.get("stakes", "medium"),
        "stakesReason": stakes_result.get("reason", ""),
    }
```

在文件顶部加辅助函数：

```python
def _assess_stakes_safe(raw_command: str) -> dict:
    try:
        from src.risk_assessor import assess_stakes
        return assess_stakes(raw_command)
    except Exception:
        return {"stakes": "medium", "reason": "评估不可用"}
```

- [ ] **Step 2: 在 run_chaotang_task() 里加 pause gate**

找到 `run_chaotang_task()` 中 `ok_groups: list[str] = []` 附近，在 council 全部完成后（`council.aggregated` 事件发出后）插入 pause 逻辑：

在 `forward()` 函数的 `council.aggregated` 处理块后面，找到实际调用 `FlowEngine.run()` 的位置，改为：

```python
# run_chaotang_task 参数加 stakes: str = "low"
def run_chaotang_task(
    task_id: str,
    q,
    *,
    flow_path: str,
    task_input: str = "",
    budget_max_calls: int = 80,
    min_success_groups: int = 1,
    stakes: str = "low",          # 新增
) -> None:
```

在 `FlowEngine(flow_path).run(...)` 调用前（约 council steps 执行完毕后，groups 开始前），插入：

```python
    # governance pause gate — medium/high risk 等待前端确认
    if stakes in ("medium", "high"):
        from web.task_registry import create_governance_event
        gov_event = create_governance_event(task_id)
        q.put({
            "type": "governance.pause",
            "stakes": stakes,
            "message": "丞相已完成会审，等待批准出动蜂群",
            "requiresApproval": True,
        })
        proceeded = gov_event.wait(timeout=300)   # 5分钟超时
        if not proceeded:
            q.put({"type": "error", "message": "治理审批超时，任务取消"})
            return
        q.put({"type": "governance.approved", "stakes": stakes})
```

> **实现位置说明**：当前 `run_chaotang_task` 把整个 DAG（council + groups）装在一个 FlowEngine 里跑，没有显式的 council/group 分界点可以 pause。正确做法是在 `assemble_flow()` 生成的 YAML 里，把 council steps 和 group dispatch steps 分成两个阶段，council 完成后发 pause，等 proceed 再继续。
>
> **简化实现（当前迭代）**：在 `run_chaotang_task` 的函数开头、FlowEngine.run() 调用之前先发 pause，等用户确认，再开始整个 flow。Council 内容通过 `decree/draft` 已经展示给用户（categories + 大臣意见摘要），这一轮先做到这个级别。

实际插入位置（在 `FlowEngine` 调用之前）：

```python
    # --- governance gate（在 FlowEngine.run 之前）---
    if stakes in ("medium", "high"):
        from web.task_registry import create_governance_event
        gov_event = create_governance_event(task_id)
        q.put({
            "type": "governance.pause",
            "stakes": stakes,
            "message": "丞相已分析完毕，请批准出动蜂群",
            "requiresApproval": True,
        })
        if not gov_event.wait(timeout=300):
            q.put({"type": "error", "message": "治理审批超时（5分钟），任务已取消"})
            return
        q.put({"type": "governance.approved", "stakes": stakes})
    # --- end governance gate ---
```

- [ ] **Step 3: 把 stakes 从 dispatch 传入 _spawn_run**

在 `web/routers/chaotang.py` 的 `decree_dispatch()` 里，找到 `_spawn_run(task_id, q, flow_path, ...)` 调用，把 `stakes` 传入：

```python
# 在 decree_dispatch 里，从 body 里取 stakes（前端 POST body 里带回）
stakes = getattr(body, "stakes", "low") or "low"

_spawn_run(task_id, q, flow_path, budget_calls, 1, body.rawCommand, stakes=stakes)
```

找到 `_spawn_run` 函数定义，加 `stakes` 参数并传给 `run_chaotang_task`：

```python
def _spawn_run(task_id, q, flow_path, budget_calls, min_groups, task_input, stakes="low"):
    def _run():
        try:
            run_chaotang_task(
                task_id, q,
                flow_path=flow_path,
                task_input=task_input,
                budget_max_calls=budget_calls,
                min_success_groups=min_groups,
                stakes=stakes,
            )
        except Exception as e:
            q.put({"type": "error", "message": str(e)})
    threading.Thread(target=_run, daemon=True).start()
```

- [ ] **Step 4: 加 DispatchRequest.stakes 字段**

```bash
grep -n "stakes\|class DispatchRequest" web/schemas/chaotang.py | head -10
```

在 `DispatchRequest` Pydantic model 里加：

```python
stakes: str = "low"   # "low" | "medium" | "high"
```

- [ ] **Step 5: 快速集成测试**

```bash
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
source .env && export $(cat .env | grep -v "^#" | xargs)
source /home/ubuntu/.openclaw/.env 2>/dev/null
.venv/bin/python3 -c "
import sys; sys.path.insert(0,'.')
from src.chaotang_orchestrator import draft_decree
r = draft_decree('分析低温PACK市场机会')
print('stakes:', r.get('stakes'))
print('stakesReason:', r.get('stakesReason'))
print('intent:', r.get('intent'))
" 2>&1 | grep -v "LiteLLM\|litellm\|Removing\|checking\|Error getting\|ZHIPU"
```
Expected: `stakes: low` 或 `stakes: medium`，无报错

- [ ] **Step 6: 提交**

```bash
git add src/chaotang_orchestrator.py web/schemas/chaotang.py web/routers/chaotang.py
git commit -m "feat(governance): integrate stakes assessment and pause gate into orchestrator"
```

---

### Task 4: 新增 proceed 端点

**Files:**
- Modify: `web/routers/chaotang.py`

- [ ] **Step 1: 加端点**

在 `web/routers/chaotang.py` 末尾（或 `/stream` 端点之后）加：

```python
@router.post("/decree/{task_id}/proceed")
def decree_proceed(task_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    """前端用户批准出动蜂群 — 释放 governance pause gate。"""
    if not _validate_id(task_id):
        raise HTTPException(status_code=400, detail="无效 task_id")
    from web.task_registry import resolve_governance_event
    ok = resolve_governance_event(task_id)
    if not ok:
        return fail(f"task {task_id} 无待批准的治理事件（可能已超时或不需审批）")
    return ok({"proceeded": True, "taskId": task_id})
```

> 注意：`web/routers/_envelope.py` 里的 `ok()` 和 `fail()` 已导入，直接用。

- [ ] **Step 2: 测试端点可访问**

启动后（uvicorn 已在 :8081 跑）：

```bash
curl -s --noproxy 127.0.0.1,localhost \
  -X POST http://127.0.0.1:8081/api/chaotang/decree/nonexistent_id/proceed \
  2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"
```
Expected: `{'success': False, 'error': 'task nonexistent_id 无待批准...'}`

- [ ] **Step 3: 提交**

```bash
git add web/routers/chaotang.py
git commit -m "feat(governance): add POST /decree/{taskId}/proceed endpoint"
```

---

### Task 5: draft_decree API 响应带 stakes 字段

**Files:**
- Modify: `web/routers/chaotang.py`

- [ ] **Step 1: 找 decree/draft 端点返回**

```bash
grep -n "decree/draft\|draft_decree\|recommendedCategories" web/routers/chaotang.py | head -10
```

- [ ] **Step 2: 确认 stakes 在响应里**

找到 `decree_draft` 端点的 return 语句，确认它透传了 `draft_decree()` 的完整结果：

```python
@router.post("/decree/draft")
def decree_draft(body: DraftRequest, _: CurrentUser = Depends(get_current_user)) -> dict:
    from src.chaotang_orchestrator import draft_decree
    result = draft_decree(body.rawCommand)
    # result 现在含 stakes + stakesReason，直接返回全量
    return ok(result)
```

如果当前代码只返回部分字段，补充完整（把 `result` 整体作为 `ok()` 的参数）。

- [ ] **Step 3: 端对端验证**

```bash
curl -s --noproxy 127.0.0.1,localhost \
  -X POST http://127.0.0.1:8081/api/chaotang/decree/draft \
  -H "Content-Type: application/json" \
  -d '{"rawCommand":"签一份1000万的储能合同"}' \
  2>/dev/null | python3 -c "
import sys,json; d=json.load(sys.stdin)
data = d.get('data',{})
print('stakes:', data.get('stakes'))
print('reason:', data.get('stakesReason'))
print('categories:', len(data.get('recommendedCategories',[])))
"
```
Expected: `stakes: high`

- [ ] **Step 4: 提交**

```bash
git add web/routers/chaotang.py
git commit -m "feat(governance): expose stakes in decree/draft API response"
```

---

### Task 6: SSE 事件类型校验（smoke test）

**Files:**
- No new files — integration test

- [ ] **Step 1: 端对端 governance.pause 冒烟测试（low stakes，不会 pause）**

```bash
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
source .env && export $(cat .env | grep -v "^#" | xargs)
source /home/ubuntu/.openclaw/.env 2>/dev/null

# 派发一个低风险任务（不会触发 pause）
TASK=$(curl -s --noproxy 127.0.0.1,localhost \
  -X POST http://127.0.0.1:8081/api/chaotang/decree/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "rawCommand":"查询低温电池市场行情",
    "intent":"市场调研",
    "stakes":"low",
    "councilAll":false,
    "selectedCategories":[{
      "id":"cat_test","label":"情报","description":"市调","taskType":"intel",
      "ministers":["jin_yi_wei"],"groups":["intel"],"confidence":0.8,"citations":[]
    }]
  }' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('taskId','ERR'))")

echo "taskId: $TASK"
sleep 3
curl -s --noproxy 127.0.0.1,localhost \
  "http://127.0.0.1:8081/api/chaotang/tasks/$TASK" 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('status:', d.get('data',{}).get('task',{}).get('status'))"
```
Expected: taskId 不是 ERR，status 是 running 或 report_ready

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "test(governance): add smoke test for three-tier governance pipeline"
```

---

## 验收标准

1. `assess_stakes("查市场行情")` → `stakes: low`（无 LLM 调用延迟超 1 秒）
2. `assess_stakes("签合同")` → `stakes: high`
3. `draft_decree()` 返回值包含 `stakes` 和 `stakesReason` 字段
4. `GET /api/chaotang/decree/draft` 响应里有 `stakes` 字段
5. 派发 `stakes=medium` 任务后，SSE 流收到 `governance.pause` 事件
6. `POST /api/chaotang/decree/{taskId}/proceed` 释放 pause，SSE 继续发 `governance.approved`
7. 派发 `stakes=low` 任务，SSE 流**不出现** `governance.pause`，直接执行
