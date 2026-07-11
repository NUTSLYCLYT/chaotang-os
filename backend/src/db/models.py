"""src/db/models.py — SQLAlchemy ORM 模型。

5 张新表:decrees / tasks / memorials / reviews / retrospectives。
不涉及现有 tenants/users 表(由 src/tenant.py sqlite3 原生管理)。

字段命名约定:
  - DB 列名: snake_case
  - JSON 列名后缀: _json (TEXT,Python 层 json.dumps/loads)
  - 时间戳: TEXT ISO-8601(SQLite);迁 Postgres 后可 ALTER→TIMESTAMP WITH TIME ZONE
  - tenant_id: INTEGER,逻辑 FK → tenants.id(不加 SA FK 约束,避免与原生 sqlite3 冲突)

MemorialStatus 值域(KP-7 全链路枚举):
  pending | running | approved | archived | rejected
"""

from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Base(DeclarativeBase):
    pass


# ── decrees ───────────────────────────────────────────────────────────────


class Decree(Base):
    """下旨记录。decree_id 与 tasks.task_id 共用同一 8 字节 hex 串(D16①)。"""

    __tablename__ = "decrees"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    decree_id: Mapped[str] = mapped_column(sa.Text, unique=True, nullable=False)
    tenant_id: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    # 逻辑 FK → users.id;nullable 因 FENGQUN_AUTH=false 时无鉴权用户
    user_id: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    raw_command: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    intent: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    task_type: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    # JSON 列:存 list[str]
    ministers_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    groups_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_decrees_decree_id", "decree_id"),
        sa.Index("ix_decrees_tenant_created", "tenant_id", "created_at"),
    )


# ── tasks ─────────────────────────────────────────────────────────────────


class Task(Base):
    """任务执行记录。双写:内存 task_registry(SSE)+ 此表(持久化)。"""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(sa.Text, unique=True, nullable=False)
    # 逻辑 FK → decrees.decree_id
    decree_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    tenant_id: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    # 内部运行态:running | done | error
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="running")
    # 前端展示态:running | report_ready | failed | archived
    task_status: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    task_input: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    flow_name: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    # 关联 RunLog.run_id(JSON 目录键)
    run_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    # JSON 列:存 list[str] dept slug
    departments_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    total_steps: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    completed_steps: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    started_at: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    finished_at: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    error: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    result_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    # 阶段标记:dispatched | running | report_ready | reviewed | archived
    last_stage: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    updated_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_tasks_task_id", "task_id"),
        sa.Index("ix_tasks_tenant_status", "tenant_id", "status"),
        sa.Index("ix_tasks_run_id", "run_id"),
    )


# ── memorials ─────────────────────────────────────────────────────────────


class Memorial(Base):
    """奏折索引表(Run JSON 文件保留;此表存结构化摘要+索引字段)。

    status 值域(KP-7):pending | running | approved | archived | rejected
    """

    __tablename__ = "memorials"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    # = run_id(RunLog 目录键)
    memorial_id: Mapped[str] = mapped_column(sa.Text, unique=True, nullable=False)
    tenant_id: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    # 逻辑 FK → tasks.task_id
    task_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    source_department: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    agent_code: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    priority: Mapped[str] = mapped_column(sa.Text, nullable=False, default="medium")
    # MemorialStatus 值域(KP-7 全链路枚举)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="running")
    summary: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    updated_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_memorials_memorial_id", "memorial_id"),
        sa.Index("ix_memorials_tenant_status", "tenant_id", "status"),
        sa.Index("ix_memorials_tenant_dept", "tenant_id", "source_department"),
        sa.Index("ix_memorials_created_at", "created_at"),
    )


# ── reviews ───────────────────────────────────────────────────────────────


