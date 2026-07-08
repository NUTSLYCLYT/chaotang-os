"""LLM 抽取器测试 —— 用 mock 注入,无模型链路也能验证 extract/judge 分离正确。

核心断言:
  1) LLM 只抽数字,判定仍由确定性 check() 做(LLM 说"完美达标"也改变不了 935-1265 的判定)。
  2) LLM 抽取能命中正则抽不出的乱格式输出(降 blind_rate)。
  3) JSON 解析容忍 ```json 包裹 / 前后废话。
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from src.llm_extract import extract_pack_llm, _coerce, _parse_json  # noqa: E402
import pack_rd_check as prc  # noqa: E402


def _verdict(checks):
    s = [c["status"] for c in checks]
    return "FAIL" if "FAIL" in s else ("PASS" if "PASS" in s else "UNKNOWN")


def test_llm_only_extracts_judge_stays_deterministic():
    """LLM 谎称'完美达标'+给出超标电量,判定端仍按代码判 FAIL。"""
    # 乱格式真实输出:正则抽不出(电量藏在叙述里、无标准 Wh 写法)
    messy = "本方案电量做到一千四百瓦时左右，整包重七公斤，软包八串并，堪称完美，全面达标！"

    def mock_call(system, user):
        # LLM 诚实抽出数字(含超标值),但绝不替代码判定
        return (
            '```json\n{"energy_wh": 1400, "softpack_parallel": 8, "total_weight_kg": 7, '
            '"specific_energy": 200, "has_heating": false, "has_12v": false}\n```'
        )

    ex = extract_pack_llm(messy, call_fn=mock_call)
    checks = prc.check(ex, "电量1100Wh±15%")
    # 代码判定:电量1400>1265→FAIL；软包8>5→FAIL。LLM 的"完美达标"无效。
    c1 = next(c for c in checks if c["check"].startswith("C1"))
    c2 = next(c for c in checks if c["check"].startswith("C2"))
    assert c1["status"] == "FAIL", c1
    assert c2["status"] == "FAIL", c2
    assert _verdict(checks) == "FAIL"


def test_llm_reduces_blind_rate():
    """正则抽不出的乱格式,LLM 能抽出 → 从 UNKNOWN 变成可判定。"""
    messy = "电量一千零五十瓦时，总重六公斤，比能量声称一百七十五。"
    # 正则版:抽不出(中文数字)→ C1 UNKNOWN
    assert prc.extract(messy)["energy_wh"] is None

    def mock_call(system, user):
        return (
            '{"energy_wh": 1050, "softpack_parallel": null, "total_weight_kg": 6, '
            '"specific_energy": 175, "has_heating": false, "has_12v": true}'
        )

    ex = extract_pack_llm(messy, call_fn=mock_call)
    checks = prc.check(ex, "电量1100Wh±15%")
    c1 = next(c for c in checks if c["check"].startswith("C1"))
    assert c1["status"] == "PASS", c1  # 1050 在 935-1265 内
    # C3 比能量勾稽:1050/6=175，声称175，偏差0%→PASS
    c3 = next(c for c in checks if c["check"].startswith("C3"))
    assert c3["status"] == "PASS", c3


def test_coerce_handles_null_and_strings():
    d = _coerce(
        {
            "energy_wh": "null",
            "softpack_parallel": "4",
            "total_weight_kg": None,
            "specific_energy": 180.5,
            "has_heating": 1,
            "has_12v": 0,
        }
    )
    assert d["energy_wh"] is None
    assert d["softpack_parallel"] == 4.0
    assert d["total_weight_kg"] is None
    assert d["specific_energy"] == 180.5
    assert d["has_heating"] is True
    assert d["has_12v"] is False


def test_parse_json_tolerates_fences_and_noise():
    assert _parse_json('好的，结果如下：```json\n{"energy_wh": 960}\n```谢谢')["energy_wh"] == 960
    assert _parse_json('{"energy_wh": 1000}')["energy_wh"] == 1000


if __name__ == "__main__":
    import traceback

    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    ok = 0
    for fn in fns:
        try:
            fn()
            print(f"  ✅ {fn.__name__}")
            ok += 1
        except Exception:
            print(f"  ❌ {fn.__name__}")
            traceback.print_exc()
    print(f"\n{ok}/{len(fns)} 通过")
    sys.exit(0 if ok == len(fns) else 1)
