"""LLM 抽取器 —— 只抽数字,判定仍归确定性代码(extract/judge 严格分离)。

为什么这样分:LLM 擅长从乱格式文本里"读出 电量=960Wh、软包并联=4"这类事实(且可校验);
但"935≤电量≤1265 是否达标"这种比较绝不能交给 LLM(它会顺着语气说"达标")。
所以本模块只做 extract,返回与 pack_rd_check.extract() 完全相同的 shape,交给 check() 去判。

降低 blind_rate(检查器抽不出的占比)是本模块的唯一目的。
可注入 call_fn(无模型链路时用 mock 测试);默认走 LiteLLM 代理(与 flow 同一条链路)。
"""

from __future__ import annotations

import json
import os
import re

# pack_rd_check.extract() 的字段契约(判定端依赖此 shape,不可改)
PACK_FIELDS = ("energy_wh", "softpack_parallel", "total_weight_kg", "specific_energy", "has_heating", "has_12v")

_SYS = "你是严格的数字抽取器。只抽取文本中明确出现的事实,绝不判断对错、绝不推测补全、绝不计算。"

_USER_TPL = """从下面 PACK 方案文本中抽取这些字段,严格输出 JSON(找不到填 null,绝不猜):
- energy_wh: 总电量(Wh 数值)
- softpack_parallel: 软包电芯并联数(整数;若未用软包或未提则 null)
- total_weight_kg: 整包总重量(kg 数值)
- specific_energy: 声称的比能量(Wh/kg 数值)
- has_heating: 方案是否含加热/PTC/预热模块(true/false)
- has_12v: 是否明确提到 12V 电压平台(true/false)

只输出 JSON,不要解释。

文本:
\"\"\"
{text}
\"\"\""""


def _coerce(d: dict) -> dict:
    """把 LLM 返回强制成判定端要的 shape:数值或 None,布尔为 bool。"""
    out: dict = {}
    for k in ("energy_wh", "softpack_parallel", "total_weight_kg", "specific_energy"):
        v = d.get(k)
        try:
            out[k] = float(v) if v is not None and str(v).strip() not in ("", "null", "None") else None
        except (TypeError, ValueError):
            out[k] = None
    out["has_heating"] = bool(d.get("has_heating"))
    out["has_12v"] = bool(d.get("has_12v"))
    return out


def _parse_json(s: str) -> dict:
    """从 LLM 输出里抠出 JSON(容忍 ```json 包裹/前后废话)。"""
    s = re.sub(r"^```(?:json)?|```$", "", s.strip(), flags=re.MULTILINE).strip()
    m = re.search(r"\{.*\}", s, re.DOTALL)
    if not m:
        raise ValueError(f"LLM 未返回 JSON: {s[:120]}")
    return json.loads(m.group(0))


def _default_call(system: str, user: str) -> str:
    """默认走 LiteLLM 代理(与 flow 同链路)。无链路时由调用方传 call_fn 用 mock。"""
    from src.model_adapter import ModelAdapter

    adapter = ModelAdapter(
        model=os.environ.get("LLM_EXTRACT_MODEL", "openai/glm-5.1"),
        api_base=os.environ.get("LLM_EXTRACT_API_BASE", "http://127.0.0.1:4000/v1"),
        api_key=os.environ.get(os.environ.get("LLM_EXTRACT_API_KEY_ENV", "LITELLM_PROXY_KEY"), ""),
        temperature=0,  # 抽取要确定性,不要创造力
    )
    res = adapter.call(system, user, skip_budget=True)
    if res.get("status") != "success":
        raise RuntimeError(f"抽取模型调用失败: {res.get('output', '')[:120]}")
    return res["output"]


def extract_pack_llm(text: str, call_fn=None) -> dict:
    """LLM 抽取 PACK 数字,返回与 pack_rd_check.extract() 同 shape。

    call_fn(system, user)->str:可注入(无模型链路时传 mock);默认走 LiteLLM 代理。
    """
    call = call_fn or _default_call
    raw = call(_SYS, _USER_TPL.format(text=text[:6000]))
    return _coerce(_parse_json(raw))


def extract_pack(text: str, use_llm: bool = False, call_fn=None) -> dict:
    """统一入口:正则优先,use_llm 时改用 LLM 抽取(judge 端无感知,shape 一致)。"""
    if use_llm:
        return extract_pack_llm(text, call_fn=call_fn)
    from importlib import import_module
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
    return import_module("pack_rd_check").extract(text)
