"""蜂群系统 FastAPI 入口 — 唯一 Web 入口（2026-05-17 阶段 6 完成全量迁移）。

131 路由全部 FastAPI 实现，共 22 个 router 文件（web/routers/*.py）。
入口：python -m web.main 或 gunicorn -c gunicorn.conf.py web.main:app
"""

from __future__ import annotations

import json
import logging
import os
import sys
from hashlib import sha1
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# 项目根加入 sys.path，使 from src/web 导入可用
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PROJECT_ROOT))

# 全服务从未配置 logging.basicConfig：无 handler 时 root logger 默认级别
# WARNING，所有 logger.info(...)（含 provider key 校验的"已加载"确认）
# 被静默丢弃，只有 ERROR 能靠 Python 的 lastResort handler 漏出去。
# nohup 场景下这意味着"一切正常"完全不可见，排障只能等出错。
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)


# ── .env 加载（与旧 web/app.py 行为一致）─────────────────


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip()


_load_env_file(_PROJECT_ROOT / ".env")


# ── lifespan：启动时确保 admin、检查 JWT_SECRET、建 flow 表 ───


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger(__name__)
    try:
        from src.tenant import ensure_admin

        ensure_admin()
    except Exception as e:
        logger.warning("ensure_admin 失败: %s", e)

    try:
        from src.security import enforce_jwt_secret

        enforce_jwt_secret()
    except ImportError:
        pass

    # H-2/BUG-1: 幂等建表(start-before-migrate 防护)。
    # Alembic 001_flow_tables 已在生产路径建表;此处 create_all 仅为:
    # ① 开发环境跑测试/dev server 时无需手动 alembic upgrade;
    # ② 旧进程早于迁移启动时补救(checkfirst=True 保幂等,不覆盖已有表)。
    try:
        from src.db.engine import engine
        from src.db.models import Base

        Base.metadata.create_all(engine, checkfirst=True)
        from src.db.engine import SessionLocal
        from src.db.flow_store import ensure_task_result_json_column

        db = SessionLocal()
        try:
            ensure_task_result_json_column(db)
            db.commit()
        finally:
            db.close()
        logger.info("flow DB tables ready (create_all checkfirst=True)")
    except Exception as e:
        logger.error("flow DB create_all 失败(非致命): %s", e)

    # #1 启动 key 校验:active provider 无 key → loud 告警(别跑到一半才哑)。
    try:
        from src.provider import check_active_provider_key

        ok, msg = check_active_provider_key()
        (logger.info if ok else logger.error)("[provider preflight] %s", msg)
    except Exception as e:
        logger.warning("provider key 校验跳过: %s", e)

    yield
    # 关闭时无清理动作


# ── App 实例 ───────────────────────────────────────────

# API 文档默认关闭(fail-safe);显式设 FENGQUN_ENABLE_DOCS=true 才开放 /docs /redoc /openapi.json。
_DOCS_ENABLED = os.environ.get("FENGQUN_ENABLE_DOCS", "false").lower() in (
    "true",
    "1",
    "yes",
)

app = FastAPI(
    title="蜂群系统 Web API",
    description="多Agent蜂群系统调试与编排面板",
    version="2.0.0",
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
    lifespan=lifespan,
)

# ── 中间件：安全头 + CORS ────────────────────────────────

from web.security_mw import SecurityHeadersMiddleware  # noqa: E402

app.add_middleware(SecurityHeadersMiddleware)

_cors_origins_env = os.environ.get("FENGQUN_ALLOWED_ORIGINS", "")
if _cors_origins_env:
    _origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ── 路由注册 ───────────────────────────────────────────

