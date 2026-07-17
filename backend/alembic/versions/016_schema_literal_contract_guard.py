"""016 — re-verify identity defaults with literal-safe normalization.

Revision ID: 016_schema_literal_contract_guard
Revises: 015_schema_contract_guard
Create Date: 2026-07-17

Revision 015 was already published with case-folding default normalization.
This validation-only successor re-runs the frozen identity contract so databases
already stamped at 015 cannot bypass the corrected literal comparison.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "016_schema_literal_contract_guard"
down_revision = "015_schema_contract_guard"
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
        return normalized[1:-1]
    normalized = _normalize_sql_syntax(normalized)
    if normalized in {"datetime('now')", "now()"}:
        return "current_timestamp"
    return normalized


def _normalize_sql_syntax(value: object) -> str:
    """Normalize SQL syntax without changing quoted literal contents."""
    source = str(value).strip()
    normalized: list[str] = []
    quote: str | None = None
    pending_space = False
    index = 0

    while index < len(source):
        char = source[index]
        if quote is not None:
            normalized.append(char)
            if char == quote:
                if index + 1 < len(source) and source[index + 1] == quote:
                    normalized.append(source[index + 1])
                    index += 2
                    continue
                quote = None
            index += 1
            continue

        if char in {"'", '"'}:
            if pending_space and normalized:
                normalized.append(" ")
            pending_space = False
            quote = char
            normalized.append(char)
        elif char.isspace():
            pending_space = True
        else:
            if pending_space and normalized:
                normalized.append(" ")
            pending_space = False
            normalized.append(char.lower())
        index += 1

    return "".join(normalized)


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
        raise RuntimeError("incompatible tenant identity tables block migration 016: " + "; ".join(errors))


def upgrade() -> None:
    _validate(sa.inspect(op.get_bind()))


def downgrade() -> None:
    # Validation-only revision: no schema state was changed.
    pass
