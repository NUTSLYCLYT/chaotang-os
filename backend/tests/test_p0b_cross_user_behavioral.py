"""P0-B 跨用户行为门(2026-07-14)——归属校验的唯一权威验证方式。

计数棘轮(test_p0b_ownership_ratchet.py)只能挡"新增裸查",验证不了归属:
修复是在裸查后面加 user_id 校验,计数不变;删掉 jinyiwei 已有的校验,
计数也不变。归属只能用行为验证:种一个属于别人的任务,用当前身份访问,
必须被拒绝。

## 门的定义(2026-07-14 二次纠正)

初版把"P0-B 清零"定义成"本文件 xfail 数 == 0",这是错的、而且危险:
初版只写了 1 条测试(还当场修好了),另外 8 处漏洞一条测试都没有——
按那个定义,xfail 数当天就是 0,门会宣布"P0-B 已清零",而 8 个端点
大开。**没有测试 ≠ 没有漏洞。** 这正是它本该防止的假绿。

现在的定义,两条同时成立才算清零:
1. `_ATTACK_SURFACE` 枚举全部"接受调用方传入的 task/brief id 并据此
   读写 DecisionTask"的端点(即真实跨用户攻击面);
2. 每个攻击面端点都有一条本文件里的行为测试(覆盖率门
   `test_every_attack_surface_endpoint_has_a_probe` 强制),且
   `xfail` 数 == 0(全部通过 = 全部拒绝跨用户访问)。

## 还债留痕机制

未修端点用 `strict=True` xfail 实证漏洞在案:修好后 XPASS 会让测试
**失败**,强制修复者删掉标记;此后谁删掉校验,测试(已无标记)直接红。
2026-07-14 已用 tasks/{id}/status 实测验证该机制真的能看见修复。

## 不在攻击面内(已核实,勿误加)

- `research-budget-loop`(shangshufang.py:2358):读回的是它自己刚用
  `make_id("budget", ..., _user_id(user), ...)` 创建的 task,id 不由调用方
  提供,不构成跨用户攻击面。
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from web.main import app

client = TestClient(app)

# ---------------------------------------------------------------------------
# 攻击面:从代码 AST 推导,不手工维护
# ---------------------------------------------------------------------------
# 2026-07-14 三次纠正:上一版的攻击面是一个手写 set,而覆盖率门拿这个 set 去
# 对照本文件的函数——两边都由我维护,是循环论证:新增一个有漏洞的端点、忘了
# 往 set 里加,门照样全绿。这跟被我批过的"文档清单天生腐烂"是同一个病。
#
# 现在攻击面**从 router 源码 AST 推导**:任何函数体里出现
# `query(DecisionTask).filter_by(id=` 就是"沾了"的;沾了的 route 直接进攻击面;
# 沾了的 helper 会污染所有调用它的 route(实测抓到:swarm_runs.py 的裸查在
# helper `_default_context` 里,只扫 route 会整个漏掉——这正是手写 set 的盲区,
# 它当时也确实漏了 `create_serial_loop` 这条真实攻击面)。
# 新端点只要碰 DecisionTask 裸查,就自动要求一条 probe,不需要谁记得更新清单。

_ROUTERS_DIR = Path(__file__).resolve().parent.parent / "web" / "routers"
_LOOKUP = re.compile(r"query\(DecisionTask\)\.filter_by\(id=")


def _is_route(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    for dec in node.decorator_list:
        target = dec.func if isinstance(dec, ast.Call) else dec
        if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
            if target.value.id == "router":
                return True
    return False


def derive_attack_surface() -> set[str]:
    """从源码推导:所有"读写 DecisionTask 按 id 裸查"的 route 函数名(含经 helper 传染)。"""
    surface: set[str] = set()
    for path in sorted(_ROUTERS_DIR.glob("*.py")):
        src = path.read_text(encoding="utf-8")
        if not _LOOKUP.search(src):
            continue
        tree = ast.parse(src)
        funcs = [
            n for n in ast.walk(tree)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]
        segs = {n.name: (ast.get_source_segment(src, n) or "") for n in funcs}
        tainted_helpers = {
            n.name for n in funcs if not _is_route(n) and _LOOKUP.search(segs[n.name])
        }
        for n in funcs:
            if not _is_route(n):
                continue
            seg = segs[n.name]
            if _LOOKUP.search(seg) or any(f"{h}(" in seg for h in tainted_helpers):
                surface.add(f"{path.stem}:{n.name}")
    return surface


# 攻击面 route → 本文件里对应的 probe 函数名。
# 加一个碰 DecisionTask 裸查的新端点 → 推导出的攻击面多一项 → 这里没登记 → 覆盖率门红。
_PROBES = {
    "jinyiwei:intel_evidence_fill_gap": "test_guarded_exemplar_jinyiwei_fill_gap",
    "shangshufang:shangshufang_task_status": "test_shangshufang_task_status",
    "shangshufang:shangshufang_task_decision": "test_shangshufang_task_decision",
    "shangshufang:shangshufang_swarm_deepen": "test_shangshufang_swarm_deepen",
    "shangshufang:shangshufang_confirm_edict": "test_shangshufang_confirm_edict",
    "shangshufang:shangshufang_finance_intel_loop_case": "test_shangshufang_finance_intel_case",
    "shangshufang:shangshufang_brief_decision_advance": "test_shangshufang_brief_decision_advance",
    "shangshufang:shangshufang_edict_return": "test_shangshufang_edict_return",
    "swarm_runs:create_swarm_run": "test_swarm_runs_create",
    "swarm_runs:create_serial_loop": "test_swarm_runs_create_serial_loop",
}

# 推导出来但**不是**跨用户攻击面的,必须在这里显式豁免并写明理由(不许静默忽略)。
_EXEMPT = {
    # 读回的是它自己刚用 make_id("budget", ..., _user_id(user), ...) 创建的 task,
    # id 不由调用方提供,别人的任务碰不到。
    "shangshufang:shangshufang_research_budget_loop": "自建 task,id 不由调用方提供",
}


def _seed_other_users_task(session_local, task_id: str, status: str = "reviewing") -> None:
    """种一个明确属于 someone_else 的任务(conftest 注入的当前身份是 user_id=1)。"""
    from src.db.models import DecisionTask

    db = session_local()
    db.add(
        DecisionTask(
            id=task_id,
            user_id="someone_else",
            raw_question="别人的机密问题",
            status=status,
            source_label="LIVE",
        )
    )
    db.commit()
    db.close()


def _seed_other_users_review(session_local, review_id: str, task_id: str) -> None:
    """种一个挂在别人任务下的 CourtReview(brief_id → review.task_id → 别人的任务)。"""
    from src.db.models import CourtReview, DecisionTask

    db = session_local()
    db.add(
        DecisionTask(
            id=task_id,
            user_id="someone_else",
            raw_question="别人的机密问题",
            status="reviewing",
            source_label="LIVE",
        )
    )
    db.add(CourtReview(id=review_id, task_id=task_id, review_status="reviewing"))
    db.commit()
    db.close()


def _assert_denied(body: dict, what: str) -> None:
    """必须因【归属】被拒,不认"碰巧被别的校验挡住"。

    2026-07-14 实测踩到的真坑:初版只断言 success is False,结果
    /tasks/{id}/decision 和 /briefs/{id}/decision/advance 两个端点"通过"了——
    但它们的拒绝理由是"正式奏折尚未通过质量与来源门"(状态门),跟归属毫无关系。
    受害者的任务只要恰好处在正确状态,攻击就会长驱直入。弱断言会把这种端点
    标成安全,是反向的假绿。故这里要求错误信息明确指向越权。
    """
    assert body.get("success") is False, (
        f"跨用户访问他人 DecisionTask({what})必须被拒绝,当前被放行——P0-B 漏洞实证"
    )
    error = str(body.get("error") or "")
    assert "无权" in error, (
        f"{what}:被拒了,但拒绝理由是「{error}」——这不是归属校验,是别的门碰巧挡住了。"
        "换一个状态合适的受害者任务就能绕过。必须显式校验 task.user_id。"
    )


# ---------------------------------------------------------------------------
# 已修端点(无 xfail:今天就必须绿;谁删掉校验,这里立刻红)
# ---------------------------------------------------------------------------


def test_shangshufang_task_status(isolated_session_local):
    """P0-B 已修(2026-07-14):加归属校验前本测试 xfail,加校验后 XPASS 强制
    删标记——还债留痕机制生效的第一个实例。"""
    _seed_other_users_task(isolated_session_local, "p0b_status")
    body = client.get("/api/shangshufang/tasks/p0b_status/status").json()
    _assert_denied(body, "task status")
    assert "无权" in body.get("error", "")


def test_guarded_exemplar_jinyiwei_fill_gap(isolated_session_local):
    """守门样板回归锚:jinyiwei fill-gap 的归属校验必须一直有效。"""
    _seed_other_users_task(isolated_session_local, "p0b_guarded", status="awaiting_evidence")
    body = client.post(
        "/api/intel/evidence/fill-gap",
        json={"task_id": "p0b_guarded", "gap": "任意缺口"},
    ).json()
    _assert_denied(body, "jinyiwei fill-gap")
    assert "无权" in body["error"]


# ---------------------------------------------------------------------------
# 未修端点(strict xfail:实证漏洞在案。修好一个 → XPASS 失败 → 删掉标记)
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    strict=True,
    reason="P0-B 未修:POST /tasks/{id}/decision 无归属校验。注意它当前会因"
    "「正式奏折质量门」被拒——那是状态门不是归属门,受害者任务状态合适时可绕过",
)
def test_shangshufang_task_decision(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_decision")
    body = client.post(
        "/api/shangshufang/tasks/p0b_decision/decision",
        json={"action": "approve"},
    ).json()
    _assert_denied(body, "task decision")


@pytest.mark.xfail(strict=True, reason="P0-B 未修:POST /tasks/{id}/swarm-deepen 可对他人任务发起深议")
def test_shangshufang_swarm_deepen(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_deepen")
    body = client.post("/api/shangshufang/tasks/p0b_deepen/swarm-deepen").json()
    _assert_denied(body, "swarm deepen")


@pytest.mark.xfail(strict=True, reason="P0-B 未修:POST /confirm-edict 可确认他人任务的旨意")
def test_shangshufang_confirm_edict(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_confirm")
    body = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": "p0b_confirm", "confirmed": True},
    ).json()
    _assert_denied(body, "confirm edict")


@pytest.mark.xfail(strict=True, reason="P0-B 未修:GET /finance-intel-loop/cases/{id} 可读他人任务案卷")
def test_shangshufang_finance_intel_case(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_finance")
    body = client.get("/api/shangshufang/finance-intel-loop/cases/p0b_finance").json()
    _assert_denied(body, "finance intel case")


@pytest.mark.xfail(
    strict=True,
    reason="P0-B 未修:POST /briefs/{id}/decision/advance 无归属校验。当前会因"
    "「需皇上人工确认」被拒——那是状态门不是归属门,受害者任务状态合适时可绕过",
)
def test_shangshufang_brief_decision_advance(isolated_session_local):
    _seed_other_users_review(isolated_session_local, "p0b_brief", "p0b_brief_task")
    body = client.post(
        "/api/shangshufang/briefs/p0b_brief/decision/advance",
        json={"decision": "issue_decree"},
    ).json()
    _assert_denied(body, "brief decision advance")


@pytest.mark.xfail(strict=True, reason="P0-B 未修:POST /edict-return 可向他人任务回填蜂群结果")
def test_shangshufang_edict_return(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_return")
    body = client.post(
        "/api/shangshufang/edict-return",
        json={"taskId": "p0b_return", "command": "x"},
    ).json()
    _assert_denied(body, "edict return")


@pytest.mark.xfail(strict=True, reason="P0-B 未修:POST /api/swarm-runs 可对他人任务发起蜂群运行")
def test_swarm_runs_create(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_swarmrun")
    body = client.post(
        "/api/swarm-runs",
        json={"task_id": "p0b_swarmrun", "mode": "dry_run"},
    ).json()
    _assert_denied(body, "swarm run create")


@pytest.mark.xfail(
    strict=True,
    reason="P0-B 未修:POST /api/swarm-runs/serial 可对他人任务发起串行蜂群。"
    "这条攻击面是手写清单漏掉、AST 推导抓出来的——裸查藏在 helper _default_context 里",
)
def test_swarm_runs_create_serial_loop(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_swarmrun_serial")
    body = client.post(
        "/api/swarm-runs/serial",
        json={"task_id": "p0b_swarmrun_serial", "mode": "dry_run"},
    ).json()
    _assert_denied(body, "swarm run serial")


# ---------------------------------------------------------------------------
# 覆盖率门:没有测试 ≠ 没有漏洞
# ---------------------------------------------------------------------------


def test_every_attack_surface_endpoint_has_a_probe():
    """代码里每一个碰 DecisionTask 裸查的 route,都必须有一条跨用户 probe。

    攻击面**从 AST 推导**,不是手写清单——上一版用手写 set 对照本文件函数,
    两边都由我维护,新增漏洞端点忘了登记就照样全绿(循环论证)。而且那个手写
    set 当时确实已经漏了 swarm_runs 的 `create_serial_loop`(它的裸查藏在
    helper 里),推导版一上来就把它抓了出来。

    没有测试 ≠ 没有漏洞。新端点碰裸查 → 自动进攻击面 → 必须登记 probe 或
    显式豁免(带理由),否则本测试红。
    """
    derived = derive_attack_surface()
    covered = set(_PROBES) | set(_EXEMPT)

    unprobed = sorted(derived - covered)
    assert not unprobed, (
        f"以下 route 碰了 DecisionTask 裸查但没有跨用户 probe:{unprobed}。"
        "每一个都必须在 _PROBES 里登记一条行为测试(照 jinyiwei fill-gap 的"
        "归属校验写),或在 _EXEMPT 里写明为何不构成跨用户攻击面。"
    )

    stale = sorted(covered - derived)
    assert not stale, (
        f"_PROBES/_EXEMPT 里登记了代码中已不存在的 route:{stale}。"
        "端点被删或改名后请同步清理,避免清单与现实脱节后这道门静默失效。"
    )

    module = globals()
    missing_fn = sorted(p for p in _PROBES.values() if p not in module)
    assert not missing_fn, f"_PROBES 指向了本文件里不存在的测试函数:{missing_fn}"