from web.routers import ab_tests as ab_tests_router  # noqa: E402
from web.routers import admin as admin_router  # noqa: E402
from web.routers import agents as agents_router  # noqa: E402
from web.routers import analytics as analytics_router  # noqa: E402
from web.routers import approval as approval_router  # noqa: E402
from web.routers import auth as auth_router  # noqa: E402
from web.routers import bingbu as bingbu_router  # noqa: E402
from web.routers import cases as cases_router  # noqa: E402
from web.routers import court as court_router  # noqa: E402
from web.routers import qintianjian as qintianjian_router  # noqa: E402
from web.routers import quotation as quotation_router  # noqa: E402
from web.routers import compare as compare_router  # noqa: E402
from web.routers import critic as critic_router  # noqa: E402
from web.routers import drafts as drafts_router  # noqa: E402
from web.routers import exports as exports_router  # noqa: E402
from web.routers import feature_flags as feature_flags_router  # noqa: E402
from web.routers import feedback as feedback_router  # noqa: E402
from web.routers import flows as flows_router  # noqa: E402
from web.routers import gongbu as gongbu_router  # noqa: E402
from web.routers import health as health_router  # noqa: E402
from web.routers import hubu as hubu_router  # noqa: E402
from web.routers import jinyiwei as jinyiwei_router  # noqa: E402
from web.routers import knowledge as knowledge_router  # noqa: E402
from web.routers import kpi as kpi_router  # noqa: E402
from web.routers import local_ai as local_ai_router  # noqa: E402
from web.routers import memory as memory_router  # noqa: E402
from web.routers import metrics as metrics_router  # noqa: E402
from web.routers import models as models_router  # noqa: E402
from web.routers import optimize as optimize_router  # noqa: E402
from web.routers import observability as observability_router  # noqa: E402
from web.routers import preferences as preferences_router  # noqa: E402
from web.routers import prompts as prompts_router  # noqa: E402
from web.routers import preflight as preflight_router  # noqa: E402
from web.routers import repairs as repairs_router  # noqa: E402
from web.routers import requirements as requirements_router  # noqa: E402
from web.routers import resources as resources_router  # noqa: E402
from web.routers import runs as runs_router  # noqa: E402
from web.routers import shangshufang as shangshufang_router  # noqa: E402
from web.routers import court_session as court_session_router  # noqa: E402
from web.routers import legal as legal_router  # noqa: E402
from web.routers import swarm as swarm_router  # noqa: E402
from web.routers import swarm_runs as swarm_runs_router  # noqa: E402
from web.routers import tools as tools_router  # noqa: E402
from web.routers import voice as voice_router  # noqa: E402
from web.routers import votes as votes_router  # noqa: E402
from web.routers import yushi as yushi_router  # noqa: E402

# 阶段 5 — 流式/异步/会话
from web.routers import chat as chat_router  # noqa: E402
from web.routers import commercial_loop as commercial_loop_router  # noqa: E402
from web.routers import flows_test as flows_test_router  # noqa: E402
from web.routers import repair_async as repair_async_router  # noqa: E402
from web.routers import runs_stream as runs_stream_router  # noqa: E402
from web.routers import tasks as tasks_router  # noqa: E402
from web.routers import task_protocol as task_protocol_router  # noqa: E402

# 阶段 4-D — throne + openai_compat
from web.routers import openai_compat as openai_compat_router  # noqa: E402
from web.routers import throne as throne_router  # noqa: E402
from web.routers import chaotang as chaotang_router  # noqa: E402

# 阶段 6 — 庄园 + 部门端点
from web.routers import manor as manor_router  # noqa: E402
from web.routers import dept as dept_router  # noqa: E402
from web.routers import direct as direct_router  # noqa: E402

app.include_router(health_router.router)
app.include_router(preflight_router.router)
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(flows_router.router)
app.include_router(tools_router.router)
app.include_router(voice_router.router)
# 阶段 4-A
app.include_router(runs_router.router)
app.include_router(analytics_router.router)
app.include_router(feedback_router.router)
app.include_router(compare_router.router)
app.include_router(exports_router.router)
app.include_router(repairs_router.router)
app.include_router(drafts_router.router)
app.include_router(optimize_router.router)
app.include_router(observability_router.router)
# 阶段 4-B
app.include_router(prompts_router.router)
app.include_router(ab_tests_router.router)
app.include_router(requirements_router.router)
app.include_router(resources_router.router)
app.include_router(cases_router.router)
app.include_router(court_router.router)
app.include_router(shangshufang_router.router)
app.include_router(court_session_router.router)
app.include_router(legal_router.router)
app.include_router(swarm_router.router)
app.include_router(swarm_runs_router.router)
app.include_router(models_router.router)
# 阶段 4-C
app.include_router(knowledge_router.router)
app.include_router(memory_router.router)
app.include_router(preferences_router.router)
app.include_router(critic_router.router)
app.include_router(kpi_router.router)
app.include_router(local_ai_router.router)
app.include_router(agents_router.router)
app.include_router(votes_router.router)
app.include_router(feature_flags_router.router)
app.include_router(approval_router.router)
app.include_router(metrics_router.router)
# 阶段 5
app.include_router(runs_stream_router.router)
app.include_router(tasks_router.router)
app.include_router(task_protocol_router.router)
app.include_router(flows_test_router.router)
app.include_router(repair_async_router.router)
app.include_router(chat_router.router)
app.include_router(commercial_loop_router.router)
# 阶段 4-D
app.include_router(throne_router.router)
app.include_router(openai_compat_router.router)
app.include_router(chaotang_router.router)
app.include_router(hubu_router.router)
app.include_router(gongbu_router.router)
app.include_router(bingbu_router.router)
app.include_router(yushi_router.router)
app.include_router(jinyiwei_router.router)
app.include_router(qintianjian_router.router)
app.include_router(quotation_router.router)
# 阶段 6 — 庄园 + 部门
app.include_router(manor_router.router)
app.include_router(dept_router.router)
app.include_router(direct_router.router)


