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

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ROUTERS_DIR = _BACKEND_ROOT / "web" / "routers"
# form-agnostic:任何从 DB 取 DecisionTask 行的查询都算,不管 filter 语法。
# 排除构造器创建(db.add(DecisionTask(...)))——那是写自己的行,不是读别人的。
_LOOKUP = re.compile(
    r"query\(\s*DecisionTask\s*\)|\.get\(\s*DecisionTask\s*,|filter\(\s*DecisionTask\."
)

# ============================ 已知天花板(本门不 sound)============================
# 2026-07-14 五次纠正后的诚实声明:经过四轮"加宽检测"(窄正则→form-agnostic→AST
# 推导→跨文件),每轮都抓出真漏洞,但每轮又被指出"仍可假绿"。根本原因是——
# **同仓静态扫描无法 sound 地枚举"某 route 是否读 DecisionTask"**。这跟
# rollout-history 自检器"改不了检查它自己被删"是同一类不可消除的天花板。
#
# 本门现在做到:直接读 + import 解析的跨文件一跳 reader + 同文件多级 helper 传染
# (下面 derive_attack_surface 实现,已实测能抓出跨文件的 build_decree_execution_status
#  和 helper 链上的 create_serial_loop/retry_swarm_run)。
#
# 本门**仍然抓不到**(会假绿,已知且接受,不假装完整):
#   - 动态派发 / getattr / 反射调用读 DecisionTask;
#   - 原生 SQL 字符串("SELECT ... FROM decision_tasks");
#   - 把 DecisionTask 用别名 import(`import ... as DT`)后 query(DT);
#   - 跨文件超过一跳的调用链(route→A→B→读)。
# 真正的 sound 关闭方式是**结构性**的,不是更强的扫描:把所有 DecisionTask 按 id 的
# 读收口到唯一一个带归属校验的 accessor,届时"未经 accessor 直接 query(DecisionTask)"
# 变成一条可精确 grep 的违规——把无界的检测问题变成有界的。这是一次会与并发 session
# 冲突的重构,列为 P0-B 的收尾项(见 plan)。在此之前:**本文件的行为 probe 才是权威**,
# 静态门只是尽力而为的绊线;"P0-B 清零"不能只凭静态门全绿宣称。
# ================================================================================


