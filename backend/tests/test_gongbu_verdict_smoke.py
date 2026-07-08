"""工部确定性验收冒烟回归 — 无 LLM、秒级、每次改完必跑。

守住"下任务→会审链→奏折工部段"这条链的**确定性骨架**不被改断:
- assemble_flow 对 pack 任务生成完整 DAG(decree→council→group_rnd→aggregate)
- 确定性验收 helper 三态:单一方案→真绿红、多方案→诚实 UNKNOWN(禁假 PASS)、非工程→不触发
- 自然语言串并数抽取器:只在方案收敛时抽,多方案/散文诚实放弃

真 LLM 端到端(丞相→军机处→蜂群→八段奏折)见 scratchpad/gongbu_probe.py(手动/夜跑,烧 key)。
本文件刻意不跑 LLM:确定性门本就是 no-LLM,骨架回归不该依赖网络/provider。
"""

import pathlib

from src import chaotang_orchestrator as orch


class _Step:
    def __init__(self, agent_name: str, output: str):
        self.agent_name = agent_name
        self.output = output


class _RunLog:
    run_id = "smoke"

    def __init__(self, steps):
        self.steps = steps


# ── 自然语言串并数抽取器:单一方案才抽,多方案诚实放弃 ──────────────────────
def test_extract_single_scheme():
    assert orch._sizing_from_natural_language("推荐 19S6P LFP 5Ah 32650") == {
        "series_S": 19,
        "parallel_P": 6,
        "cell_capacity_ah": 5.0,
        "chemistry": "LFP",
        "cell_nominal_v": 3.2,
    }


def test_extract_multi_scheme_refuses():
    # 出现两种方案 → 不硬抽,交给门判 UNKNOWN
    assert orch._sizing_from_natural_language("从 19S6P 改为 20S4P") is None


def test_extract_no_scheme():
    assert orch._sizing_from_natural_language("方案待客户确认") is None


# ── 确定性验收 helper 三态 ────────────────────────────────────────────────
def test_verdict_single_scheme_gates_red():
    """研发组收敛到单一(错误)方案 → 抽出核算 → 真红、deterministic_gated。"""
    rl = _RunLog([_Step("group_rnd", "经评估推荐 4S3P 磷酸铁锂 100Ah,方案锁定")])
    v = orch._gongbu_deterministic_verdict(rl, "客户要 12V 1100Wh 磷酸铁锂电池包")
    assert v is not None
    assert v["provenance"]["deterministic_gated"] is True
    assert v["light"] == "red"


def test_verdict_multi_scheme_stays_unknown():
    """多方案未定 → 诚实 UNKNOWN,禁假绿(核心气质:方案没定就说没定)。"""
    rl = _RunLog([_Step("group_rnd", "方案A 19S6P;若精度不足则改为 20S4P")])
    v = orch._gongbu_deterministic_verdict(rl, "客户要 60V 32Ah 锂电池包")
    assert v is not None
    assert v["provenance"]["deterministic_gated"] is False


def test_verdict_non_engineering_not_triggered():
    rl = _RunLog([_Step("group_rnd", "市场推广文案草稿……")])
    assert orch._gongbu_deterministic_verdict(rl, "帮我写一封营销邮件") is None


def test_verdict_no_rnd_step_returns_none():
    rl = _RunLog([_Step("decree", "复述口谕……")])
    assert orch._gongbu_deterministic_verdict(rl, "客户要电池包方案") is None


# ── 会审链 DAG 骨架:工部 pack 任务必须装配出完整链 ──────────────────────────
def test_assemble_gongbu_dag_structure(tmp_path):
    plan = {
        "rawCommand": "客户要 60V 32Ah 锂电池包技术方案",
        "intent": "电池包方案",
        "taskType": "product",
        "ministers": ["gong_bu"],
        "groups": ["rnd"],
    }
    path = orch.assemble_flow(plan, task_id="smoke-dag", out_dir=tmp_path)
    yaml_text = pathlib.Path(path).read_text(encoding="utf-8")
    for step in ("decree", "council_gong_bu", "group_rnd", "aggregate"):
        assert step in yaml_text, f"工部 DAG 缺 {step} 步"


# ── #9 奏折 JSON 容错:永不因格式瑕疵丢整份奏折 ────────────────────────────
def test_memorial_strict_json():
    d = orch._memorial_from_aggregate(
        '前言\n{"background": "x", "recommendation": "y"}'
    )
    assert d["background"] == "x"
    assert not d.get("parse_failed")


def test_memorial_trailing_comma_repaired():
    # LLM 常见尾逗号 → 宽松修复,不丢奏折
    d = orch._memorial_from_aggregate('{"a": 1, "b": [1, 2,],}')
    assert d.get("a") == 1
    assert not d.get("parse_failed")


def test_memorial_unparseable_falls_back_to_raw():
    # 漏逗号(实跑 final_output=NO 真因)救不了 → 退原文,正文不丢
    bad = '奏折正文很长……\n{"a": 1 "b": 2}'
    d = orch._memorial_from_aggregate(bad)
    assert d["parse_failed"] is True
    assert d["raw_memorial"] == bad
    assert d["source_label"] == "RAW_TEXT"


# ── #8 奏折每段标源:上书房一眼看清哪段可信 ──────────────────────────────────
def test_label_opinion_sources():
    # 2026-07-07:吏部(li_bu)已建真实引擎(libu_vet.py,另一并行工作线),不再是
    # LLM_ONLY 反例——改用 scribe(史馆),它至今仍无 xxx_verdict.py 式真实引擎。
    fo = {
        "opinions": [
            {"agentCode": "council_gong_bu", "text": "工部意见"},
            {"agentCode": "council_hu_bu", "text": "户部意见"},
            {"agentCode": "council_li_bu", "text": "吏部意见"},
            {"agentCode": "council_scribe", "text": "史馆意见"},
            {"agentCode": "decree", "text": "丞相理解"},
            {"agentCode": "group_rnd_dispatch", "text": "研发组"},
        ]
    }
    orch._label_opinion_sources(fo)
    labels = {o["agentCode"]: o["source_label"] for o in fo["opinions"]}
    assert labels["council_gong_bu"] == "DETERMINISTIC_GATE"  # 工部→指向确定性门
    assert labels["council_hu_bu"] == "ENGINE_BACKED"  # 户部有真实引擎
    assert labels["council_li_bu"] == "ENGINE_BACKED"  # 吏部现在也有真实引擎(libu_vet)
    assert labels["council_scribe"] == "LLM_ONLY"  # 史馆纯 LLM,诚实标软
    assert labels["decree"] == "SYNTHESIS"
    assert labels["group_rnd_dispatch"] == "SYNTHESIS"


def test_label_opinion_sources_missing_opinions_no_crash():
    fo = {"headline": "raw 兜底奏折,无 opinions"}
    orch._label_opinion_sources(fo)  # 不崩
    assert "opinions" not in fo
