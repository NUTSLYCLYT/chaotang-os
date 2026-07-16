"""015 — verify the frozen tenant identity schema contract.

Revision ID: 015_schema_contract_guard
Revises: 014_tenant_identity_tables
Create Date: 2026-07-17

This is intentionally a validation-only revision. Revision 014 was already
published, so changing only its preflight would not protect databases that
had already reached that revision.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "015_schema_contract_guard"
down_revision = "014_tenant_identity_tables"
branch_labels = None
depends_on = None

_SPECS = {
    "tenants": {
        "columns": {
            "id": (sa.Integer, False, None),
            "name": (sa.Text, False, None),
            "slug": (sa.Text, False, None),
            "created_at": (sa.Text, False, "current_timestamp"),
        },
        "pk": ("id",),
        "unique": {("slug",)},
    },
    "users": {
        "columns": {
            "id": (sa.Integer, False, None),
            "username": (sa.Text, False, None),
            "email": (sa.Text, True, ""),
            "password_hash": (sa.Text, False, None),
            "tenant_id": (sa.Integer, False, None),
            "role": (sa.Text, False, "user"),
            "display_name": (sa.Text, True, ""),
            "created_at": (sa.Text, False, "current_timestamp"),
        },
        "pk": ("id",),
        "unique": {("username",)},
    },
    "invites": {
        "columns": {
            "id": (sa.Integer, False, None),
            "code": (sa.Text, False, None),
            "max_uses": (sa.Integer, False, "1"),
            "used_count": (sa.Integer, False, "0"),
            "expires_at": (sa.Text, True, None),
            "created_at": (sa.Text, False, "current_timestamp"),
        },
        "pk": ("id",),
        "unique": {("code",)},
    },
}


def _normalize_default(value: object) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    while normalized.startswith("(") and normalized.endswith(")"):
        normalized = normalized[1:-1].strip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {"'", '"'}:
        normalized = normalized[1:-1]
    normalized = " ".join(normalized.lower().split())
    if normalized in {"datetime('now')", "now()"}:
        return "current_timestamp"
    return normalized


def _unique_shapes(inspector: sa.Inspector, table_name: str) -> set[tuple[str, ...]]:
    shapes = {
        tuple(item.get("column_names") or ())
        for item in inspector.get_unique_constraints(table_name)
    }
    shapes.update(
        tuple(item.get("column_names") or ())
        for item in inspector.get_indexes(table_name)
        if item.get("unique")
    )
    return {shape for shape in shapes if shape}


def _foreign_key_shapes(
    inspector: sa.Inspector,
    table_name: str,
) -> set[tuple[tuple[str, ...], str, tuple[str, ...], tuple[tuple[str, str], ...]]]:
    return {
        (
            tuple(item.get("constrained_columns") or ()),
            str(item.get("referred_table")),
            tuple(item.get("referred_columns") or ()),
            tuple(
                sorted(
                    (str(key), str(value).lower())
                    for key, value in (item.get("options") or {}).items()
                    if value is not None
                )
            ),
        )
        for item in inspector.get_foreign_keys(table_name)
    }


def _validate(inspector: sa.Inspector) -> None:
    existing = set(inspector.get_table_names())
    errors: list[str] = []
    for table_name, spec in _SPECS.items():
        if table_name not in existing:
            errors.append(f"missing table: {table_name}")
            continue
        actual_columns = {item["name"]: item for item in inspector.get_columns(table_name)}
        expected_columns = spec["columns"]
        if set(actual_columns) != set(expected_columns):
            missing = sorted(set(expected_columns) - set(actual_columns))
            unexpected = sorted(set(actual_columns) - set(expected_columns))
            if missing:
                errors.append(f"{table_name} missing columns: {', '.join(missing)}")
            if unexpected:
                errors.append(f"{table_name} unexpected columns: {', '.join(unexpected)}")
        for column_name in sorted(set(actual_columns) & set(expected_columns)):
            type_class, nullable, default = expected_columns[column_name]
            actual = actual_columns[column_name]
            if not isinstance(actual["type"], type_class):
                errors.append(f"{table_name}.{column_name} has incompatible type")
            if column_name != "id" and bool(actual.get("nullable")) != nullable:
                errors.append(f"{table_name}.{column_name} has incompatible nullability")
            if _normalize_default(actual.get("default")) != default:
                errors.append(f"{table_name}.{column_name} has incompatible server default")
        actual_pk = tuple(inspector.get_pk_constraint(table_name).get("constrained_columns") or ())
        if actual_pk != spec["pk"]:
            errors.append(f"{table_name} primary key mismatch")
        if _unique_shapes(inspector, table_name) != spec["unique"]:
            errors.append(f"{table_name} unique constraints mismatch")
        foreign_keys = _foreign_key_shapes(inspector, table_name)
        expected_foreign_keys = (
            {(('tenant_id',), 'tenants', ('id',), ())}
            if table_name == "users"
            else set()
        )
        if foreign_keys != expected_foreign_keys:
            errors.append(f"{table_name} foreign keys mismatch")
        named_indexes = {
            item["name"] for item in inspector.get_indexes(table_name) if item.get("name")
        }
        if named_indexes:
            errors.append(f"{table_name} unexpected named indexes: {', '.join(sorted(named_indexes))}")
        if inspector.get_check_constraints(table_name):
            errors.append(f"{table_name} unexpected check constraints")

    if errors:
        raise RuntimeError("incompatible tenant identity tables block migration 015: " + "; ".join(errors))


def upgrade() -> None:
    _validate(sa.inspect(op.get_bind()))


def downgrade() -> None:
    # Validation-only revision: no schema state was changed.
    pass
