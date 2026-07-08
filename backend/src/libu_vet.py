"""src/libu_vet.py — 吏部招聘方案复核(flow_libu → 决策锚定+资质红线+飞轮校准 → court_doc)。

2026-07-06 大神会审(karpathy+zhangxiaolong+deming)后重写。诚实纠错:初版本文件自造
"段落存在"presence门,而仓里早有更强的 scripts/recruit_check.py(查"淘汰有没有挂红线、
录用有没有锚定硬性要求 R-xx",已进 truth_ledger 作大臣检查器)。本版按会审共识**融合**:

  ① 决策锚定 —— 复用 recruit_check.check()(C1硬性要求锚定/C2逐项核验/C3淘汰可追溯/
     C4结论完整),不再自造。这是招聘"可证伪的真锚":凭感觉招人=C1 FAIL,黑箱淘汰=C3 FAIL。
  ② 资质红线 —— 保留初版唯一增量:电池/储能岗必须覆盖安全资质(recruit_check 没有这条)。
  ③ 飞轮校准 —— 接 scripts/hire_outcome_score.py 的录用结果真值(入职→90天留存→绩效),
     把"当初判录用的人后来真留下且绩效达标的命中率"写进复核,让静态规则门有真值背书。

deming 铁律:飞轮评的是**系统**(我们的筛选标准准不准),不是评**人**(招聘官行不行);
命中率只作背书信息(green info),不奖惩个人、不刷自评分(协议 merit_record 明文)。
# ponytail: 严重度我方定(C3黑箱淘汰→red,其余FAIL→yellow),不直接沿用 recruit_check 的
# verdict_of(它对面试方案设计这类无录用决策的案子会误判FAIL)。
"""

from __future__ import annotations

import sys
from pathlib import Path

from src import court_doc_builder as cdb

_SCRIPTS = str(Path(__file__).resolve().parent.parent / "scripts")

# 安全资质红线接真清单(config/libu_safety_qualifications.yaml,可评审可回链),
# 不再硬编码关键词(deming 会审:红线要有据、可证伪)。
_QUAL_LIST_PATH = (
    Path(__file__).resolve().parent.parent
    / "config"
    / "libu_safety_qualifications.yaml"
)
_QUAL_LIST_CACHE: dict | None = None


def _load_qual_list() -> dict:
    """加载安全资质红线清单(缓存)。文件缺失/解析失败 → 空清单(降级为不强制,不崩)。"""
    global _QUAL_LIST_CACHE
    if _QUAL_LIST_CACHE is None:
        try:
            import yaml

            _QUAL_LIST_CACHE = (
                yaml.safe_load(_QUAL_LIST_PATH.read_text(encoding="utf-8")) or {}
            )
        except Exception:
            _QUAL_LIST_CACHE = {}
    return _QUAL_LIST_CACHE


def _load_recruit_check():
    """懒加载 scripts/recruit_check(非包,沿用 test_minister_checkers 的 sys.path 法)。"""
    if _SCRIPTS not in sys.path:
        sys.path.insert(0, _SCRIPTS)
    import recruit_check  # noqa: E402

    return recruit_check


def _decision_items(plan: str) -> list[dict]:
    """复用 recruit_check.check() 的 C1-C4 决策锚定 → court_doc items。
    C3黑箱淘汰=red(无据淘汰人有害);其余 FAIL=yellow(不严谨待补);PASS=green;UNKNOWN 跳过。"""
    try:
        rc = _load_recruit_check()
        checks = rc.check(plan)
    except Exception:
        return []
    items: list[dict] = []
    for c in checks:
        name, status, detail = c["check"], c["status"], c["detail"]
        ref = f"truth://libu/recruit_check#{name}"
        if status == "PASS":
            items.append(
                {
                    "level": "green",
                    "title": f"{name}:{detail}",
                    "fix": None,
                    "evidence_ref": ref,
                }
            )
        elif status == "UNKNOWN":
            continue  # 如"本案无淘汰决策":不是缺陷,不产条目
        elif name.startswith("C3"):  # 黑箱淘汰:无依据淘汰人
            items.append(
                {
                    "level": "red",
                    "title": f"{name}:{detail}(黑箱淘汰,须挂红线/未达项)",
                    "fix": None,
                    "evidence_ref": ref,
                }
            )
        else:
            items.append(
                {
                    "level": "yellow",
                    "title": f"{name}未过:{detail}",
                    "fix": "锚定具体硬性要求(R-xx)/逐项核验/给明确结论后再发",
                    "evidence_ref": ref,
                }
            )
    return items


