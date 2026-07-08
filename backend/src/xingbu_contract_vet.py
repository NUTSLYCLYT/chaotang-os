"""src/xingbu_contract_vet.py — 刑部合同红线确定性门(回链 config/xingbu_contract_redlines.yaml)。

2026-07-07 补刑部第二个"司"(此前只有 xingbu_verdict 的 LLM findings 单司)。合同红线阈值是
法律/商务判断,故用可评审 config 承载。三档语义,把"谁定的阈值"从灯色/标注上就区分开,
防止有人拿未经法务确认的数当法律结论:
- placeholder    → 占位,超阈值只 yellow 提醒,不亮 red(建门初期);
- expert_default → 专家默认v1(合同法经济posner+边界schneier出的可辩护行业默认值),门上膛能亮
  red,但每条带"专家默认·贵司法务可调"标注(当前档,让门先可用,用户后改);
- confirmed      → 贵司法务确认,超阈值亮 red 作准,无标注。
一票 red 条款(无限责任/单方解除…)结构性风险不靠数字:未上膛只 yellow,上膛(专家默认/已确认)才 red。

# ponytail: 违约金%/账期天数用"锚词±窗口找数字"的启发式抽取,够挡明显超限;精确条款解析需
# 法律 NLP,不在此层——所以确认后也建议人工复核,vet 只做第一道机器筛。非法律意见。

# ponytail: 违约金%/账期天数用"锚词±窗口找数字"的启发式抽取,够挡明显超限;精确条款解析需
# 法律 NLP,不在此层——所以确认后也建议人工复核,vet 只做第一道机器筛。
"""

from __future__ import annotations

import re
from pathlib import Path

from src import court_doc_builder as cdb

_CFG_PATH = (
    Path(__file__).resolve().parent.parent / "config" / "xingbu_contract_redlines.yaml"
)
_CFG_CACHE: dict | None = None


def _load_cfg() -> dict:
    global _CFG_CACHE
    if _CFG_CACHE is None:
        try:
            import yaml

            _CFG_CACHE = yaml.safe_load(_CFG_PATH.read_text(encoding="utf-8")) or {}
        except Exception:
            _CFG_CACHE = {}
    return _CFG_CACHE


def _num_near(
    text: str, anchors: list[str], unit_re: str, window: int = 40
) -> float | None:
    """在任一锚词附近 window 字内找 `数字+单位`,返回首个数字。找不到→None。"""
    rx = re.compile(r"(\d+(?:\.\d+)?)\s*(?:" + unit_re + ")")
    for kw in anchors or []:
        i = text.find(kw)
        while i != -1:
            seg = text[i : i + len(kw) + window]
            m = rx.search(seg)
            if m:
                return float(m.group(1))
            i = text.find(kw, i + 1)
    return None


def vet_contract(contract_text: str) -> list[dict]:
    """合同文本 × 红线清单 → court_doc items。占位期最高 yellow,确认期超阈值 red。"""
    cfg = _load_cfg()
    if not cfg:
        return [
            {
                "level": "yellow",
                "title": "合同红线清单缺失,人工复核",
                "fix": None,
                "evidence_ref": "truth://xingbu/contract",
            }
        ]
    text = contract_text or ""
    status = cfg.get("status", "placeholder")
    armed = status in ("expert_default", "confirmed")  # 上膛=能亮 red
    ver = cfg.get("version", "?")
    th = cfg.get("thresholds") or {}
    anchors = cfg.get("extract_anchors") or {}
    ref = f"truth://xingbu/contract_redline@v{ver}"
    if status == "confirmed":
        tag = ""
    elif status == "expert_default":
        tag = "(专家默认·贵司法务可调)"
    else:
        tag = "(阈值占位·须法务确认后方作准)"

    def breach(level_if_armed: str, title: str, sub: str) -> dict:
        # 未上膛(placeholder)一律降 yellow;上膛(专家默认/已确认)用真实严重度
        lvl = level_if_armed if armed else "yellow"
        return {
            "level": lvl,
            "title": f"{title}{tag}",
            "fix": None,
            "evidence_ref": f"{ref}#{sub}",
        }

    items: list[dict] = []

    # 1) 一票 red 条款
    for clause in cfg.get("one_vote_red_clauses") or []:
        if clause in text:
            items.append(
                breach("red", f"命中一票红线条款:「{clause}」", f"clause/{clause}")
            )

    # 2) 违约金比例
    cap = th.get("违约金比例上限_pct")
    pen = _num_near(text, anchors.get("违约金", []), r"%|％")
    if cap is not None and pen is not None:
        if pen > cap:
            items.append(
                breach("red", f"违约金比例 {pen:.0f}% 超红线上限 {cap}%", "penalty")
            )
        else:
            items.append(
                {
                    "level": "green",
                    "title": f"违约金比例 {pen:.0f}% ≤ 上限 {cap}%{tag}",
                    "fix": None,
                    "evidence_ref": f"{ref}#penalty",
                }
            )

    # 3) 账期天数
    cap_d = th.get("账期上限_天")
    warn_d = th.get("账期预警_天")
    days = _num_near(text, anchors.get("账期", []), r"天|日")
    if days is not None:
        if cap_d is not None and days > cap_d:
            items.append(
                breach(
                    "red",
                    f"账期 {days:.0f} 天超红线上限 {cap_d} 天(现金流风险,联动户部)",
                    "term",
                )
            )
        elif warn_d is not None and days > warn_d:
            items.append(
                {
                    "level": "yellow",
                    "title": f"账期 {days:.0f} 天超预警线 {warn_d} 天{tag}",
                    "fix": "评估现金流压力,必要时缩短账期",
                    "evidence_ref": f"{ref}#term",
                }
            )
        else:
            items.append(
                {
                    "level": "green",
                    "title": f"账期 {days:.0f} 天在阈值内{tag}",
                    "fix": None,
                    "evidence_ref": f"{ref}#term",
                }
            )

    # 4) 质保期
    floor_y = th.get("质保期下限_年")
    yrs = _num_near(text, anchors.get("质保", []), r"年")
    if floor_y is not None and yrs is not None and yrs < floor_y:
        items.append(
            {
                "level": "yellow",
                "title": f"质保期 {yrs:.0f} 年低于下限 {floor_y} 年{tag}",
                "fix": "确认是否满足客户/行业质保要求",
                "evidence_ref": f"{ref}#warranty",
            }
        )

    if not items:
        items.append(
            {
                "level": "yellow",
                "title": f"未从合同抽到可核红线项(违约金/账期/条款)—— 人工复核{tag}",
                "fix": "确认合同文本完整",
                "evidence_ref": ref,
            }
        )
    return items


