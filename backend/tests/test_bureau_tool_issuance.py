from __future__ import annotations

import gc
from concurrent.futures import ThreadPoolExecutor

import pytest

import app.agents.runtime_skills as runtime_skills_package
import app.agents.runtime_skills.tool_audit_ref as audit_ref_module
from app.agents.runtime_skills.tool_audit_ref import _mint_tool_audit_ref
from app.agents.runtime_skills.tool_issuance import (
    _bureau_tool_policy_fingerprint,
    _issue_tool_authorization_context,
    _tool_authorization_context_is_issued,
)
from app.agents.runtime_skills.tool_models import ToolSideEffect
from app.agents.runtime_skills.tool_registry import BUREAU_TOOL_POLICIES


def test_mint_uses_constant_auxiliary_state_and_never_reuses_after_gc() -> None:
    state_before = {
        name: type(value)
        for name, value in vars(audit_ref_module).items()
        if name.startswith("_AUDIT_REF_")
    }
    refs = {_mint_tool_audit_ref(b"constant-memory") for _ in range(10_000)}
    assert len(refs) == 10_000
    old_refs = frozenset(refs)
    del refs
    gc.collect()
    refs_after_gc = {
        _mint_tool_audit_ref(b"constant-memory-after-gc") for _ in range(1_000)
    }
    assert old_refs.isdisjoint(refs_after_gc)
    assert {
        name: type(value)
        for name, value in vars(audit_ref_module).items()
        if name.startswith("_AUDIT_REF_")
    } == state_before
    assert not any(
        isinstance(value, (dict, list, set))
        for name, value in vars(audit_ref_module).items()
        if name.startswith("_AUDIT_REF_")
    )


def test_mint_is_unique_under_concurrency() -> None:
    with ThreadPoolExecutor(max_workers=32) as pool:
        refs = tuple(pool.map(lambda _: _mint_tool_audit_ref(b"concurrent"), range(10_000)))
    assert len(set(refs)) == len(refs)


def test_mint_fails_closed_at_counter_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        audit_ref_module,
        "_AUDIT_REF_COUNTER",
        audit_ref_module._AUDIT_REF_COUNTER_MAX - 1,
    )
    assert _mint_tool_audit_ref(b"boundary").startswith("tool-audit:")
    with pytest.raises(OverflowError, match="audit_ref_counter_exhausted"):
        _mint_tool_audit_ref(b"boundary")


def test_mint_secret_and_counter_are_not_package_exports() -> None:
    assert not hasattr(runtime_skills_package, "_AUDIT_REF_SECRET")
    assert not hasattr(runtime_skills_package, "_AUDIT_REF_COUNTER")
    assert not hasattr(runtime_skills_package, "new_tool_audit_ref")


def test_policy_fingerprint_is_canonical_and_deep_copy_stable() -> None:
    policy = BUREAU_TOOL_POLICIES["libu-policy"]
    deep_copy = policy.model_copy(deep=True)
    reversed_copy = policy.model_copy(deep=True, update={
        "tool_operations": dict(reversed(tuple(policy.tool_operations.items()))),
        "tool_argument_constraints": dict(
            reversed(tuple(policy.tool_argument_constraints.items()))
        ),
    })
    expected = _bureau_tool_policy_fingerprint(policy)
    assert _bureau_tool_policy_fingerprint(deep_copy) == expected
    assert _bureau_tool_policy_fingerprint(reversed_copy) == expected
    deep_copy.tool_argument_constraints[next(iter(deep_copy.allowed_tools))][
        "test-only-mutation"
    ] = True
    assert _bureau_tool_policy_fingerprint(policy) == expected
    assert _bureau_tool_policy_fingerprint(deep_copy) != expected


def _authorization(agent_id: str, *, report_session_present: bool = False):
    policy = BUREAU_TOOL_POLICIES[agent_id]
    return _issue_tool_authorization_context(
        request_id="request-1", case_id="case-1", decree_id="decree-1",
        agent_id=agent_id,
        skill_id=(
            "analyze-accounting-position"
            if agent_id == "hubu-accounting"
            else "analyze-hr-policy"
        ),
        skill_version="1.0.0", policy=policy,
        approved_input_refs=(), approved_evidence_refs=(), approved_data_refs=(),
        business_state="ready", system_max_calls=6, system_max_rounds=2,
        system_max_result_rows=200, system_max_result_bytes=262_144,
        report_session_present=report_session_present,
    )


def test_system_context_factory_seals_all_fields_and_tampering_invalidates() -> None:
    context = _authorization("libu-policy")
    assert _tool_authorization_context_is_issued(context)
    clone = context.model_copy(update={"business_state": "blocked"})
    assert not _tool_authorization_context_is_issued(clone)


def test_accounting_permissions_require_system_agent_and_report_session() -> None:
    without_session = _authorization("hubu-accounting")
    assert without_session.decree_scopes == frozenset()
    assert without_session.allowed_side_effects == frozenset({ToolSideEffect.READ})
    with_session = _authorization("hubu-accounting", report_session_present=True)
    assert with_session.decree_scopes == frozenset({"finance.read", "artifact.generate"})
    assert with_session.allowed_side_effects == frozenset(
        {ToolSideEffect.READ, ToolSideEffect.ARTIFACT}
    )
    non_accounting = _authorization("libu-policy", report_session_present=True)
    assert non_accounting.decree_scopes == frozenset()
    assert non_accounting.allowed_side_effects == frozenset({ToolSideEffect.READ})