class Review(Base):
    """裁决记录。双写:JSON 文件(兜底)+ 此表(优先读)。

    save_review() 写此表时同步 UPDATE memorials.status(KP-7 action→status 映射):
      approve → archived
      reject  → rejected
      inquire → pending
    """

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    # 原 chaotang_store 中的 review_{datetime}_{hex}
    review_id: Mapped[str] = mapped_column(sa.Text, unique=True, nullable=False)
    memorial_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    tenant_id: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    # approve | reject | inquire
    action: Mapped[str] = mapped_column(sa.Text, nullable=False)
    comment: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    reviewer_name: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_reviews_memorial_id", "memorial_id"),
        sa.Index("ix_reviews_tenant_created", "tenant_id", "created_at"),
    )


# ── retrospectives ────────────────────────────────────────────────────────


class Retrospective(Base):
    """任务复盘。双写:JSON 文件(兜底)+ 此表(优先读)。"""

    __tablename__ = "retrospectives"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(sa.Text, unique=True, nullable=False)
    tenant_id: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    score: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=3)
    # JSON 列:存 list[str]
    successes_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    failures_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    lessons_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    playbook: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    authored_by: Mapped[str] = mapped_column(sa.Text, nullable=False, default="史官")
    authored_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    # 0=真实复盘, 1=系统合成兜底
    synthetic: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    # 简单三态结果:success/blocked/pending。真实存储字段,不由 score/failures 派生
    # (2026-07-10:score/failures 是否为空都不能可靠推出三态,见 004 迁移注释)。
    outcome: Mapped[str] = mapped_column(sa.Text, nullable=False, default="pending")

    __table_args__ = (sa.Index("ix_retrospectives_task_id", "task_id"),)


# ── shangshufang decision loop ─────────────────────────────────────────────


class DecisionTask(Base):
    """上书房决策任务：一句话原问 → 丞相拟旨 → 皇上确认 → 军机处会审。"""

    __tablename__ = "decision_tasks"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    user_id: Mapped[str] = mapped_column(sa.Text, nullable=False, default="anonymous")
    raw_question: Mapped[str] = mapped_column(sa.Text, nullable=False)
    refined_edict: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    decision_type: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="draft")
    source_label: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="FALLBACK"
    )
    risk_flags_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    known_facts_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    unknown_gaps_json: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="[]"
    )
    recommended_departments_json: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="[]"
    )
    draft_edict_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    updated_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_decision_tasks_status_created", "status", "created_at"),
        sa.Index("ix_decision_tasks_user_updated", "user_id", "updated_at"),
    )


class CourtLoopRun(Base):
    """上书房 loop 运行记录，记录每次拟旨/确认/归档的输入输出。"""

    __tablename__ = "court_loop_runs"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    loop_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False)
    input_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="{}")
    output_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    error: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    trace_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    updated_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_court_loop_runs_task_created", "task_id", "created_at"),
    )


class AgentSkillRun(Base):
    """单个 skill 的可追溯运行记录。第一版用于丞相拟旨 deterministic skill。"""

    __tablename__ = "agent_skill_runs"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    skill_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    skill_version: Mapped[str] = mapped_column(sa.Text, nullable=False)
    input_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="{}")
    output_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="{}")
    source_label: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="FALLBACK"
    )
    eval_score: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_agent_skill_runs_task_skill", "task_id", "skill_id"),
    )


class CourtReview(Base):
    """军机处会审任务壳。第一版先持久化状态和路由计划。"""

    __tablename__ = "court_reviews"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    routing_plan_json: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="{}"
    )
    review_status: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="reviewing"
    )
    ministry_outputs_json: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="[]"
    )
    conflict_summary_json: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="[]"
    )
    memorial_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    updated_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_court_reviews_task_status", "task_id", "review_status"),
    )


class EmperorDecision(Base):
    """皇上裁决记录。"""

    __tablename__ = "emperor_decisions"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    action: Mapped[str] = mapped_column(sa.Text, nullable=False)
    reason: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    human_confirmed: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=False
    )
    confirmation_record_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_emperor_decisions_task_created", "task_id", "created_at"),
    )


