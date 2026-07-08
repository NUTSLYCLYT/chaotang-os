"""锦衣卫 vet → 蜂群入库把关 check 测试(钦天监 A2 接线)。"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def test_vet_grades_and_decisions():
    from src.jinyiwei_vet import vet_intel

    assert vet_intel("国电南瑞招标", ["国电南瑞官网公告"])["decision"] == "入库"
    assert vet_intel("某新政将出", ["财经媒体报道", "行业资讯号"])["decision"] == "入库"
    assert vet_intel("传某公司融资", ["某公众号据悉"])["decision"] == "待核"
    assert vet_intel("小道消息", ["匿名"])["decision"] == "拒"


def test_hard_claim_nonprimary_holds():
    from src.jinyiwei_vet import vet_intel

    r = vet_intel("通过 GJB 150.4A 认证,-40℃ 保持 90%", ["某媒体报道"])
    assert r["decision"] == "待核" and r["hard_claim"]


def test_verdict_mapping():
    from src.jinyiwei_vet import verdict_of

    assert verdict_of("入库") == "PASS"
    assert verdict_of("拒") == "FAIL"
    assert verdict_of("待核") == "UNKNOWN"  # 待核=UNKNOWN→不自动过闸,需人核


def test_registered_as_swarm_check():
    from src.truth_ledger import _DETERMINISTIC

    assert "jinyiwei_vet" in _DETERMINISTIC


def test_vet_and_record_gates_correctly(tmp_path, monkeypatch):
    import src.truth_ledger as tl

    monkeypatch.setattr(tl, "LEDGER", tmp_path / "tl.jsonl")
    from src.jinyiwei_vet import vet_and_record

    # 一手 → 入库 → PASS → 过闸放行入库
    vet_and_record("一手招标公告", ["国电南瑞官网公告"], swarm="ima", case_id="c1")
    assert tl.gate("ima", "c1", "jinyiwei_vet") is True
    # GJB 硬声明二手 → 待核 → UNKNOWN → 不过闸(需人核,挡在入库外)
    vet_and_record("通过 GJB 认证", ["某媒体"], swarm="ima", case_id="c2")
    assert tl.gate("ima", "c2", "jinyiwei_vet") is False


if __name__ == "__main__":
    import subprocess

    sys.exit(subprocess.call([sys.executable, "-m", "pytest", __file__, "-q"]))