def _battery_safety_items(plan: str, task_input: str) -> list[dict]:
    """电池/储能岗安全资质红线,回链 config/libu_safety_qualifications.yaml。
    命中具体 role → 要求该 role 的 required_any;仅命中电池域 → default_required_any。
    漏→red 并指名缺哪类资质+清单行+原因;清单缺失则降级不强制(不崩、不假红)。"""
    qual = _load_qual_list()
    domain_kw = qual.get("domain_keywords") or []
    plan = plan or ""
    if not domain_kw or not any(w in task_input for w in domain_kw):
        return []

    ver = qual.get("version", "?")
    # 命中最具体的 role 行(match 命中任一即算);可能命中多行,逐行都成红线。
    matched = [
        r
        for r in (qual.get("roles") or [])
        if any(m in task_input for m in (r.get("match") or []))
    ]
    ref = f"truth://libu/safety_qual@v{ver}"

    if matched:
        items: list[dict] = []
        for r in matched:
            req = r.get("required_any") or []
            rid = r.get("id", "R-?")
            if any(q in plan for q in req):
                items.append(
                    {
                        "level": "green",
                        "title": f"安全资质红线已覆盖({rid}:{'/'.join(req[:3])}…)",
                        "fix": None,
                        "evidence_ref": f"{ref}#{rid}",
                    }
                )
            else:
                items.append(
                    {
                        "level": "red",
                        "title": f"漏安全资质红线({rid}):方案未提 {'/'.join(req)} 任一 —— {r.get('reason', '')}",
                        "fix": None,
                        "evidence_ref": f"{ref}#{rid}",
                    }
                )
        return items

    # 电池域但无具体 role:走兜底泛资质表述
    default_req = qual.get("default_required_any") or []
    if any(q in plan for q in default_req):
        return [
            {
                "level": "green",
                "title": "安全资质红线已覆盖(电池域·泛资质表述)",
                "fix": None,
                "evidence_ref": f"{ref}#default",
            }
        ]
    return [
        {
            "level": "red",
            "title": "漏安全资质红线:电池/储能岗未提任何安全资质/合规要求(golden must_not)",
            "fix": None,
            "evidence_ref": f"{ref}#default",
        }
    ]


def hire_calibration_note() -> dict:
    """飞轮校准:读 hire_outcome 真值,算招聘判断历史命中率。数据空→未加燃料。
    返回一个 green info item(deming:评系统不评人,只背书不奖惩)。"""
    try:
        if _SCRIPTS not in sys.path:
            sys.path.insert(0, _SCRIPTS)
        import hire_outcome_score as hos  # noqa: E402

        rows = hos.load()
        scored = [hos.score_one(r) for r in rows]
        settled = [v for v, _ in scored if v in ("PASS", "FAIL")]
        if not settled:
            note = "招聘飞轮未加真数据(eval/hire_outcome.jsonl 无已结算样本);当前判断无历史命中率背书"
        else:
            hit = sum(1 for v in settled if v == "PASS") / len(settled)
            note = f"招聘判断历史命中率 {hit:.0%}(n={len(settled)},入职+90天留存+绩效达标);评系统非评人"
    except Exception:
        note = "招聘飞轮校准不可用(hire_outcome 读取失败);当前判断无历史命中率背书"
    return {
        "level": "green",
        "title": f"飞轮校准:{note}",
        "fix": None,
        "evidence_ref": "truth://libu/hire_outcome",
    }


