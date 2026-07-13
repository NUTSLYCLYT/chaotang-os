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

import pytest
from fastapi.testclient import TestClient

from web.main import app

client = TestClient(app)

# 真实跨用户攻击面:调用方传入 task/brief id → 端点据此读写 DecisionTask。
# 每一项都必须在本文件里有一条同名 probe(见覆盖率门)。
_ATTACK_SURFACE = {
    "shangshufang_task_status",
    "shangshufang_task_decision",
    "shangshufang_swarm_deepen",
    "shangshufang_confirm_edict",
    "shangshufang_finance_intel_case",
    "shangshufang_brief_decision_advance",
    "shangshufang_edict_return",
    "swarm_runs_create",
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


# ---------------------------------------------------------------------------
# 覆盖率门:没有测试 ≠ 没有漏洞
# ---------------------------------------------------------------------------


def test_every_attack_surface_endpoint_has_a_probe():
    """本文件必须为每一个攻击面端点提供一条 probe。

    这道门存在的原因:初版把"P0-B 清零"定义成"xfail 数 == 0",而当时只写了
    1 条测试——另外 8 处漏洞零测试,xfail 数天然为 0,门会宣布"已清零"。
    没有测试不等于没有漏洞。新增攻击面端点(见 test_p0b_ownership_ratchet 的
    表面积棘轮)必须同步在这里加 probe,否则本测试红。
    """
    module = globals()
    missing = [
        name for name in sorted(_ATTACK_SURFACE) if f"test_{name}" not in module
    ]
    assert not missing, (
        f"以下攻击面端点没有跨用户 probe:{missing}。"
        "没有测试 ≠ 没有漏洞——每个接受调用方传入 task/brief id 的端点都必须有一条。"
    )
