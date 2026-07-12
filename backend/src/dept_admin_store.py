"""src/dept_admin_store.py — admin 可编辑部门 / 部门↔flow / 用户↔部门 持久化。

支撑前端 chaotang-web-lyt 的 admin/jiqun-depts 管理页（经 /api/jiqun 代理打本后端
/api/admin/depts*）。三张表见 src/db/models.py: Department / DepartmentFlow /
UserDepartment，迁移见 alembic/versions/003_dept_admin_tables.py。

约定（与现有 5 张 flow 表一致）：
  - 部门按 tenant_id 隔离（逻辑 FK → tenants.id，不加 SA 约束）。
  - user_id 逻辑 FK → users.id（由 src.tenant 原生 sqlite3 管理，故不加 SA FK）。
  - flow 标识用 config/flow_*.yaml 的文件名 stem（如 "flow_finance"）。
"""
from __future__ import annotations

import importlib
from pathlib import Path

import sqlalchemy as sa

from src.db.models import Department, DepartmentFlow, UserDepartment

_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def _session():
    """动态取 SessionLocal（经 src.db.engine 模块属性，使测试 monkeypatch 生效）。

    注意：不能 `import src.db.engine as x` —— src/db/__init__.py 用
    `from src.db.engine import engine` 把包属性 engine 覆盖成了 Engine 实例。
    """
    return importlib.import_module("src.db.engine").SessionLocal()


# ── tenant 解析 ─────────────────────────────────────────────────────────────

def _current_tenant_id() -> int:
    """当前线程租户 slug → tenants.id；查不到回退默认租户 1。"""
    from src.tenant import resolve_current_tenant_id

    return resolve_current_tenant_id()


# ── 部门 CRUD ───────────────────────────────────────────────────────────────

def list_departments(tenant_id: int | None = None) -> list[dict]:
    tid = tenant_id if tenant_id is not None else _current_tenant_id()
    with _session() as db:
        rows = db.scalars(
            sa.select(Department)
            .where(Department.tenant_id == tid)
            .order_by(Department.name)
        ).all()
        return [
            {"id": d.id, "name": d.name, "created_at": d.created_at}
            for d in rows
        ]


def create_department(name: str, tenant_id: int | None = None) -> dict:
    name = name.strip()
    if not name:
        raise ValueError("部门名不能为空")
    tid = tenant_id if tenant_id is not None else _current_tenant_id()
    with _session() as db:
        exists = db.scalar(
            sa.select(Department.id).where(
                Department.tenant_id == tid, Department.name == name
            )
        )
        if exists:
            raise ValueError(f"部门已存在: {name}")
        dept = Department(tenant_id=tid, name=name)
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return {"id": dept.id, "name": dept.name, "created_at": dept.created_at}


def rename_department(
    dept_id: int, name: str, tenant_id: int | None = None
) -> dict | None:
    name = name.strip()
    if not name:
        raise ValueError("部门名不能为空")
    tid = tenant_id if tenant_id is not None else _current_tenant_id()
    with _session() as db:
        dept = db.scalar(
            sa.select(Department).where(
                Department.id == dept_id, Department.tenant_id == tid
            )
        )
        if dept is None:
            return None
        clash = db.scalar(
            sa.select(Department.id).where(
                Department.tenant_id == tid,
                Department.name == name,
                Department.id != dept_id,
            )
        )
        if clash:
            raise ValueError(f"部门已存在: {name}")
        dept.name = name
        db.commit()
        db.refresh(dept)
        return {"id": dept.id, "name": dept.name, "created_at": dept.created_at}


def delete_department(dept_id: int, tenant_id: int | None = None) -> bool:
    tid = tenant_id if tenant_id is not None else _current_tenant_id()
    with _session() as db:
        dept = db.scalar(
            sa.select(Department).where(
                Department.id == dept_id, Department.tenant_id == tid
            )
        )
        if dept is None:
            return False
        # 级联清理关联（逻辑外键，手动删）
        db.execute(
            sa.delete(DepartmentFlow).where(DepartmentFlow.dept_id == dept_id)
        )
        db.execute(
            sa.delete(UserDepartment).where(UserDepartment.dept_id == dept_id)
        )
        db.delete(dept)
        db.commit()
        return True


def _dept_exists(db, dept_id: int, tid: int) -> bool:
    return bool(
        db.scalar(
            sa.select(Department.id).where(
                Department.id == dept_id, Department.tenant_id == tid
            )
        )
    )


# ── 部门 ↔ flow ─────────────────────────────────────────────────────────────

def get_department_flows(dept_id: int) -> list[str]:
    with _session() as db:
        rows = db.scalars(
            sa.select(DepartmentFlow.flow_id)
            .where(DepartmentFlow.dept_id == dept_id)
            .order_by(DepartmentFlow.flow_id)
        ).all()
        return list(rows)


def set_department_flows(dept_id: int, flow_ids: list[str]) -> list[str]:
    tid = _current_tenant_id()
    cleaned = sorted({f.strip() for f in flow_ids if f and f.strip()})
    with _session() as db:
        if not _dept_exists(db, dept_id, tid):
            raise LookupError(f"部门不存在: {dept_id}")
        db.execute(
            sa.delete(DepartmentFlow).where(DepartmentFlow.dept_id == dept_id)
        )
        for fid in cleaned:
            db.add(DepartmentFlow(dept_id=dept_id, flow_id=fid))
        db.commit()
    return cleaned


def list_available_flows() -> list[str]:
    """config/flow_*.yaml 文件名 stem 列表，供前端挑选挂载。"""
    return sorted(f.stem for f in _CONFIG_DIR.glob("flow_*.yaml"))


# ── 用户 ↔ 部门 ─────────────────────────────────────────────────────────────

def get_user_departments(user_id: int) -> list[dict]:
    tid = _current_tenant_id()
    with _session() as db:
        rows = db.execute(
            sa.select(Department.id, Department.name)
            .join(UserDepartment, UserDepartment.dept_id == Department.id)
            .where(
                UserDepartment.user_id == user_id,
                Department.tenant_id == tid,
            )
            .order_by(Department.name)
        ).all()
        return [{"id": r.id, "name": r.name} for r in rows]


def set_user_departments(user_id: int, dept_ids: list[int]) -> list[dict]:
    tid = _current_tenant_id()
    with _session() as db:
        # 只接受属于本租户的真实部门 id，过滤越权/脏 id
        valid = set(
            db.scalars(
                sa.select(Department.id).where(
                    Department.tenant_id == tid,
                    Department.id.in_(dept_ids or [-1]),
                )
            ).all()
        )
        db.execute(
            sa.delete(UserDepartment).where(UserDepartment.user_id == user_id)
        )
        for did in sorted(valid):
            db.add(UserDepartment(user_id=user_id, dept_id=did))
        db.commit()
    return get_user_departments(user_id)