# ── 前端首页 ───────────────────────────────────────────

_WEB_DIR = Path(__file__).resolve().parent
_INDEX_HTML = _WEB_DIR / "index.html"
_CHAOTANG_UI_HTML = _WEB_DIR / "chaotang_ui.html"

app.mount("/assets", StaticFiles(directory=_WEB_DIR / "assets"), name="assets")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(_INDEX_HTML)


@app.get("/chaotang-ui", include_in_schema=False)
def chaotang_ui() -> FileResponse:
    return FileResponse(_CHAOTANG_UI_HTML)


def _read_json_artifact(relative_path: str) -> dict:
    path = _PROJECT_ROOT / relative_path
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _select_merit_report(merit_artifact: dict) -> dict:
    reports = [
        item
        for item in merit_artifact.get("results", [])
        if item.get("passed") and item.get("final_score", 0) > 0
    ]
    if not reports:
        return {}
    with_offer = [item for item in reports if item.get("commercial_offer")]
    candidates = with_offer or reports
    return max(candidates, key=lambda item: item.get("final_score", 0))


class _ChaotangMemorialRequest(BaseModel):
    task: str


class _ChaotangPrimeMinisterDraftRequest(BaseModel):
    task: str
    mode: str = "beginner"
    emperor_style: str = "qinzheng"
    depth: str = "standard"


class _ChaotangYushiReviewRequest(BaseModel):
    memorial_id: str
    task: str
    department: str
    evidence: list[str] = []
    yushi_gate_hint: str = ""


class _ChaotangShiguanArchiveRequest(BaseModel):
    memorial_id: str
    task: str
    department: str
    yushi_review_id: str
    archive_ready: bool = False
    merit_awardable: bool = False


class _ChaotangSwarmExecuteRequest(BaseModel):
    archive_id: str
    task: str
    department: str
    archive_status: str


class _ChaotangYushiSecondReviewRequest(BaseModel):
    outcome_id: str
    archive_id: str
    task: str
    department: str
    status: str
    evidence: list[str] = []
    findings: list[str] = []


def _memorial_id(task: str) -> str:
    digest = sha1(task.encode("utf-8")).hexdigest()[:10]
    return f"memorial-{digest}"


def _department_label(code: str) -> str:
    labels = {
        "gongbu": "工部",
        "hubu": "户部",
        "libu": "礼部",
        "libu_personnel": "吏部",
        "bingbu": "兵部",
        "xingbu": "刑部",
        "yushi": "御史",
        "shiguan": "史馆",
    }
    return labels.get(code, code)


def _prime_minister_draft(task: str, mode: str, emperor_style: str, depth: str) -> dict:
    clean_task = " ".join((task or "").strip().split())
    mode_labels = {
        "beginner": "企业家",
        "senior_hobbyist": "AI 爱好者",
        "expert": "AI 爱好者",
        "geek_expert": "AI 极客",
        "geek": "AI 极客",
    }
    style_labels = {
        "qinzheng": "勤政陛下",
        "kuanrong": "宽容陛下",
    }
    style_rules = {
        "qinzheng": "目标明确、证据优先、输出可验收",
        "kuanrong": "允许探索、保留备选、先学习再收敛",
    }
    depth_rule = (
        "请展开专业步骤、风险边界、验收指标和可复用模板。"
        if depth == "professional"
        else "请先给最小可执行闭环。"
    )
    mode_label = mode_labels.get(mode, "企业家")
    style_label = style_labels.get(emperor_style, "勤政陛下")
    optimized_task = (
        f"请以{style_label}模式处理这项任务：{clean_task} "
        f"要求：{style_rules.get(emperor_style, style_rules['qinzheng'])}；"
        f"面向{mode_label}用户，先说明下一步，再给证据、风险、御史门禁和史馆归档建议；"
        f"{depth_rule}"
    )
    return {
        "original_task": clean_task,
        "optimized_task": optimized_task,
        "mode": mode,
        "mode_label": mode_label,
        "emperor_style": emperor_style,
        "emperor_title": style_label,
        "depth": depth,
        "default_choice": "optimized",
        "prime_minister": {
            "name": "丞相",
            "verdict": "已将原始提问整理为可路由、可审查、可归档的旨意。",
            "why": "默认润色能减少部门误判；保留原文可以避免用户意图被过度改写。",
        },
        "choices": [
            {"id": "optimized", "label": "按丞相拟旨下旨", "task": optimized_task},
            {"id": "original", "label": "按原文下旨", "task": clean_task},
        ],
        "research_prompt": "这次拟旨是否更贴近你的真实意图？",
    }