def _is_route(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    for dec in node.decorator_list:
        target = dec.func if isinstance(dec, ast.Call) else dec
        if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
            if target.value.id == "router":
                return True
    return False


def _funcs_reading_decision_task(path: Path) -> set[str]:
    """某文件里"函数体直接含 DecisionTask 读查询"的函数名集合。"""
    src = path.read_text(encoding="utf-8")
    if not _LOOKUP.search(src):
        return set()
    tree = ast.parse(src)
    out: set[str] = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if _LOOKUP.search(ast.get_source_segment(src, n) or ""):
                out.add(n.name)
    return out


def _cross_file_reader_names() -> set[str]:
    """全仓(排除 tests)所有"函数体直接读 DecisionTask"的函数名——用于解析 router
    import 进来的名字是否是个 reader。按裸名匹配(过度近似=偏安全,宁可多报)。"""
    names: set[str] = set()
    for path in _BACKEND_ROOT.rglob("*.py"):
        sp = str(path)
        if "/tests/" in sp or "__pycache__" in sp:
            continue
        try:
            names |= _funcs_reading_decision_task(path)
        except (SyntaxError, UnicodeDecodeError):
            continue
    return names


def derive_attack_surface() -> set[str]:
    """推导所有"读 DecisionTask 行"的 route:直接查询 + import 来的跨文件 reader +
    同文件多级 helper 传染。已知天花板见文件上方声明。"""
    cross_file_readers = _cross_file_reader_names()
    surface: set[str] = set()
    for path in sorted(_ROUTERS_DIR.glob("*.py")):
        src = path.read_text(encoding="utf-8")
        tree = ast.parse(src)
        funcs = [
            n for n in ast.walk(tree)
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]
        segs = {n.name: (ast.get_source_segment(src, n) or "") for n in funcs}

        # 本文件 import 进来的、确实是 reader 的名字。
        imported_readers: set[str] = set()
        for n in ast.walk(tree):
            if isinstance(n, ast.ImportFrom):
                for alias in n.names:
                    if alias.name in cross_file_readers:
                        imported_readers.add(alias.asname or alias.name)

        # 起始污染集:本文件直接读的函数 + import 来的 reader。
        tainted = {name for name in segs if _LOOKUP.search(segs[name])} | imported_readers
        # 多级传染:调用了污染函数的函数,自己也污染,迭代到不动点。
        changed = True
        while changed:
            changed = False
            for name, seg in segs.items():
                if name in tainted:
                    continue
                if any(re.search(rf"\b{re.escape(t)}\(", seg) for t in tainted):
                    tainted.add(name)
                    changed = True

        for n in funcs:
            if _is_route(n) and n.name in tainted:
                surface.add(f"{path.stem}:{n.name}")
    return surface


# 攻击面 route → 本文件里对应的 probe 函数名。
# 加一个碰 DecisionTask 查询的新端点 → 推导出的攻击面多一项 → 这里没登记 → 覆盖率门红。
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
    # form-agnostic 检测新抓出的两个列表泄露端点(窄正则漏掉的):
    "court_compat:grand_council_live": "test_grand_council_live_list_leak",
    "shangshufang:shangshufang_home": "test_shangshufang_home_list_leak",
    # 跨文件/多级传染检测新抓出的(直接扫 router 漏掉的):
    "shangshufang:shangshufang_brief_decision": "test_shangshufang_brief_decision",
    "swarm_runs:retry_swarm_run": "test_swarm_runs_retry",
    "chaotang:task_persist": "test_chaotang_task_persist",
    "chaotang:task_persist_patch": "test_chaotang_task_persist_patch",
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


_SENTINEL = "机密哨兵_只属于someone_else_勿泄露_a7f3"


def _seed_victim_with_sentinel(session_local, task_id: str, status: str = "reviewing") -> None:
    from src.db.models import DecisionTask

    db = session_local()
    db.add(
        DecisionTask(
            id=task_id,
            user_id="someone_else",
            raw_question=_SENTINEL,
            status=status,
            source_label="LIVE",
        )
    )
    db.commit()
    db.close()


def _assert_sentinel_not_leaked(resp, what: str) -> None:
    """列表端点的跨用户检验:他人任务的机密内容绝不能出现在返回体任何角落。

    列表泄露不是"返回失败",而是"200 + 受害者的任务混在数组里"——弱断言
    (success is False)对列表端点完全无效。这里直接扫整个序列化响应,只要
    哨兵字符串出现就是泄露。form-independent,不耦合内部 payload 结构(并发
    session 正在重写这些端点的字段名)。"""
    raw = resp.text
    assert _SENTINEL not in raw, (
        f"{what}:他人任务的机密内容出现在列表响应里——跨用户列表泄露(P0-B)。"
        "该端点按 status 过滤但没按 user_id 过滤。"
    )


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
# 已收口端点：曾以 strict xfail 留债，现已全部转为永久回归门
# ---------------------------------------------------------------------------


def test_shangshufang_task_decision(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_decision")
    body = client.post(
        "/api/shangshufang/tasks/p0b_decision/decision",
        json={"action": "approve"},
    ).json()
    _assert_denied(body, "task decision")


def test_shangshufang_swarm_deepen(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_deepen")
    body = client.post("/api/shangshufang/tasks/p0b_deepen/swarm-deepen").json()
    _assert_denied(body, "swarm deepen")


def test_shangshufang_confirm_edict(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_confirm")
    body = client.post(
        "/api/shangshufang/confirm-edict",
        json={"task_id": "p0b_confirm", "confirmed": True},
    ).json()
    _assert_denied(body, "confirm edict")


def test_shangshufang_finance_intel_case(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_finance")
    body = client.get("/api/shangshufang/finance-intel-loop/cases/p0b_finance").json()
    _assert_denied(body, "finance intel case")


def test_shangshufang_brief_decision_advance(isolated_session_local):
    _seed_other_users_review(isolated_session_local, "p0b_brief", "p0b_brief_task")
    body = client.post(
        "/api/shangshufang/briefs/p0b_brief/decision/advance",
        json={"decision": "issue_decree"},
    ).json()
    _assert_denied(body, "brief decision advance")


def test_shangshufang_edict_return(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_return")
    body = client.post(
        "/api/shangshufang/edict-return",
        json={"taskId": "p0b_return", "command": "x"},
    ).json()
    _assert_denied(body, "edict return")


def test_swarm_runs_create(isolated_session_local):
    """P0-B 已修(2026-07-14):归属校验收口在 _default_context,create/serial/retry
    三个端点共用这条唯一入口,一处 guard 全挡。此后谁绕开该 guard,这里立刻红。"""
    _seed_other_users_task(isolated_session_local, "p0b_swarmrun")
    body = client.post(
        "/api/swarm-runs",
        json={"task_id": "p0b_swarmrun", "mode": "dry_run"},
    ).json()
    _assert_denied(body, "swarm run create")


def test_swarm_runs_create_serial_loop(isolated_session_local):
    """P0-B 已修(2026-07-14):同经 _default_context 的归属校验。"""
    _seed_other_users_task(isolated_session_local, "p0b_swarmrun_serial")
    body = client.post(
        "/api/swarm-runs/serial",
        json={"task_id": "p0b_swarmrun_serial", "mode": "dry_run"},
    ).json()
    _assert_denied(body, "swarm run serial")


def test_shangshufang_brief_decision(isolated_session_local):
    _seed_other_users_review(isolated_session_local, "p0b_bd", "p0b_bd_task")
    body = client.post(
        "/api/shangshufang/briefs/p0b_bd/decision",
        json={"decision": "issue_decree"},
    ).json()
    _assert_denied(body, "brief decision")


def test_swarm_runs_retry(isolated_session_local):
    # P0-B 已修(2026-07-14):retry 取别人的 SwarmRun 后转 create_swarm_run,
    # 后者经 _default_context 归属校验拒绝——transitively 覆盖,无需在 retry 里重复。
    from src.db.models import DecisionTask, SwarmRun

    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="p0b_retry_task", user_id="someone_else", raw_question="别人的任务",
            status="reviewing", source_label="LIVE",
        )
    )
    db.add(
        SwarmRun(
            id="p0b_retry_run", task_id="p0b_retry_task", review_id="p0b_retry_review",
            mode="dry_run", status="failed",
        )
    )
    db.commit()
    db.close()
    body = client.post("/api/swarm-runs/p0b_retry_run/retry").json()
    _assert_denied(body, "swarm run retry")


def test_chaotang_task_persist(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_task_persist")
    body = client.post(
        "/api/chaotang/tasks/persist",
        json={"taskId": "p0b_task_persist", "command": "篡改别人的任务"},
    ).json()
    _assert_denied(body, "chaotang task persist")


def test_chaotang_task_persist_patch(isolated_session_local):
    _seed_other_users_task(isolated_session_local, "p0b_task_persist_patch")
    body = client.patch(
        "/api/chaotang/tasks/p0b_task_persist_patch/persist",
        json={"status": "archived", "result": {"tampered": True}},
    ).json()
    _assert_denied(body, "chaotang task persist patch")


# ---------------------------------------------------------------------------
# 列表泄露端点(form-agnostic 检测新抓出;窄正则曾整个漏掉)
# ---------------------------------------------------------------------------


def test_grand_council_live_list_leak(isolated_session_local):
    # 该端点只列出同时有 ChancellorRouteDecision + CourtReview 的任务(否则 continue)。
    # 必须种齐这一组,受害者任务才会真的出现在列表里——否则测试会因"数据不全没上榜"
    # 假绿,而不是因为端点安全。(2026-07-14 实测踩到:只种裸任务 → XPASS 假通过。)
    from src.chancellor.contracts import RouteDecisionV2
    from src.db.models import ChancellorRouteDecision, CourtReview, DecisionTask

    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="p0b_council_leak", user_id="someone_else", raw_question=_SENTINEL,
            status="reviewing", source_label="LIVE",
        )
    )
    decision = RouteDecisionV2(
        decision_id="p0b_council_dec", task_id="p0b_council_leak", mode="council",
        strategy="parallel_review", primary_department="刑部", primary_agent=None,
        participants=[], reason_summary="x", complexity_score=0.5, confidence=0.8,
        human_confirmation_required=True, capability_snapshot_version="v1",
        source_label="LIVE", created_at="2026-07-14T00:00:00+00:00",
    )
    db.add(
        ChancellorRouteDecision(
            decision_id="p0b_council_dec", task_id="p0b_council_leak",
            idempotency_key="p0b_council_idem", mode="council", primary_department="刑部",
            source_label="LIVE", decision_json=decision.model_dump_json(),
        )
    )
    db.add(CourtReview(id="p0b_council_review", task_id="p0b_council_leak", review_status="reviewing"))
    db.commit()
    db.close()

    resp = client.get("/api/court/grand-council/live")
    _assert_sentinel_not_leaked(resp, "grand-council live")


def test_shangshufang_home_list_leak(isolated_session_local):
    _seed_victim_with_sentinel(isolated_session_local, "p0b_home_leak")
    resp = client.get("/api/shangshufang/home")
    _assert_sentinel_not_leaked(resp, "shangshufang home")


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
