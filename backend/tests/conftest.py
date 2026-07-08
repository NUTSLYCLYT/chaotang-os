"""tests/conftest.py — 跨文件共享 fixture。

autouse _restore_session_local:每个 test 前保存、后恢复 src.db.engine.SessionLocal。
防止 TestH1EndToEndIntegration 的 monkeypatch 在跨文件 collection 时泄漏,
导致其他测试文件拿到错误的 SessionLocal。
"""

from __future__ import annotations

import importlib

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture(autouse=True)
def _authenticated_api_user():
    """业务 API 测试默认以已认证 admin 用户运行;auth 专项测试可主动移除 override。"""
    app = importlib.import_module("web.main").app
    deps = importlib.import_module("web.deps")
    auth_schema = importlib.import_module("web.schemas.auth")
    original = app.dependency_overrides.get(deps.get_current_user)
    app.dependency_overrides[deps.get_current_user] = lambda: auth_schema.CurrentUser(
        user_id=1,
        username="ops",
        role="admin",
        tenant_slug="default",
    )
    yield
    if original is None:
        app.dependency_overrides.pop(deps.get_current_user, None)
    else:
        app.dependency_overrides[deps.get_current_user] = original


@pytest.fixture(autouse=True)
def _restore_session_local():
    """session 级隔离:每个 test 前记录 SessionLocal 原值,test 后恢复。"""
    eng_mod = importlib.import_module("src.db.engine")
    original = eng_mod.SessionLocal
    yield
    eng_mod.SessionLocal = original


# 这几个文件直接测 bingbu/jinyiwei/xingbu/quotation 本体的真实行为(解析/分级/court_doc
# 组装逻辑),自己会按需 mock 更底层的 LLM 调用——如果这里也无差别 patch 掉它们测的目标
# 函数本身,这些测试的核心断言就失去意义了(2026-07-04 实测:第一版无差别 patch 直接
# 打穿了 test_jinyiwei_agent.py/test_xingbu_verdict.py 等 10 个用例)。
_REAL_ENGINE_OWN_TEST_FILES = {
    "test_bingbu_battlecard.py",
    "test_jinyiwei_agent.py",
    "test_jinyiwei_endpoint.py",
    "test_jinyiwei_vet.py",
    "test_lawyer_rag.py",
    "test_xingbu_verdict.py",
    "test_quotation_verdict.py",
    "test_real_department_engines.py",
}


@pytest.fixture(autouse=True)
def _no_network_real_department_engines(request, monkeypatch):
    """兵部/刑部/户部/锦衣卫的真实引擎(src/real_department_engines.py)接入 route_swarms
    的常任/易触发关键词后(如"合作"→兵部、"报价"→户部、"判断/是否"→刑部),大量本来不测
    这几个部门的测试(任务文本偶然命中关键词,如"独家合作"里的"合作")会意外真的打
    网络——2026-07-04 实测抓到:一个纯改刑部/户部逻辑的改动,让一个跟兵部无关的法务测试
    因为文本里的"合作"二字触发了兵部的真实LLM调用而整个挂起,足足排查了很久。

    默认给全部四个真实引擎打成"诚实空结果"(未找到风险点/不适用),让 adapter 走已验证
    过的 None 分支、退回现有规则模板——不是伪造数据,是给测试环境一个安全默认值,任何
    测试都不应该依赖真实网络调用。要测真实引擎行为的用例(如
    test_high_risk_contract_requires_human_confirmation)自行用同一个 monkeypatch
    覆盖这里的默认值即可;直接测这几个模块本体的文件跳过本fixture,见上方文件名单。
    """
    if request.node.path.name in _REAL_ENGINE_OWN_TEST_FILES:
        return
    bb = importlib.import_module("src.bingbu_battlecard")
    ja = importlib.import_module("src.jinyiwei_agent")
    xv = importlib.import_module("src.xingbu_verdict")
    qv = importlib.import_module("src.quotation_verdict")
    _empty = lambda **_: {
        "items": [],
        "light": "yellow",
        "headline": "测试环境默认空结果",
    }
    monkeypatch.setattr(bb, "run_bingbu_battlecard", lambda task_input, **kw: _empty())
    monkeypatch.setattr(
        ja, "gather_intel", lambda query, *, search_fn=None, archive=True: _empty()
    )
    monkeypatch.setattr(xv, "run_verdict_from_text", lambda raw_text, **kw: _empty())
    monkeypatch.setattr(qv, "run_quotation_verdict", lambda task_input, **kw: _empty())


@pytest.fixture(autouse=True)
def _reset_login_rate_limiter():
    """login rate limiter(src.direct_rate_limit.rate_limiter)是模块级单例,
    整个 pytest 进程共用同一份状态。不重置会导致跨文件/跨测试的登录请求
    共享同一个 5次/分钟 配额,谁先跑谁占坑,后跑的测试莫名其妙 429。"""
    rl_mod = importlib.import_module("src.direct_rate_limit")
    rl_mod.rate_limiter._requests.clear()
    yield
    rl_mod.rate_limiter._requests.clear()


@pytest.fixture()
def isolated_session_local(monkeypatch):
    """Opt-in in-memory DB session factory for API tests that should ignore data/fengqun.db."""
    models = importlib.import_module("src.db.models")
    eng_mod = importlib.import_module("src.db.engine")
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    models.Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    monkeypatch.setattr(eng_mod, "SessionLocal", TestSession)
    try:
        yield TestSession
    finally:
        models.Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def isolated_runs_dir(tmp_path, monkeypatch):
    """Opt-in run artifact directory isolated from runs/ and data/default/runs."""
    step_log = importlib.import_module("src.step_log")
    monkeypatch.setattr(step_log, "_LEGACY_RUNS_DIR", tmp_path)
    monkeypatch.setattr(step_log, "RUNS_DIR", tmp_path)
    monkeypatch.setattr(step_log, "_get_runs_dir", lambda: tmp_path)
    return tmp_path


@pytest.fixture()
def isolated_swarm_sessions_dir(tmp_path, monkeypatch):
    """Opt-in swarm session artifact directory isolated from swarm_sessions/."""
    swarm_orchestrator = importlib.import_module("src.swarm_orchestrator")
    monkeypatch.setattr(swarm_orchestrator, "SESSIONS_DIR", tmp_path)
    try:
        swarm_router = importlib.import_module("web.routers.swarm")
        monkeypatch.setattr(swarm_router, "SESSIONS_DIR", tmp_path, raising=False)
    except Exception:
        pass
    return tmp_path


@pytest.fixture()
def isolated_chat_sessions_dir(tmp_path, monkeypatch):
    """Opt-in chat session artifact directory isolated from sessions/."""
    session_store = importlib.import_module("web.session_store")
    monkeypatch.setattr(session_store, "SESSIONS_DIR", tmp_path)
    return tmp_path
