"""统一动作 dispatch 测试:四道全闸 + 状态机。纯函数,不碰 web。"""
from src import court_action as ca


def _doc(actions, state="待审"):
    return {"actions": actions, "workflow": {"state": state}}


def test_unknown_action_rejected():
    r = ca.dispatch(_doc(["apply_fixes"]), "no_such")
    assert r["status"] == "error" and r["code"] == "unknown_action"


def test_action_not_in_whitelist_rejected():
    # 闸①:动词存在但不在该文书按钮白名单
    r = ca.dispatch(_doc(["apply_fixes"]), "release", actor_role="yushi")
    assert r["status"] == "error" and r["code"] == "not_allowed_here"


def test_gatekeeper_only_blocks_non_gatekeeper():
    # 闸②:release 只有把关人能发
    r = ca.dispatch(_doc(["release"]), "release", actor_role="hubu")
    assert r["status"] == "error" and r["code"] == "forbidden_gatekeeper"


def test_gatekeeper_release_allowed_with_confirm():
    r = ca.dispatch(_doc(["release"]), "release", actor_role="yushi", confirm=True)
    assert r["status"] == "ok" and r["new_state"] == ca.STATE_APPROVED


def test_irreversible_needs_confirm_first():
    # 闸③:归档不可逆,无 confirm → needs_confirm 不执行
    r = ca.dispatch(_doc(["archive_amulet"]), "archive_amulet")
    assert r["status"] == "needs_confirm"
    r2 = ca.dispatch(_doc(["archive_amulet"]), "archive_amulet", confirm=True)
    assert r2["status"] == "ok" and r2["new_state"] == ca.STATE_ARCHIVED


def test_reversible_action_runs_without_confirm():
    r = ca.dispatch(_doc(["apply_fixes"]), "apply_fixes")
    assert r["status"] == "ok" and r["new_state"] == ca.STATE_PENDING


def test_idempotency_replay_returns_cached():
    # 闸④:同 key 重放不重复执行
    seen: dict = {}
    r1 = ca.dispatch(_doc(["apply_fixes"]), "apply_fixes", idempotency_key="k1", seen=seen)
    r2 = ca.dispatch(_doc(["apply_fixes"]), "apply_fixes", idempotency_key="k1", seen=seen)
    assert r1["status"] == "ok"
    assert r2.get("idempotent_replay") is True


def test_state_transition_records_prev_and_new():
    r = ca.dispatch(_doc(["escalate_court"], state="待审"), "escalate_court", confirm=True)
    assert r["prev_state"] == "待审" and r["new_state"] == ca.STATE_ESCALATED


def test_side_action_keeps_state():
    r = ca.dispatch(_doc(["trace_evidence"], state="待审"), "trace_evidence")
    assert r["status"] == "ok" and r["new_state"] == "待审"   # 读动作不改状态
