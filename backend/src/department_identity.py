"""Department identity projections derived from ``v1_taxonomy``.

The YAML keys are canonical product IDs. Runtime codes, AgentCodes and legacy
API slugs are separate namespaces; notably ``libu`` means different things in
the canonical and runtime namespaces, so this module intentionally exposes no
untyped "normalize anything" helper.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from copy import deepcopy
from pathlib import Path
from typing import Any, Literal

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TAXONOMY_PATH = (
    PROJECT_ROOT / "harness" / "chaotang_department_protocol" / "departments.yaml"
)
IdentityNamespace = Literal["canonical_id", "runtime_code", "agent_code"]


def load_department_identity(path: Path = DEFAULT_TAXONOMY_PATH) -> dict[str, Any]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("department taxonomy must be a mapping")
    taxonomy = raw.get("v1_taxonomy")
    liubu = taxonomy.get("liubu") if isinstance(taxonomy, dict) else None
    if not isinstance(liubu, dict) or not liubu:
        raise ValueError("v1_taxonomy.liubu must be a non-empty mapping")

    required = {
        "name",
        "runtime_code",
        "agent_code",
        "legacy_api_slugs",
        "routing_keywords",
        "persona",
    }
    seen: dict[str, dict[str, str]] = {
        "runtime_code": {},
        "agent_code": {},
        "legacy_api_slug": {},
        "l4_swarm_id": {},
    }
    for canonical_id, spec in liubu.items():
        if not isinstance(spec, dict):
            raise ValueError(f"v1_taxonomy.liubu.{canonical_id} must be a mapping")
        missing = sorted(required - set(spec))
        if missing:
            raise ValueError(f"{canonical_id} missing identity fields: {missing}")
        for namespace in ("runtime_code", "agent_code"):
            value = spec.get(namespace)
            if not isinstance(value, str) or not value:
                raise ValueError(f"{canonical_id}.{namespace} must be a non-empty string")
            previous = seen[namespace].setdefault(value, canonical_id)
            if previous != canonical_id:
                raise ValueError(
                    f"duplicate {namespace} {value!r}: {previous!r} and {canonical_id!r}"
                )
        aliases = spec.get("legacy_api_slugs")
        if not isinstance(aliases, list) or not aliases:
            raise ValueError(f"{canonical_id}.legacy_api_slugs must be a non-empty list")
        for value in aliases:
            if not isinstance(value, str) or not value:
                raise ValueError(f"{canonical_id}.legacy_api_slugs contains an invalid value")
            previous = seen["legacy_api_slug"].setdefault(value, canonical_id)
            if previous != canonical_id:
                raise ValueError(
                    f"duplicate legacy_api_slug {value!r}: {previous!r} and {canonical_id!r}"
                )
        swarm_id = spec.get("l4_swarm_id")
        if swarm_id:
            previous = seen["l4_swarm_id"].setdefault(str(swarm_id), canonical_id)
            if previous != canonical_id:
                raise ValueError(
                    f"duplicate l4_swarm_id {swarm_id!r}: {previous!r} and {canonical_id!r}"
                )
    return raw


_RAW = load_department_identity()
_LIUBU: dict[str, dict[str, Any]] = _RAW["v1_taxonomy"]["liubu"]
CANONICAL_MINISTRY_IDS: tuple[str, ...] = tuple(_LIUBU)


def ministry_identity(canonical_id: str) -> dict[str, Any]:
    try:
        return _LIUBU[canonical_id]
    except KeyError as exc:
        raise KeyError(f"unknown canonical ministry id: {canonical_id}") from exc


def runtime_code_for(canonical_id: str) -> str:
    return str(ministry_identity(canonical_id)["runtime_code"])


def agent_code_for(canonical_id: str) -> str:
    return str(ministry_identity(canonical_id)["agent_code"])


def canonical_name(canonical_id: str) -> str:
    return str(ministry_identity(canonical_id)["name"])


def canonical_id_for_runtime(runtime_code: str) -> str:
    for canonical_id, spec in _LIUBU.items():
        if spec["runtime_code"] == runtime_code:
            return canonical_id
    raise KeyError(f"unknown ministry runtime_code: {runtime_code}")


def canonical_id_for_agent(agent_code: str) -> str:
    for canonical_id, spec in _LIUBU.items():
        if spec["agent_code"] == agent_code:
            return canonical_id
    raise KeyError(f"unknown ministry agent_code: {agent_code}")


def runtime_projection(field: str) -> dict[str, Any]:
    return {
        runtime_code_for(canonical_id): deepcopy(spec[field])
        for canonical_id, spec in _LIUBU.items()
    }


def swarm_to_name_projection() -> dict[str, str]:
    return {
        str(spec["l4_swarm_id"]): str(spec["name"])
        for spec in _LIUBU.values()
        if spec.get("l4_swarm_id")
    }


def agent_to_name_projection() -> dict[str, str]:
    return {str(spec["agent_code"]): str(spec["name"]) for spec in _LIUBU.values()}


def validate_identity_consumer_keys(
    consumer: str,
    values: Mapping[str, Any] | Iterable[str],
    *,
    namespace: IdentityNamespace,
    require_complete: bool = False,
    allow_unknown: bool = False,
) -> None:
    actual = set(values)
    if namespace == "canonical_id":
        expected = set(CANONICAL_MINISTRY_IDS)
    else:
        expected = {str(spec[namespace]) for spec in _LIUBU.values()}
    unknown = set() if allow_unknown else actual - expected
    missing = expected - actual if require_complete else set()
    if unknown or missing:
        raise ValueError(
            f"{consumer} does not match v1_taxonomy {namespace}: "
            f"unknown={sorted(unknown)}, missing={sorted(missing)}"
        )


def raw_department_config() -> dict[str, Any]:
    """Return the already validated canonical document for legacy projections."""
    return deepcopy(_RAW)


def validate_authority_role_keys(consumer: str, values: Mapping[str, Any]) -> None:
    """Validate the authorization registry without treating harness as a ministry."""
    allowed = {"yushi", "harness"}
    unknown = set(values) - allowed
    if unknown:
        raise ValueError(f"{consumer} has unknown authority roles: {sorted(unknown)}")
    governance = _RAW.get("departments", {})
    if "yushi" not in governance:
        raise ValueError("v1 department protocol must declare the yushi governance identity")