class ShiguanArchive(Base):
    """史馆归档记录：保存任务、拟旨、回奏、裁决、证据链和来源标签。"""

    __tablename__ = "shiguan_archives"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    raw_question: Mapped[str] = mapped_column(sa.Text, nullable=False)
    refined_edict: Mapped[str] = mapped_column(sa.Text, nullable=False)
    final_memorial_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    emperor_decision_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    evidence_chain_json: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="[]"
    )
    source_label: Mapped[str] = mapped_column(sa.Text, nullable=False)
    synthetic_flag: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=False
    )
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_shiguan_archives_task_created", "task_id", "created_at"),
    )


# ── admin 可编辑部门管理 ────────────────────────────────────────────────────


class Department(Base):
    """admin 可编辑部门。按 tenant_id 隔离（逻辑 FK → tenants.id）。

    与 harness/chaotang_department_protocol/departments.yaml 的静态花名册（按 code
    只读）不同：这是前端 admin/jiqun-depts 页可增删改、按数字 id、可挂 flow 的动态部门。
    """

    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "name", name="uq_departments_tenant_name"),
        sa.Index("ix_departments_tenant", "tenant_id"),
    )


class DepartmentFlow(Base):
    """部门 ↔ flow 挂载。flow_id = config/flow_*.yaml 的文件名 stem。"""

    __tablename__ = "department_flows"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    # 逻辑 FK → departments.id
    dept_id: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    flow_id: Mapped[str] = mapped_column(sa.Text, nullable=False)

    __table_args__ = (
        sa.UniqueConstraint("dept_id", "flow_id", name="uq_department_flows_dept_flow"),
        sa.Index("ix_department_flows_dept", "dept_id"),
    )


class UserDepartment(Base):
    """用户 ↔ 部门授权。user_id 逻辑 FK → users.id（src.tenant 原生 sqlite3 管理）。"""

    __tablename__ = "user_departments"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    # 逻辑 FK → departments.id
    dept_id: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    __table_args__ = (
        sa.UniqueConstraint("user_id", "dept_id", name="uq_user_departments_user_dept"),
        sa.Index("ix_user_departments_user", "user_id"),
        sa.Index("ix_user_departments_dept", "dept_id"),
    )


# ── swarm execution loop ──────────────────────────────────────────────────


class SwarmRun(Base):
    """军机处后台蜂群产线运行记录。

    第一版用于保存规则路由 + mock 专业蜂群输出；真实后端蜂群接入后沿用同一
    run/trace 形状，只有 source_label 才能升级为 LIVE_SWARM。
    """

    __tablename__ = "swarm_runs"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    review_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    mode: Mapped[str] = mapped_column(sa.Text, nullable=False, default="standard")
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="completed")
    source_label: Mapped[str] = mapped_column(sa.Text, nullable=False, default="MIXED")
    route_plan_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="{}")
    trace_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    started_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    finished_at: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    error: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    __table_args__ = (
        sa.Index("ix_swarm_runs_task_created", "task_id", "started_at"),
        sa.Index("ix_swarm_runs_review_status", "review_id", "status"),
    )


class SwarmTaskRun(Base):
    """单个后台蜂群的结构化输出。"""

    __tablename__ = "swarm_task_runs"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    swarm_run_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    swarm_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    role: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="completed")
    input_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="{}")
    output_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    source_label: Mapped[str] = mapped_column(sa.Text, nullable=False, default="MIXED")
    confidence: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    started_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    finished_at: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    error: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    __table_args__ = (
        sa.Index("ix_swarm_task_runs_run_swarm", "swarm_run_id", "swarm_id"),
    )


class SwarmEvidenceLink(Base):
    """蜂群结论与证据/缺口的可追溯链接。"""

    __tablename__ = "swarm_evidence_links"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    swarm_run_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    swarm_task_run_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    claim: Mapped[str] = mapped_column(sa.Text, nullable=False)
    evidence_source_type: Mapped[str] = mapped_column(sa.Text, nullable=False)
    evidence_ref: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    confidence: Mapped[str] = mapped_column(sa.Text, nullable=False, default="中")
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (sa.Index("ix_swarm_evidence_run", "swarm_run_id"),)


class SwarmQualityResult(Base):
    """蜂群质门结果。"""

    __tablename__ = "swarm_quality_results"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    swarm_run_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    passed: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    blocking_reasons_json: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="[]"
    )
    warnings_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="[]")
    revised_output_json: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_swarm_quality_run_created", "swarm_run_id", "created_at"),
    )


