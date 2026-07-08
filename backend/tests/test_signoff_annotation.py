"""B1 非阻断签字标注单测 — 后端交付口响应自带"不可逆·是否签字",但绝不阻断纯读端点。

会审第②刀延伸 + 用户决策"非阻断标注":signoff_annotation 给 runs/throne 响应加 signoff 块,
未签字不可逆 → irreversible=True/approved=False(前端提示不得执行);可逆 → irreversible=False;
任何异常 → fail-safe 安全默认,不让标注拖垮端点。
"""

from __future__ import annotations

from types import SimpleNamespace

from web.run_utils import signoff_annotation


def _run_log(run_id="ZZ_not_in_ledger_0001", config_path=None, flow_name=None):
    return SimpleNamespace(run_id=run_id, config_path=config_path, flow_name=flow_name)


def test_irreversible_unsigned_run_is_flagged():
    ann = signoff_annotation(_run_log(config_path="config/flow_quotation.yaml"))
    assert ann["irreversible"] is True
    assert ann["approved"] is False  # 该 run_id 不在真实台账 → 未签字
    assert ann["decision_type"]  # 有决策类型说明


def test_reversible_flow_not_flagged():
    ann = signoff_annotation(_run_log(config_path="config/flow_ima.yaml"))
    assert ann["irreversible"] is False
    assert ann["approved"] is False


def test_annotation_is_fail_safe_on_garbage():
    # run_log 缺字段/异常 → 返回安全默认,绝不抛
    ann = signoff_annotation(object())
    assert ann == {
        "irreversible": False,
        "approved": False,
        "signer": None,
        "signed_at": None,
        "decision_type": "",
    }
