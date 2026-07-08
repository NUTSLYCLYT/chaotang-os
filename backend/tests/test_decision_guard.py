"""decision_guard 专属单测 — 会审第②刀:把"未签字不得执行"从 print 升级为结构性硬闸。

锁定边界:
  - IRREVERSIBLE_FLOWS 补登记 finance/legal/appointment(协议声明 irreversible 却曾漏登记)
  - sign 必须具名;gate_by_evidence 稀疏样本强制 ABSTAIN
  - assert_executable:PENDING→抛 / ABSTAIN→抛 / APPROVED→放行 / 可逆→放行
  - signed_decisions.jsonl 为唯一签字真值源(read_signoff_*);读不到台账 fail-secure
  - assert_executable_by_run:不可逆未签字→抛,已签字→放行,可逆→放行
"""

from __future__ import annotations

import json

import pytest

from src.decision_guard import (
    ABSTAIN,
    APPROVED,
    IRREVERSIBLE_FLOWS,
    PENDING,
    InsufficientEvidenceError,
    PendingSignoffError,
    assert_executable,
    assert_executable_by_run,
    flow_id_from_name,
    gate_by_evidence,
    is_irreversible,
    read_signoff_record,
    read_signoff_status,
    sign,
    signoff_state,
    wrap_advisory,
)


# ── IRREVERSIBLE_FLOWS 补登记 ───────────────────────────────────────────────
def test_irreversible_flows_includes_newly_registered():
    for fid in (
        "finance",
        "legal",
        "appointment",
        "quotation",
        "sourcing",
        "storage_aftercare",
        "battery_stage_gate",
        "pack_rd",
    ):
        assert is_irreversible(fid), f"{fid} 应被登记为不可逆"


def test_reversible_flow_is_not_irreversible():
    assert not is_irreversible("ima")
    assert not is_irreversible("xiaohongshu")


# ── wrap_advisory / sign ────────────────────────────────────────────────────
def test_wrap_advisory_irreversible_is_pending():
    d = wrap_advisory({"x": 1}, flow_id="quotation")
    assert d["advisory"] is True
    assert d["signoff"]["status"] == PENDING


def test_wrap_advisory_reversible_is_approved():
    d = wrap_advisory({"x": 1}, flow_id="ima")
    assert d["advisory"] is False
    assert d["signoff"]["status"] == APPROVED


def test_sign_requires_named_signer():
    d = wrap_advisory({"x": 1}, flow_id="legal")
    with pytest.raises(ValueError):
        sign(d, signer="   ")
    signed = sign(d, signer="张三(法务总监)")
    assert signed["signoff"]["status"] == APPROVED
    assert signed["signoff"]["signer"] == "张三(法务总监)"


# ── gate_by_evidence ────────────────────────────────────────────────────────
def test_gate_by_evidence_sparse_samples_abstains():
    d = wrap_advisory({"x": 1}, flow_id="sourcing")
    d = gate_by_evidence(d, n_real_samples=2, min_samples=8)
    assert d["signoff"]["status"] == ABSTAIN
    assert "证据不足" in d["abstain_reason"]


def test_gate_by_evidence_enough_samples_stays_pending():
    d = wrap_advisory({"x": 1}, flow_id="sourcing")
    d = gate_by_evidence(d, n_real_samples=20, min_samples=8)
    assert d["signoff"]["status"] == PENDING


# ── assert_executable(decision dict) ────────────────────────────────────────
def test_assert_executable_blocks_pending():
    d = wrap_advisory({"x": 1}, flow_id="finance")
    with pytest.raises(PendingSignoffError):
        assert_executable(d)


def test_assert_executable_blocks_abstain():
    d = wrap_advisory({"x": 1}, flow_id="finance")
    d = gate_by_evidence(d, n_real_samples=1, min_samples=8)
    with pytest.raises(InsufficientEvidenceError):
        assert_executable(d)


def test_assert_executable_allows_signed():
    d = sign(wrap_advisory({"x": 1}, flow_id="finance"), signer="李四(财务总监)")
    assert_executable(d)  # 不抛


def test_assert_executable_allows_reversible():
    d = wrap_advisory({"x": 1}, flow_id="ima")
    assert_executable(d)  # 可逆,不抛


# ── signed_decisions.jsonl 真值源 ───────────────────────────────────────────
def _ledger(tmp_path, *records):
    p = tmp_path / "signed_decisions.jsonl"
    p.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in records) + "\n",
        encoding="utf-8",
    )
    return p


def test_read_signoff_record_finds_approved(tmp_path):
    log = _ledger(
        tmp_path,
        {
            "run_id": "R1",
            "flow_id": "legal",
            "signer": "王五(律师)",
            "status": APPROVED,
        },
    )
    rec = read_signoff_record("R1", signed_log=log)
    assert rec is not None and rec["signer"] == "王五(律师)"
    assert read_signoff_status("R1", signed_log=log) == APPROVED


def test_read_signoff_missing_run_is_none(tmp_path):
    log = _ledger(tmp_path, {"run_id": "R1", "status": APPROVED})
    assert read_signoff_record("OTHER", signed_log=log) is None
    assert read_signoff_status("OTHER", signed_log=log) is None


def test_read_signoff_no_ledger_is_fail_secure(tmp_path):
    """台账不存在 → 读不到=不得放行(None)。"""
    assert read_signoff_status("R1", signed_log=tmp_path / "nope.jsonl") is None


def test_read_signoff_ignores_non_approved_lines(tmp_path):
    log = _ledger(tmp_path, {"run_id": "R1", "status": PENDING})
    assert read_signoff_status("R1", signed_log=log) is None


# ── assert_executable_by_run(交付/执行口真闸) ───────────────────────────────
def test_assert_executable_by_run_blocks_unsigned(tmp_path):
    log = tmp_path / "empty.jsonl"
    log.write_text("", encoding="utf-8")
    with pytest.raises(PendingSignoffError):
        assert_executable_by_run("R1", "quotation", signed_log=log)


def test_assert_executable_by_run_allows_signed(tmp_path):
    log = _ledger(
        tmp_path, {"run_id": "R1", "flow_id": "quotation", "status": APPROVED}
    )
    assert_executable_by_run("R1", "quotation", signed_log=log)  # 不抛


def test_assert_executable_by_run_allows_reversible(tmp_path):
    log = tmp_path / "empty.jsonl"
    log.write_text("", encoding="utf-8")
    assert_executable_by_run("R1", "ima", signed_log=log)  # 可逆,不抛


# ── signoff_state / flow_id_from_name(交付物横幅用) ─────────────────────────
def test_signoff_state_unsigned(tmp_path):
    log = tmp_path / "empty.jsonl"
    log.write_text("", encoding="utf-8")
    st = signoff_state("R1", "legal", signed_log=log)
    assert st["irreversible"] is True and st["approved"] is False


def test_signoff_state_signed(tmp_path):
    log = _ledger(
        tmp_path,
        {"run_id": "R1", "flow_id": "legal", "signer": "赵六", "status": APPROVED},
    )
    st = signoff_state("R1", "legal", signed_log=log)
    assert st["approved"] is True and st["signer"] == "赵六"


def test_signoff_state_reversible_needs_no_signoff(tmp_path):
    st = signoff_state("R1", "ima", signed_log=tmp_path / "nope.jsonl")
    assert st["irreversible"] is False and st["approved"] is False


def test_flow_id_from_name_maps_known_irreversible():
    assert flow_id_from_name("报价单生成流程") == "quotation"
    assert flow_id_from_name("法律合规流程") == "legal"
    assert flow_id_from_name("IMA知识蜂群") is None