def _chaotang_ui_ledger_path() -> Path:
    configured = os.environ.get("FENGQUN_CHAOTANG_UI_LEDGER")
    if configured:
        return Path(configured)
    return (
        _PROJECT_ROOT
        / "harness"
        / "chaotang_uiux_system"
        / "artifacts"
        / "ui_runtime_ledger.jsonl"
    )


def _append_chaotang_ui_ledger(event: dict) -> None:
    path = _chaotang_ui_ledger_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")


def _chaotang_title_progress(total_gongji: int) -> dict:
    tiers = [
        {"title": "勤政之主", "floor": 0, "target": 120, "next_title": "中兴之主"},
        {"title": "中兴之主", "floor": 120, "target": 300, "next_title": "圣君"},
        {"title": "圣君", "floor": 300, "target": 520, "next_title": "圣君·进阶"},
    ]
    tier = tiers[-1]
    for candidate in tiers:
        if total_gongji < candidate["target"]:
            tier = candidate
            break
    remaining = max(int(tier["target"]) - total_gongji, 0)
    span = max(int(tier["target"]) - int(tier["floor"]), 1)
    progress = min(max((total_gongji - int(tier["floor"])) / span, 0), 1)
    return {
        "title": tier["title"],
        "next_title": tier["next_title"],
        "current": total_gongji,
        "target": tier["target"],
        "remaining": remaining,
        "percent": round(progress * 100, 1),
    }