def build_contract_verdict(
    contract_text: str,
    *,
    case_id: str | None = None,
    question: str = "",
    archive: bool = True,
) -> dict:
    cfg = _load_cfg()
    _note_by_status = {
        "confirmed": "(阈值已法务确认)",
        "expert_default": "(专家默认v1·贵司法务可调)",
        "placeholder": "(阈值占位·待法务确认)",
    }
    note = "合同红线复核" + _note_by_status.get(
        cfg.get("status", "placeholder"), "(待确认)"
    )
    return cdb.build_court_doc(
        "xingbu",
        items=vet_contract(contract_text),
        case_id=case_id,
        question=question,
        shielded="为你拦下了:违约金/账期超红线、无限责任等一票条款",
        archive=archive,
        headline_map={
            "green": "可签 —— 未触已确认红线",
            "yellow": "待核 —— 有疑超红线项/阈值待法务确认",
            "red": "建议驳回 —— 触合同红线,请复核后定夺(决策在你,朝堂只提醒)",
            "black": "高危 —— 移交法务深查",
        },
        pending_note=note,
        source_label="LIVE_SWARM",
    )


def _looks_like_contract(task_text: str) -> bool:
    """是否像"查合同红线"任务:命中合同红线信号词。"""
    kws = ("合同", "违约金", "账期", "条款", "质保", "无限责任", "回购", "协议")
    return any(k in (task_text or "") for k in kws)


if __name__ == "__main__":
    c = "本合同违约金为合同金额的50%,账期120天,含无限责任条款。"

    # 专家默认档(当前 config):门上膛,超阈值亮 red,但带"专家默认·法务可调"标注
    items = vet_contract(c)
    assert any(it["level"] == "red" for it in items), f"专家默认档应亮 red: {items}"
    assert any(
        "专家默认" in it["title"] for it in items
    ), f"红线须带专家默认标注: {items}"
    assert any("一票红线" in it["title"] for it in items), items
    print("专家默认档判定:", [(it["level"], it["title"][:44]) for it in items])

    # 占位档:超阈值只 yellow,不产权威 red
    _CFG_CACHE = {
        "status": "placeholder",
        "version": 1,
        "thresholds": {"违约金比例上限_pct": 30, "账期上限_天": 90},
        "one_vote_red_clauses": ["无限责任"],
        "extract_anchors": {"违约金": ["违约金"], "账期": ["账期"]},
    }
    pi = vet_contract(c)
    assert all(it["level"] != "red" for it in pi), f"占位档不该产 red: {pi}"
    _CFG_CACHE = None  # 复位,别影响下一段

    # 模拟 confirmed:超阈值才 red
    _CFG_CACHE = {
        "status": "confirmed",
        "version": 1,
        "thresholds": {"违约金比例上限_pct": 30, "账期上限_天": 90},
        "one_vote_red_clauses": ["无限责任"],
        "extract_anchors": {"违约金": ["违约金"], "账期": ["账期"]},
    }
    ri = vet_contract(c)
    assert any(it["level"] == "red" for it in ri), f"确认期超阈值应 red: {ri}"
    print("确认期判定:", [(it["level"], it["title"][:40]) for it in ri])
    print("xingbu_contract_vet 自检通过:占位≤yellow / 确认超阈值red / 一票条款")
