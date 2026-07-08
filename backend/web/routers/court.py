"""court 端点 — 统一动作 dispatch + 司级二级页(洞①/洞② 上线契约)。

- POST /api/court/action          : court_doc 所有按钮的统一后端(钦天监:统一端点+全闸+二次确认)
- GET  /api/court/si/{dept}        : 某部门的司列表(司级导航)
- GET  /api/court/si/{dept}/{si}   : 司档案(履历/能力/贡献)

安全(schneier 红线):actor_role 取自鉴权身份 current_user.role,**不信请求体**,
否则任何人 body 里写 role=yushi 就能放行。C2 全闸在 src/court_action.dispatch 内。
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src import case_archive
from src import court_action as ca
from src import court_roles
from src import court_state_store as css
from src import production_events as pe
from src import si_profile as sp
from web.deps import get_current_user
from web.routers._envelope import fail, ok
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/court", tags=["court"])


class ActionRequest(BaseModel):
    doc: dict = Field(..., description="court_doc(含 actions 白名单)")
    action: str = Field(..., min_length=1, max_length=64)
    confirm: bool = False
    idempotency_key: str | None = Field(default=None, max_length=128)
    at: str = Field(default="", max_length=40, description="客户端时间戳(审计用,可空)")


def _doc_id(doc: dict) -> str:
    return str(doc.get("doc_id") or doc.get("case_id") or "")


def _severity(doc: dict) -> int:
    """严重度 = 红/黑灯项数(pending 排序用)。"""
    return sum(1 for it in (doc.get("items") or []) if it.get("level") in ("red", "black"))


def _title(doc: dict) -> str:
    return str(doc.get("headline") or doc.get("question") or _doc_id(doc))[:80]


def _effective_at(client_at: str) -> str:
    """client_at 缺省(前端没传/传空)→ 服务端兜底真实时钟,别让 waiting_hint 静默变哑。

    真实合同走查暴露的:register 不传 at,updated_at 落空字符串,pending_action 里
    waiting_since/waiting_hint 全是空——不报错,只是这个功能悄悄失效。client 传了就
    以 client 为准(保留客户端时间戳的审计语义),没传才兜底,不覆盖已有行为。
    """
    return client_at or datetime.now().astimezone().isoformat()


class RegisterRequest(BaseModel):
    doc: dict = Field(..., description="新出的 court_doc")
    si: str = Field(default="", max_length=64, description="经手的司(可空)")
    at: str = Field(default="", max_length=40)


@router.post("/action")
def court_action(req: ActionRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """执行一个 court_doc 动作。全闸在 dispatch 内;状态以存储为准并落库,角色走白名单。"""
    doc_id = _doc_id(req.doc)
    # 洞A:权威状态取自存储(不信前端回传,防伪造回退);无记录则用初始态
    doc = dict(req.doc)
    stored = css.get_state(doc_id) if doc_id else None
    doc["workflow"] = {**(doc.get("workflow") or {}), "state": stored or ca.STATE_PENDING}
    # 洞B:御史角色走白名单(config 授权,非 body/自封)
    actor_role = court_roles.effective_role(user.username, user.role)

    # L:幂等走原子 claim(文件锁互斥,堵单机多 worker 的 check-then-act 竞态,schneier)。
    # 命中且已完成 → 直接回放;命中且仍 pending(并发请求正卡在下面执行中)→ 明确拒绝,不重复发动作
    # charity-majors 天才建议:别只信"测过就完了"——落一个可查的事件,几周真实流量后
    # 才知道 idempotent_in_flight 是真问题还是从没发生过(该不该继续按高优先级维护)。
    if req.idempotency_key:
        existing = css.claim_idempotent(req.idempotency_key)
        if existing is not None:
            in_flight = existing.get("status") == "pending"
            pe.record_event("court_idempotency", status="in_flight" if in_flight else "replay",
                             case_id=doc_id, step=req.action, user_role=actor_role)
            if in_flight:
                return fail("同一动作正在处理中,请勿重复提交", extra={"code": "idempotent_in_flight"})
            return ok({**existing, "idempotent_replay": True})
        pe.record_event("court_idempotency", status="claimed", case_id=doc_id,
                         step=req.action, user_role=actor_role)

    result = ca.dispatch(doc, req.action, actor_role=actor_role, confirm=req.confirm)
    if result.get("status") == "error":
        if req.idempotency_key:
            css.release_idempotent(req.idempotency_key)
        return fail(result.get("reason", "动作被拒"), extra={"code": result.get("code")})
    # 洞A:执行成功且改了状态 → 落库(带审计:谁/因何动作/何时)
    if result.get("status") == "ok" and doc_id and result.get("new_state") != result.get("prev_state"):
        css.set_state(doc_id, result["new_state"], action=req.action,
                      actor=(user.username or ""), updated_at=_effective_at(req.at))
    # L:执行成功→落地最终结果(替换 claim 占位);needs_confirm 不缓存,撤占位留给用户确认后重发
    if req.idempotency_key:
        if result.get("status") == "ok":
            css.set_idempotent(req.idempotency_key, result)
        else:
            css.release_idempotent(req.idempotency_key)
    # 修史馆空按钮(诸司能力核查挖出的洞):feed_flywheel 之前只走状态机(to_state=None),
    # dispatch 校验完就直接返回 ok——用户点了看到"成功",但从没真的调用 court_flywheel
    # 把这条文书写进知识库。现在真的写:失败不炸(飞轮本身"失败不抛异常"),
    # 统计数字并进响应,前端能看到"到底存没存进去",不是一句空话的"成功"。
    if req.action == "feed_flywheel" and result.get("status") == "ok":
        from src import court_flywheel
        stamp = (req.at or "")[:10] or datetime.now().date().isoformat()
        flywheel_stats = court_flywheel.archive_session_to_knowledge(
            memorials=[{"swarm": doc.get("dept", ""), "dept": doc.get("dept", ""),
                       "status": "ok", "summary": doc.get("headline", "")}],
            report_text="", stamp=stamp,
        )
        result = {**result, "flywheel": flywheel_stats}
    return ok(result)   # ok / needs_confirm 都是正常响应,needs_confirm 由前端弹二次确认


@router.post("/register")
def court_register(req: RegisterRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """新出的 court_doc 登记为待审(带 dept/si/严重度),进入"待你决"队列(pending action 数据源)。"""
    doc_id = _doc_id(req.doc)
    if not doc_id:
        return fail("court_doc 缺 doc_id/case_id,无法登记", extra={"code": "no_doc_id"})
    rec = css.set_state(doc_id, ca.STATE_PENDING, action="register", actor=(user.username or ""),
                        updated_at=_effective_at(req.at), dept=str(req.doc.get("dept", "")), si=req.si,
                        title=_title(req.doc), severity=_severity(req.doc))
    return ok({"doc_id": doc_id, "state": rec["state"], "severity": rec["severity"]})


@router.get("/pending")
def court_pending(dept: str = "", si: str = "", _: CurrentUser = Depends(get_current_user)) -> dict:
    """此刻最该决的一件事(张小龙:进来第一眼,含"已等待多久"——真实时钟只在 web 层取)。"""
    now = datetime.now().astimezone().isoformat()
    return ok(css.pending_action(dept or None, si or None, now=now))


@router.get("/state/{doc_id}")
def court_state(doc_id: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    """取某文书当前权威状态(前端刷新读回,洞A:点了存住能读到)。无记录 → 初始待审。"""
    return ok({"doc_id": doc_id, "state": css.get_state(doc_id) or ca.STATE_PENDING})


@router.get("/si/{dept}")
def si_list(dept: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    """部门下的司列表(司级导航)。"""
    return ok({"dept": dept, "si": sp.list_si(dept)})


@router.get("/si/{dept}/{si}")
def si_profile(dept: str, si: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    """司档案(履历/能力/贡献 + 此刻待决)。接真归档;pending 进来一眼看到(张小龙)。"""
    try:
        profile = sp.build_si_profile(dept, si, records_fn=case_archive.records_for_si)
        profile["pending_action"] = css.pending_action(dept, si)   # 进来第一眼:此刻要我决什么
        return ok(profile)
    except ValueError as e:
        return fail(str(e), extra={"code": "unknown_si"})