def _department_level(points: int) -> int:
    return max(1, min(5, 1 + points // 60))


def _build_chaotang_account_summary(ledger: dict) -> dict:
    total_merit = ledger.get("total_merit") or {}
    total_gongji = int(total_merit.get("gongji", 0) or 0)
    title_progress = _chaotang_title_progress(total_gongji)
    events = ledger.get("events") or []
    department_totals: dict[str, dict] = {}
    for event in events:
        department = event.get("department") or "unknown"
        item = department_totals.setdefault(
            department,
            {
                "department": department,
                "name": event.get("department_name") or _department_label(department),
                "points": 0,
                "gongji": 0,
                "jinglue": 0,
            },
        )
        merit = event.get("merit") or {}
        gongji = int(merit.get("gongji", 0) or 0)
        jinglue = int(merit.get("jinglue", 0) or 0)
        item["gongji"] += gongji
        item["jinglue"] += jinglue
        item["points"] += gongji + jinglue

    departments = []
    for item in department_totals.values():
        item["level"] = _department_level(int(item["points"]))
        item["next_level_remaining"] = max(item["level"] * 60 - int(item["points"]), 0)
        departments.append(item)
    departments.sort(key=lambda item: (-int(item["points"]), item["name"]))

    latest_reports = [
        {
            "grade": event.get("grade", "圣裁"),
            "score": event.get("score", 0),
            "task": event.get("task", ""),
            "department": event.get("department", "unknown"),
            "department_name": event.get("department_name")
            or _department_label(event.get("department", "unknown")),
            "recorded_at": event.get("recorded_at"),
        }
        for event in reversed(events[-3:])
    ]
    if title_progress["remaining"]:
        next_upgrade = (
            f"距{title_progress['next_title']}还差 {title_progress['remaining']} 功绩。"
        )
    else:
        next_upgrade = f"{title_progress['title']}已达成，继续积累可进入下一进阶。"
    return {
        "title": title_progress["title"],
        "next_title": title_progress["next_title"],
        "title_progress": title_progress,
        "department_levels": departments,
        "latest_reports": latest_reports,
        "next_upgrade": next_upgrade,
    }


def _build_chaotang_experience_evaluation(
    account_summary: dict,
    ledger: dict,
    uiux_summary: dict,
    business_summary: dict,
    yushi_summary: dict,
) -> dict:
    event_count = int(ledger.get("event_count", 0) or 0)
    title = account_summary.get("title", "勤政之主")
    red_black = int(yushi_summary.get("red", 0) or 0) + int(
        yushi_summary.get("black", 0) or 0
    )
    uiux_passed = int(uiux_summary.get("passed", 0) or 0)
    uiux_cases = int(uiux_summary.get("cases", 0) or 0)
    cash_flow_score = int(business_summary.get("cash_flow_score", 0) or 0)
    score = 72
    score += min(event_count, 5) * 4
    score += 8 if uiux_passed and uiux_passed >= uiux_cases else 0
    score += 8 if cash_flow_score >= 90 else 0
    score -= min(red_black * 6, 18)
    score = max(0, min(score, 100))
    if score >= 90:
        grade = "A"
        verdict = "已形成可复用的主线闭环，适合继续做真实用户验证。"
    elif score >= 82:
        grade = "A-"
        verdict = "方向正确，需继续压缩首次上手成本和强化用户反馈。"
    elif score >= 75:
        grade = "B+"
        verdict = "骨架可用，但还需要更多真实任务和用户证据。"
    else:
        grade = "B"
        verdict = "先补闭环证据，再扩展美术或商业能力。"
    advisor_panel = [
        {
            "advisor": "产品大神",
            "score": grade,
            "advice": "首页只保留一个明确动作：今日上奏；成长、评估和教学都服务这个动作。",
        },
        {
            "advisor": "美工大神",
            "score": "A-" if uiux_passed else "B+",
            "advice": "朝堂视觉要像公文仪器：克制、清楚、有秩序，宫廷感只做信息架构。",
        },
        {
            "advisor": "质量大神",
            "score": "A-" if event_count else "B",
            "advice": "所有爽感必须能对账到二审、史馆、ledger，不能只靠前端文案制造成就感。",
        },
    ]
    user_segments = [
        {
            "segment": "企业家",
            "excitement": "知道下一步该点什么",
            "suggestion": "默认只看今日上奏、下一步和钦天监伴读。",
            "next_action": "开始朝议",
        },
        {
            "segment": "AI 爱好者",
            "excitement": "理解御史规则和复用模板",
            "suggestion": "展开战报、证据、风险、功业和史馆学习，形成可复用打法。",
            "next_action": "保存为模板",
        },
        {
            "segment": "AI 极客",
            "excitement": "能追踪 payload、harness、eval、ledger",
            "suggestion": "查看状态合同和 golden gate，验证每个结果可复盘。",
            "next_action": "检查 ledger",
        },
    ]
    next_best_action = (
        account_summary.get("next_upgrade")
        if event_count
        else "先完成第一条二审通过成果，让功业、称号和部门等级真实入账。"
    )
    return {
        "grade": grade,
        "score": score,
        "verdict": verdict,
        "next_best_action": next_best_action,
        "advisor_panel": advisor_panel,
        "user_segments": user_segments,
        "quality_gates": [
            "任务必须先路由再执行",
            "御史二审通过才发功业",
            "称号不可购买或跳级",
            "史馆归档后才能成为学习样本",
        ],
    }


def _load_chaotang_ui_ledger() -> dict:
    path = _chaotang_ui_ledger_path()
    total_merit = {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0}
    latest: dict | None = None
    count = 0
    events: list[dict] = []
    if not path.exists():
        ledger = {
            "event_count": 0,
            "total_merit": total_merit,
            "latest": None,
            "events": [],
        }
        ledger["account_summary"] = _build_chaotang_account_summary(ledger)
        return ledger
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        count += 1
        latest = event
        events.append(event)
        merit = event.get("merit") or {}
        for key in total_merit:
            total_merit[key] += int(merit.get(key, 0) or 0)
    ledger = {
        "event_count": count,
        "total_merit": total_merit,
        "latest": latest,
        "events": events[-10:],
    }
    ledger["account_summary"] = _build_chaotang_account_summary(ledger)
    return ledger


@app.get("/chaotang-ui/state", include_in_schema=False)
def chaotang_ui_state() -> dict:
    merit = _read_json_artifact("harness/chaotang_merit_system/artifacts/latest.json")
    business = _read_json_artifact(
        "harness/chaotang_business_model/artifacts/latest.json"
    )
    uiux = _read_json_artifact("harness/chaotang_uiux_system/artifacts/latest.json")
    yushi_gate = _read_json_artifact("harness/yushi_global_gate/artifacts/latest.json")
    runtime_ledger = _load_chaotang_ui_ledger()

    report = _select_merit_report(merit)
    uiux_summary = uiux.get("summary", {})
    business_summary = business.get("summary", {})
    yushi_summary = yushi_gate.get("summary", {})
    experience_evaluation = _build_chaotang_experience_evaluation(
        runtime_ledger["account_summary"],
        runtime_ledger,
        uiux_summary,
        business_summary,
        yushi_summary,
    )
    offer = report.get("commercial_offer") or {
        "capability": "yushi_deep_review",
        "currency": "chaobi",
        "amount": 180,
        "visible_feedback": "御史深审可发现隐藏交互风险。",
        "next_action": "confirm_optional_upgrade",
        "principle": "付费增强能力，不影响评分、称号、御史通过或史馆事实。",
    }
    merit_awarded = report.get("merit_awarded") or {
        "gongji": 0,
        "mingcha": 0,
        "jinglue": 0,
        "weiwang": 0,
    }
    yushi_decision = report.get("yushi_verdict") or "allow"
    if yushi_decision not in {"allow", "allow_with_conditions", "block"}:
        yushi_decision = "allow"

    return {
        "success": True,
        "data": {
            "weather": {
                "label": "朝堂气象：稳" if uiux.get("passed") else "朝堂气象：待审",
                "summary": (
                    f"UIUX {uiux_summary.get('valid', 0)} 个 L5 候选，"
                    f"御史红黑 {yushi_summary.get('red', 0) + yushi_summary.get('black', 0)} 项。"
                ),
                "chips": [
                    f"钦天监：方向清楚",
                    f"御史：{yushi_summary.get('green', 0)} 绿 / {yushi_summary.get('red', 0)} 红",
                    f"史馆：{len(merit.get('results', []))} 条功业记录",
                    f"工部：UIUX {uiux_summary.get('passed', 0)}/{uiux_summary.get('cases', 0)}",
                ],
            },
            "battle_report": {
                "title": "任务已成，御史已核，史馆可归档",
                "summary": (
                    "本次页面设计满足 5 秒测试，并已接入功业、商业、御史和 UIUX 证据。"
                ),
                "score": round(float(report.get("final_score", 91)), 1),
                "grade": report.get("grade", "圣裁"),
                "user_title": report.get("user_title", "勤政之主"),
                "department": report.get("department", "gongbu"),
                "department_title": report.get("department_title", "主事"),
                "merit": merit_awarded,
                "unlocks": report.get("unlocks", []),
            },
            "yushi": {
                "decision": yushi_decision,
                "verdict": "未发现主线偏移。商业增强为可选能力，不影响评分、称号或御史通过。",
                "conditions": report.get("conditions", []),
                "red_team_required": yushi_summary.get("red", 0)
                + yushi_summary.get("black", 0)
                > 0,
            },
            "shiguan": {
                "recommendation": "保存为“朝堂战报首版模板”，后续所有页面先过 UI/UX harness。",
                "archive_candidates": [
                    "朝堂 UI/UX 系统报告",
                    "商业模式圆桌报告",
                    "功业系统报告",
                ],
                "learning": "后续页面默认先做 5 秒测试，再做美术扩展。",
            },
            "commercial_offer": offer,
            "business": {
                "cash_flow_score": business_summary.get("cash_flow_score", 0),
                "investor_ready": bool(business_summary.get("investor_ready")),
                "headline": business.get("investor_headline", ""),
            },
            "sources": {
                "merit": merit.get("generated_at"),
                "business": business.get("generated_at"),
                "uiux": uiux.get("generated_at"),
                "yushi": yushi_gate.get("generated_at"),
            },
            "runtime_ledger": runtime_ledger,
            "experience_evaluation": experience_evaluation,
        },
    }


@app.get("/chaotang-ui/department-system", include_in_schema=False)
def chaotang_ui_department_system() -> dict:
    from src.chaotang_department_router import department_system_payload

    return {"success": True, "data": department_system_payload()}


@app.post("/chaotang-ui/prime-minister-draft", include_in_schema=False)
def chaotang_ui_prime_minister_draft(body: _ChaotangPrimeMinisterDraftRequest) -> dict:
    task = (body.task or "").strip()
    if not task:
        return {"success": False, "error": "task 不能为空"}
    return {
        "success": True,
        "data": _prime_minister_draft(
            task,
            body.mode,
            body.emperor_style,
            body.depth,
        ),
    }


@app.post("/chaotang-ui/memorial", include_in_schema=False)
def chaotang_ui_memorial(body: _ChaotangMemorialRequest) -> dict:
    task = (body.task or "").strip()
    if not task:
        return {"success": False, "error": "task 不能为空"}

    from src.chaotang_department_router import (
        build_genius_experience_modules,
        route_department_task,
    )

    route = route_department_task(task)
    primary = route["primaryDepartment"]
    swarms = primary.get("callsSwarms") or ["ai_ops"]
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    memorial = {
        "id": _memorial_id(task),
        "task": task,
        "status": "routed",
        "created_at": now,
        "owner": primary["code"],
        "owner_name": primary["name"],
    }
    matched = "、".join(primary.get("matchedKeywords") or ["主线任务"])
    evidence = [
        f"命中关键词：{matched}",
        f"钦天监触发：{route['qintianjianTrigger']['signal']}",
        f"御史规则：{route['yushiGateHint']}",
    ]
    work_order = {
        "department": primary["code"],
        "department_name": primary["name"],
        "swarm": swarms[0],
        "next_action": route["nextAction"],
        "evidence": evidence,
        "qintianjian_trigger": route["qintianjianTrigger"],
        "yushi_gate_hint": route["yushiGateHint"],
        "archive_target": "shiguan_archive",
    }
    battle_report_preview = {
        "title": f"{primary['name']}已接旨，等待第一版证据",
        "score": 68 + min(int(primary.get("score", 0)) * 8, 24),
        "grade": "待审",
        "merit": {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0},
        "summary": f"{primary['name']}先调用 {work_order['swarm']} 蜂群形成证据，再进御史和史馆。",
        "yushi_verdict": "未执行蜂群前不授予功业；需补证据后再评分、归档或升级。",
        "commercial_offer": "待审阶段先补证据，不推荐付费增强；付费能力不影响评分、称号、御史通过或史馆事实。",
    }
    return {
        "success": True,
        "data": {
            "memorial": memorial,
            "route": route,
            "work_order": work_order,
            "battle_report_preview": battle_report_preview,
            "genius_experience_modules": build_genius_experience_modules(
                primary["code"], task, swarms
            ),
        },
    }


@app.post("/chaotang-ui/yushi-review", include_in_schema=False)
def chaotang_ui_yushi_review(body: _ChaotangYushiReviewRequest) -> dict:
    evidence = [item.strip() for item in body.evidence if item and item.strip()]
    task = (body.task or "").strip()
    department = (body.department or "").strip() or "unknown"
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if not task or len(evidence) < 2:
        review = {
            "review_id": f"yushi-{sha1((body.memorial_id + now).encode('utf-8')).hexdigest()[:10]}",
            "memorial_id": body.memorial_id,
            "decision": "block",
            "risk_level": "red",
            "archive_ready": False,
            "merit_awardable": False,
            "verdict": "证据不足，御史阻断：先补任务来源、部门路由和钦天监触发条件。",
            "conditions": [
                "补齐至少两条可解释证据。",
                "确认钦天监触发条件和御史规则。",
            ],
            "next_action": "回到军机处补证据",
            "reviewed_at": now,
        }
        battle_report_update = {
            "title": "御史阻断，等待补证",
            "score": 0,
            "grade": "御史驳回",
            "summary": review["verdict"],
            "merit": {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0},
        }
    else:
        review = {
            "review_id": f"yushi-{sha1((body.memorial_id + now).encode('utf-8')).hexdigest()[:10]}",
            "memorial_id": body.memorial_id,
            "decision": "allow_with_conditions",
            "risk_level": "yellow",
            "archive_ready": True,
            "merit_awardable": False,
            "verdict": "御史准予归档路由记录；未执行蜂群，不发放功业、称号或评分奖励。",
            "conditions": [
                "只能归档为路由证据，不可包装为已完成成果。",
                body.yushi_gate_hint or "后续红黑风险仍需御史复核。",
            ],
            "next_action": "归档史馆路由记录",
            "reviewed_at": now,
        }
        battle_report_update = {
            "title": f"{_department_label(department)}路由已过御史，可归档史馆",
            "score": 76,
            "grade": "御史准归档",
            "summary": review["verdict"],
            "merit": {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0},
        }
    return {
        "success": True,
        "data": {
            "yushi_review": review,
            "battle_report_update": battle_report_update,
        },
    }


@app.post("/chaotang-ui/shiguan-archive", include_in_schema=False)
def chaotang_ui_shiguan_archive(body: _ChaotangShiguanArchiveRequest) -> dict:
    task = (body.task or "").strip()
    department = (body.department or "").strip() or "unknown"
    if not body.archive_ready:
        return {"success": False, "error": "御史未准归档，不能进入史馆"}
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    archive_seed = "|".join([body.memorial_id, body.yushi_review_id, task, department])
    archive_id = f"shiguan-{sha1(archive_seed.encode('utf-8')).hexdigest()[:12]}"
    archive = {
        "archive_id": archive_id,
        "memorial_id": body.memorial_id,
        "yushi_review_id": body.yushi_review_id,
        "status": "archived",
        "record_type": "route_record",
        "department": department,
        "department_name": _department_label(department),
        "task": task,
        "archived_at": now,
        "merit_awardable": bool(body.merit_awardable),
        "learning": "这是一条已过御史的路由记录，不发功业；后续真实执行成果需二审后再发奖。",
        "next_action": "等待蜂群真实执行后生成成果战报",
    }
    return {
        "success": True,
        "data": {
            "archive": archive,
            "battle_report_update": {
                "title": f"{_department_label(department)}路由记录已入史馆",
                "score": 76,
                "grade": "史馆已归档",
                "summary": archive["learning"],
                "merit": {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0},
            },
        },
    }


@app.post("/chaotang-ui/swarm-execute", include_in_schema=False)
def chaotang_ui_swarm_execute(body: _ChaotangSwarmExecuteRequest) -> dict:
    task = (body.task or "").strip()
    department = (body.department or "").strip() or "unknown"
    if body.archive_status != "archived":
        return {"success": False, "error": "史馆未归档，不能执行蜂群"}
    if not task:
        return {"success": False, "error": "task 不能为空"}
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    from src.chaotang_department_router import (
        build_genius_experience_modules,
        build_swarm_execution_trace,
        load_department_config,
    )

    department_config = load_department_config()
    swarms = (
        department_config.get("six_ministries", {})
        .get(department, {})
        .get("calls_swarms", [])
    )
    outcome_seed = "|".join([body.archive_id, task, department, now[:10]])
    outcome_id = f"outcome-{sha1(outcome_seed.encode('utf-8')).hexdigest()[:12]}"
    department_name = _department_label(department)
    evidence = [
        f"{department_name}已读取史馆路由记录 {body.archive_id}",
        "模拟蜂群已生成风险清单、复用模板建议和御史二审请求",
        "本次执行未调用真实模型，不产生外部成本或不可逆动作",
    ]
    outcome = {
        "outcome_id": outcome_id,
        "archive_id": body.archive_id,
        "status": "executed_simulated",
        "record_type": "outcome_record",
        "department": department,
        "department_name": department_name,
        "task": task,
        "executed_at": now,
        "score": 84,
        "grade": "成果待二审",
        "evidence": evidence,
        "execution_trace": build_swarm_execution_trace(department, task, swarms),
        "genius_experience_modules": build_genius_experience_modules(
            department, task, swarms
        ),
        "findings": [
            "商业增强入口需要继续保持非主按钮。",
            "所有付费能力必须显示不影响评分、称号、御史通过或史馆事实。",
            "成果战报可以复用为后续 UIUX 页面验收模板。",
        ],
        "next_action": "提交御史二审",
        "yushi_second_review_required": True,
        "merit_awardable": False,
    }
    return {
        "success": True,
        "data": {
            "outcome": outcome,
            "battle_report_update": {
                "title": f"{department_name}模拟执行完成，等待御史二审",
                "score": outcome["score"],
                "grade": outcome["grade"],
                "summary": "模拟蜂群已产出成果证据；二审前不发功业，避免把未经核验的成果包装成完成。",
                "merit": {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0},
            },
        },
    }


@app.post("/chaotang-ui/yushi-second-review", include_in_schema=False)
def chaotang_ui_yushi_second_review(body: _ChaotangYushiSecondReviewRequest) -> dict:
    evidence = [item.strip() for item in body.evidence if item and item.strip()]
    findings = [item.strip() for item in body.findings if item and item.strip()]
    task = (body.task or "").strip()
    department = (body.department or "").strip() or "unknown"
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if body.status != "executed_simulated" or len(evidence) < 3 or not task:
        second_review = {
            "review_id": f"yushi2-{sha1((body.outcome_id + now).encode('utf-8')).hexdigest()[:10]}",
            "outcome_id": body.outcome_id,
            "decision": "block",
            "risk_level": "red",
            "merit_awardable": False,
            "title_awardable": False,
            "verdict": "成果证据不足或尚未执行，御史二审阻断。",
            "conditions": ["补齐执行状态、三条以上证据和可复盘发现项。"],
            "next_action": "回到蜂群执行补证据",
            "reviewed_at": now,
        }
        battle_report_update = {
            "title": "御史二审阻断，等待补证",
            "score": 0,
            "grade": "二审驳回",
            "summary": second_review["verdict"],
            "merit": {"gongji": 0, "mingcha": 0, "jinglue": 0, "weiwang": 0},
        }
    else:
        merit = {"gongji": 42, "mingcha": 18, "jinglue": 24, "weiwang": 6}
        second_review = {
            "review_id": f"yushi2-{sha1((body.outcome_id + now).encode('utf-8')).hexdigest()[:10]}",
            "outcome_id": body.outcome_id,
            "decision": "allow_merit",
            "risk_level": "green",
            "merit_awardable": True,
            "title_awardable": False,
            "verdict": "御史二审通过：成果证据可复盘，准发功业；称号仍需功业系统累计判定，不能直接购买或跳级。",
            "conditions": [
                "本次只发放功业，不直接授予称号。",
                "商业增强不得影响评分、称号、御史通过或史馆事实。",
            ],
            "next_action": "发放功业并归档成果战报",
            "reviewed_at": now,
        }
        battle_report_update = {
            "title": f"{_department_label(department)}成果二审通过，功业已发放",
            "score": 91,
            "grade": "圣裁",
            "summary": second_review["verdict"],
            "merit": merit,
            "findings": findings,
        }
        _append_chaotang_ui_ledger(
            {
                "event_type": "chaotang_ui_merit_awarded",
                "outcome_id": body.outcome_id,
                "archive_id": body.archive_id,
                "department": department,
                "department_name": _department_label(department),
                "task": task,
                "score": battle_report_update["score"],
                "grade": battle_report_update["grade"],
                "merit": merit,
                "review_id": second_review["review_id"],
                "recorded_at": now,
                "title_awardable": second_review["title_awardable"],
            }
        )
    return {
        "success": True,
        "data": {
            "second_review": second_review,
            "battle_report_update": battle_report_update,
        },
    }


# ── 本地启动入口（python -m web.main）─────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("FENGQUN_WEB_PORT", "8081"))
    uvicorn.run(
        "web.main:app",
        host="127.0.0.1",
        port=port,
        reload=os.environ.get("FENGQUN_RELOAD", "false").lower()
        in ("1", "true", "yes"),
    )
