"""P1a: backend department identities come from v1_taxonomy only."""

import ast
from pathlib import Path

import pytest
import yaml

from src import court_roles, si_profile
from src.department_identity import (
    CANONICAL_MINISTRY_IDS,
    agent_code_for,
    canonical_name,
    load_department_identity,
    runtime_code_for,
    validate_identity_consumer_keys,
)


ROOT = Path(__file__).resolve().parents[1]
TAXONOMY_PATH = ROOT / "harness" / "chaotang_department_protocol" / "departments.yaml"


def test_v1_taxonomy_declares_every_identity_namespace():
    raw = yaml.safe_load(TAXONOMY_PATH.read_text(encoding="utf-8"))
    liubu = raw["v1_taxonomy"]["liubu"]

    assert tuple(liubu) == CANONICAL_MINISTRY_IDS
    for canonical_id, spec in liubu.items():
        assert spec["runtime_code"], canonical_id
        assert spec["agent_code"], canonical_id
        assert spec["legacy_api_slugs"], canonical_id
        assert spec["routing_keywords"], canonical_id
        assert spec["persona"], canonical_id


def test_libu_namespaces_are_explicit_and_unambiguous():
    assert runtime_code_for("libu") == "libu_personnel"
    assert agent_code_for("libu") == "li_bu"
    assert canonical_name("libu") == "吏部"

    assert runtime_code_for("libu_rites") == "libu"
    assert agent_code_for("libu_rites") == "li_bu_rites"
    assert canonical_name("libu_rites") == "礼部"


def test_identity_loader_fails_closed_on_duplicate_namespace_values(tmp_path: Path):
    raw = yaml.safe_load(TAXONOMY_PATH.read_text(encoding="utf-8"))
    raw["v1_taxonomy"]["liubu"]["libu"]["agent_code"] = "hu_bu"
    broken = tmp_path / "departments.yaml"
    broken.write_text(yaml.safe_dump(raw, allow_unicode=True, sort_keys=False), encoding="utf-8")

    with pytest.raises(ValueError, match="agent_code"):
        load_department_identity(broken)


def test_runtime_registry_is_exactly_the_v1_derived_runtime_set():
    raw = yaml.safe_load(TAXONOMY_PATH.read_text(encoding="utf-8"))
    validate_identity_consumer_keys(
        "six_ministries",
        raw["six_ministries"],
        namespace="runtime_code",
        require_complete=True,
    )


def test_si_registry_rejects_unknown_parent_department(tmp_path: Path):
    registry = tmp_path / "si_registry.yaml"
    registry.write_text("departments:\n  fake_ministry: []\n", encoding="utf-8")

    with pytest.raises(ValueError, match="si_registry"):
        si_profile._load_registry(registry)


def test_court_roles_rejects_unknown_authority_key(tmp_path: Path):
    roles = tmp_path / "court_roles.yaml"
    roles.write_text("yushi: []\nharness: []\nself_promoted_admin: [mallory]\n", encoding="utf-8")

    with pytest.raises(ValueError, match="court_roles"):
        court_roles.effective_role("mallory", "user", path=roles)


def test_router_identity_tables_are_projections_not_code_set_literals():
    source = (ROOT / "src" / "chaotang_department_router.py").read_text(encoding="utf-8")
    assert 'MINISTRY_KEYWORDS = runtime_projection("routing_keywords")' in source
    assert 'DEPARTMENT_PERSONAS = runtime_projection("persona")' in source


def test_repo_has_no_second_canonical_ministry_code_set_literal():
    """Permanent grep/AST gate: canonical six-ID vocabulary is YAML-only."""
    canonical = set(CANONICAL_MINISTRY_IDS)
    offenders: list[str] = []
    for root in (ROOT / "src", ROOT / "web"):
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                values: list[str] = []
                if isinstance(node, ast.Dict):
                    values = [
                        key.value
                        for key in node.keys
                        if isinstance(key, ast.Constant) and isinstance(key.value, str)
                    ]
                elif isinstance(node, (ast.List, ast.Tuple, ast.Set)):
                    values = [
                        item.value
                        for item in node.elts
                        if isinstance(item, ast.Constant) and isinstance(item.value, str)
                    ]
                if set(values) == canonical:
                    offenders.append(f"{path.relative_to(ROOT)}:{node.lineno}")
    assert offenders == [], f"canonical ministry code set duplicated outside departments.yaml: {offenders}"