# ── super-chancellor routing (阶段1) ────────────────────────────────────────
# 见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第7.1/9节。


class ChancellorRouteDecision(Base):
    """不可变路由快照。每次下旨生成一份；改道走 supersedes_decision_id 指向旧快照，
    旧记录不删(审计要求)。decision_json 是 RouteDecisionV2 的完整序列化，
    其余列是供索引/查询用的冗余字段，事实源仍是 decision_json。"""

    __tablename__ = "chancellor_route_decisions"

    decision_id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(sa.Text, nullable=False)
    mode: Mapped[str] = mapped_column(sa.Text, nullable=False)
    primary_department: Mapped[str] = mapped_column(sa.Text, nullable=False)
    source_label: Mapped[str] = mapped_column(sa.Text, nullable=False)
    supersedes_decision_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    decision_json: Mapped[str] = mapped_column(sa.Text, nullable=False)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_chancellor_route_decisions_task_created", "task_id", "created_at"),
        sa.UniqueConstraint(
            "task_id", "idempotency_key", name="uq_chancellor_route_task_idem"
        ),
    )


class OutboxEvent(Base):
    """事务性 outbox(阶段2)。confirm-edict 在同一 DB 事务里写下旨记录+路由快照
    +本行；事务提交后由 dispatch_after_commit 触发消费。status 流转：
    pending → processing → completed | failed(attempts<max_attempts 时保留可重试)
    | dead_letter(达到 max_attempts)。"""

    __tablename__ = "outbox_events"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    decision_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    event_type: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=3)
    last_error: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    payload_json: Mapped[str] = mapped_column(sa.Text, nullable=False, default="{}")
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    updated_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_outbox_events_status_created", "status", "created_at"),
        sa.Index("ix_outbox_events_task", "task_id"),
    )


class DecreeExecutionEvent(Base):
    """状态时间线(阶段2b，方案9节 decree_execution_events)。每次状态变化写一行事件，
    不只覆盖主表字段——DecreeExecutionStatusV1.timeline 从这张表拼。"""

    __tablename__ = "decree_execution_events"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    stage: Mapped[str] = mapped_column(sa.Text, nullable=False)
    actor: Mapped[str] = mapped_column(sa.Text, nullable=False)
    message: Mapped[str] = mapped_column(sa.Text, nullable=False)
    occurred_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_decree_execution_events_task_occurred", "task_id", "occurred_at"),
    )


class BuildLedgerEntry(Base):
    """运营闭环构建台账(2026-07-11 补齐)。frontend/src/features/operating-loop/
    lib/build-ledger.ts 调用的 /api/court/build-ledger 一直是死链——前端曾有一份
    Node fs 版本(build-ledger-store.ts)，随"前端 BFF 退休"一起变成孤儿代码，
    这里在后端用真实数据库表重新实现同一份契约。"""

    __tablename__ = "build_ledger_entries"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, default="dispatched")
    entry_json: Mapped[str] = mapped_column(sa.Text, nullable=False)
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)
    updated_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_build_ledger_entries_task", "task_id"),
        sa.Index("ix_build_ledger_entries_created", "created_at"),
    )


class BuildLedgerAuditEvent(Base):
    __tablename__ = "build_ledger_audit_events"

    id: Mapped[str] = mapped_column(sa.Text, primary_key=True)
    task_id: Mapped[str] = mapped_column(sa.Text, nullable=False)
    actor: Mapped[str] = mapped_column(sa.Text, nullable=False)
    action: Mapped[str] = mapped_column(sa.Text, nullable=False)
    from_status: Mapped[str] = mapped_column(sa.Text, nullable=False)
    to_status: Mapped[str] = mapped_column(sa.Text, nullable=False)
    note: Mapped[str] = mapped_column(sa.Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(sa.Text, nullable=False, default=_now_iso)

    __table_args__ = (
        sa.Index("ix_build_ledger_audit_task", "task_id"),
    )