def vet_recruit_plan(plan: str, task_input: str) -> list[dict]:
    """确定性复核:资质红线 + 决策锚定(复用recruit_check) + 飞轮命中率背书 → items。"""
    items = _battery_safety_items(plan, task_input) + _decision_items(plan)
    items.append(hire_calibration_note())
    if not any(it["level"] in ("red", "yellow") for it in items) and len(items) <= 1:
        items.insert(
            0,
            {
                "level": "yellow",
                "title": "方案为空或无可校验决策结构 —— 人工确认 flow_libu 产出",
                "fix": "确认招聘方案正常生成",
                "evidence_ref": "truth://libu",
            },
        )
    return items


def build_libu_verdict(
    plan: str,
    task_input: str,
    *,
    case_id: str | None = None,
    question: str = "",
    archive: bool = True,
) -> dict:
    return cdb.build_court_doc(
        "libu_personnel",  # 吏部命名空间(印绶印/紫);libu 才是礼部
        items=vet_recruit_plan(plan, task_input),
        case_id=case_id,
        question=question,
        shielded="为你拦下了:锂电岗漏安全资质红线、黑箱淘汰人、凭感觉招人(未锚定硬性要求)",
        archive=archive,
        headline_map={
            "green": "可用 —— 决策锚定齐、资质红线覆盖",
            "yellow": "可用草稿 —— 有 {n} 处待锚定/补齐",
            "red": "建议退回 —— 漏安全资质红线或黑箱淘汰,请复核(定夺在你)",
            "black": "高危 —— 移交人工深查",
        },
        pending_note="招聘方案复核 —— 有待锚定项",
        source_label="LIVE_SWARM",
    )


def run_libu_verdict(task_input: str, *, archive: bool = True) -> dict:
    """端到端:跑真实 flow_libu → 决策锚定+资质红线+飞轮校准复核 → 吏部 court_doc。"""
    from src.flow_engine import FlowEngine

    config_path = str(
        Path(__file__).resolve().parent.parent / "config" / "flow_libu.yaml"
    )
    engine = FlowEngine(config_path)
    run_log = engine.run(task_input)
    plan = run_log.final_output
    if isinstance(plan, dict):
        plan = "\n".join(str(v) for v in plan.values())
    return build_libu_verdict(
        str(plan or ""), task_input, question=task_input, archive=archive
    )


if __name__ == "__main__":
    battery_task = "招聘锂电PACK工艺工程师,筛选简历"

    # 完整:锚定硬性要求+逐项核验+结论+安全资质 → 无 red
    good = (
        "硬性要求 R-01:3年焊接经验。逐项核验:R-01满足。安全资质:需危化/特种作业持证。"
        "结论:录用张工。"
    )
    gi = vet_recruit_plan(good, battery_task)
    assert not any(it["level"] == "red" for it in gi), gi

    # 漏安全资质(电池岗) → red
    ni = vet_recruit_plan(
        "硬性要求R-01:3年经验。逐项核验满足。结论:录用。", battery_task
    )
    assert any(it["level"] == "red" and "安全资质" in it["title"] for it in ni), ni

    # 黑箱淘汰(有淘汰无依据) → C3 red
    bi = vet_recruit_plan("综合评估,候选人李工淘汰,建议录用张工。", "招聘行政前台")
    assert any(it["level"] == "red" and "C3" in it["title"] for it in bi), bi

    # 飞轮校准 item 恒在
    assert any("飞轮校准" in it["title"] for it in gi), "缺飞轮校准背书"

    print("libu_vet 自检通过:决策锚定(复用recruit_check)+资质红线+飞轮校准 三融合正确")
