"""StepAssertions: 步间验证断言引擎，Harness L3 执行编排 + L6 约束层。

在步骤执行后立即检查输出是否满足硬性约束，提前拦截错误传播。
与 OutputLinter 的区别：
- OutputLinter: 格式/结构校验，失败时自愈重试
- StepAssertions: 语义/依赖约束，失败时按策略处理（中止/重试/警告）
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class AssertionResult:
    passed: bool
    assertion_type: str
    message: str
    severity: str = "hard_fail"  # hard_fail / retry / warn


@dataclass
class AssertionReport:
    step_id: str
    all_passed: bool
    results: list[AssertionResult] = field(default_factory=list)

    @property
    def hard_failures(self) -> list[AssertionResult]:
        return [r for r in self.results if not r.passed and r.severity == "hard_fail"]

    @property
    def retryable(self) -> bool:
        return any(not r.passed and r.severity == "retry" for r in self.results)

    @property
    def warnings(self) -> list[AssertionResult]:
        return [r for r in self.results if not r.passed and r.severity == "warn"]


class StepAssertions:
    """步间断言引擎。

    YAML 配置示例（flow_*.yaml）：
        steps:
          - id: opc_leader
            assertions:
              post:
                - type: output_not_empty
                - type: contains_all
                  values: ["客户画像", "核心需求"]
                  on_fail: hard_fail
                - type: min_word_count
                  count: 50
                  on_fail: retry
              propagation:
                - type: context_field_required
                  field: "客户等级"
                  downstream: ["market_intel"]
    """

    def check_post(
        self,
        step_id: str,
        output: str,
        assertions: list[dict],
        context: dict | None = None,
    ) -> AssertionReport:
        """执行 step 的后置断言（output 已产出后）。"""
        if not assertions:
            return AssertionReport(step_id=step_id, all_passed=True)

        results = []
        for a in assertions:
            atype = a.get("type", "")
            on_fail = a.get("on_fail", "hard_fail")
            handler = _POST_HANDLERS.get(atype)
            if handler is None:
                logger.warning("未知断言类型: %s，跳过", atype)
                continue
            passed, msg = handler(output, a, context or {})
            results.append(
                AssertionResult(
                    passed=passed,
                    assertion_type=atype,
                    message=msg,
                    severity=on_fail if not passed else "hard_fail",
                )
            )

        all_passed = all(r.passed for r in results)
        return AssertionReport(step_id=step_id, all_passed=all_passed, results=results)

    def check_propagation(
        self,
        step_id: str,
        output: str,
        propagation: list[dict],
    ) -> AssertionReport:
        """检查传播给下游的字段是否存在（在当前步骤输出中提取）。"""
        if not propagation:
            return AssertionReport(step_id=step_id, all_passed=True)

        results = []
        for p in propagation:
            ptype = p.get("type", "")
            on_fail = p.get("on_fail", "warn")  # 传播失败默认 warn
            if ptype == "context_field_required":
                field_name = p.get("field", "")
                found = field_name in output if field_name else True
                msg = (
                    f"步骤 {step_id} 输出中未找到字段「{field_name}」，下游 {p.get('downstream', [])} 可能无法正确执行"
                    if not found
                    else "OK"
                )
                results.append(
                    AssertionResult(
                        passed=found,
                        assertion_type="context_field_required",
                        message=msg,
                        severity=on_fail if not found else "warn",
                    )
                )

        all_passed = all(r.passed for r in results)
        return AssertionReport(step_id=step_id, all_passed=all_passed, results=results)


# ─── 断言处理器 ───────────────────────────────────────────


def _assert_output_not_empty(output: str, _cfg: dict, _ctx: dict) -> tuple[bool, str]:
    ok = bool(output.strip()) and not output.startswith("[ERROR]")
    return ok, ("OK" if ok else "输出为空或为错误信息")


def _assert_contains_all(output: str, cfg: dict, _ctx: dict) -> tuple[bool, str]:
    values = cfg.get("values", [])
    missing = [v for v in values if v not in output]
    if missing:
        return False, f"输出缺少必需内容：{missing}"
    return True, "OK"


def _assert_contains_any(output: str, cfg: dict, _ctx: dict) -> tuple[bool, str]:
    values = cfg.get("values", [])
    found = any(v in output for v in values)
    if not found:
        return False, f"输出未包含以下任一内容：{values}"
    return True, "OK"


def _assert_min_word_count(output: str, cfg: dict, _ctx: dict) -> tuple[bool, str]:
    count = cfg.get("count", 0)
    actual = len(output.replace(" ", "").replace("\n", ""))
    if actual < count:
        return False, f"输出字数不足（{actual} < {count}）"
    return True, "OK"


def _assert_json_extractable(output: str, cfg: dict, _ctx: dict) -> tuple[bool, str]:
    """验证输出中能提取特定字段（用正则）。"""
    fields = cfg.get("fields", [])
    for f in fields:
        pattern = rf"{re.escape(f)}[：:]\s*(\S+)"
        if not re.search(pattern, output):
            return False, f"无法从输出中提取字段「{f}」（格式：{f}：值）"
    return True, "OK"


def _assert_no_error_marker(output: str, _cfg: dict, _ctx: dict) -> tuple[bool, str]:
    if output.startswith("[ERROR]"):
        return False, f"输出包含错误标记: {output[:100]}"
    return True, "OK"


def _assert_language_match(output: str, cfg: dict, _ctx: dict) -> tuple[bool, str]:
    """检查输出语言是否符合要求（中文/英文）。"""
    expected = cfg.get("language", "zh")
    if expected == "zh":
        chinese_ratio = sum(1 for c in output if "\u4e00" <= c <= "\u9fff") / max(len(output), 1)
        if chinese_ratio < 0.1:
            return False, f"要求中文输出，但检测到大量非中文内容（中文占比 {chinese_ratio:.1%}）"
    return True, "OK"


def _assert_score_above(output: str, cfg: dict, ctx: dict) -> tuple[bool, str]:
    """检查前序步骤的质量评分是否达标（用于条件触发）。"""
    threshold = cfg.get("threshold", 3.0)
    step_id = cfg.get("from_step")
    # 从 context 的 steps 中查找质量评分
    for step in ctx.get("steps", []):
        if step_id and step.get("step") != step_id:
            continue
        score = step.get("quality_score", {})
        if isinstance(score, dict):
            total = score.get("total_score", 0)
            if total < threshold:
                return False, f"步骤 {step.get('step', '?')} 质量评分 {total:.1f} 低于阈值 {threshold}"
    return True, "OK"


def _assert_number_provenance(output: str, cfg: dict, ctx: dict) -> tuple[bool, str]:
    """财务数字回链闸:output 里每个财务数字必须能回链到已验证事实,否则判幻觉、整段作废。

    facts 取自 ctx[cfg.get('facts_key','verified_facts')](由数据摄入步写入)。
    无 facts:默认放行(非破坏);cfg.require_facts=True 时按 GIGO 门 hard_fail。
    """
    facts_key = cfg.get("facts_key", "verified_facts")
    facts = ctx.get(facts_key) if isinstance(ctx, dict) else None
    if not facts:
        if cfg.get("require_facts"):
            return False, f"缺少已验证事实(ctx.{facts_key}),拒绝出数(GIGO:地基不夯不出数)"
        return True, f"无 {facts_key},跳过数字回链(未提供已验证事实)"
    try:
        from src.finance_validators import verify_numbers
    except Exception as e:  # noqa: BLE001
        return True, f"finance_validators 不可用,跳过回链:{e}"
    res = verify_numbers(output, facts)
    if res.passed:
        return True, "OK(财务数字全部可溯源)"
    return False, f"发现 {len(res.gaps)} 个无来源数字(疑幻觉,整段应作废):{res.gaps[:8]}"


# 实质数字断言:带金额/百分比/数量/倍数单位的断言(年份/裸序号不算),用于判定是否需要免责标注。
# 2026-06-09 安全审查:旧版只认"阿拉伯数字+中文单位",中文数字(一点五亿)、成语(破百亿/毛利三成)、
# 英文金额(1.5B)可绕过本诚实闸 → 绿灯造假。扩检测面但保持低误伤:中文量级须由小写数字(一~十/两)
# 前导,避免"千万别/万一/三件事"等纯流程文本被错拦(逼用户绕过闸=闸形同虚设)。校准见 gate_calibration.py。
_ZH_SMALL = "一二三四五六七八九十两"  # 个位~十/两:作量级前导,与"千万不要"成语词隔离
_MAG = "百千万亿"  # 量级词
_QUANT_CLAIM = re.compile(
    # 1) 阿拉伯数字 + 单位(保持原行为)
    r"\d[\d,]*(?:\.\d+)?\s*(?:亿|万元|万|千|元|%|％|倍|件|台|套|个|人|天|年化|成)"
    # 2) 中文数字(小写前导)+ 量级词 [+ 尾随单位]:三千万 / 一点五亿 / 十万件
    rf"|[{_ZH_SMALL}][{_ZH_SMALL}点]*[{_MAG}]+\s*(?:亿|万|元|%|％|倍|件|台|套)?"
    # 3) 中文数字 + 金融比例单位(无需量级):三倍 / 毛利三成
    rf"|[{_ZH_SMALL}]+\s*[倍成]"
    # 4) 量级成语:破百亿 / 过亿 / 近千万 / 超万亿
    rf"|(?:破|过|超|逾|近|约)\s*[{_ZH_SMALL}]*\s*[{_MAG}]"
    # 5) 英文金额:1.5B / 1.5M revenue / 3 billion
    r"|\d+(?:\.\d+)?\s*(?:[MBK]\b|million|billion)"
)


def _assert_disclaimer_when_unverified(output: str, cfg: dict, ctx: dict) -> tuple[bool, str]:
    """无已验证事实时,输出必须显式标注"未经审计验证"免责,否则判绿灯造假。

    与 number_provenance 互补(产品决策=标注未核实而非拒绝出数):
      - ctx.verified_facts 存在 → 由 number_provenance 抓编数,本闸放行(数字已可溯源,无需免责)
      - ctx.verified_facts 为空(用户口述,无审计源)→ 输出必须含 marker,否则 fail
        (结构上拿走"把口述数字冒充已核实事实"的可能,不靠 prompt 道德说教)
    """
    facts_key = cfg.get("facts_key", "verified_facts")
    facts = ctx.get(facts_key) if isinstance(ctx, dict) else None
    if facts:
        return True, "OK(已有已验证事实,数字由 number_provenance 把关,无需免责标注)"
    markers = cfg.get("markers") or ["未经审计验证", "未核实", "用户口述"]
    if any(m in output for m in markers):
        return True, "OK(无审计源,已诚实标注未核实)"
    # 精校(2026-06-09 gate_calibration 发现误伤):仅当输出含实质数字断言(带金额/百分比/数量单位)
    # 才要求免责;纯流程/无数字结论(如"本议案需进一步核实后再议")无需免责,避免误伤诚实输出。
    if not _QUANT_CLAIM.search(output):
        return True, "OK(无实质数字断言,无需免责标注)"
    return False, f"无已验证事实却未标注免责({'/'.join(markers)}),疑把口述数字冒充已核实事实(绿灯造假)"


def _assert_high_stakes_claim_guarded(output: str, cfg: dict, ctx: dict) -> tuple[bool, str]:
    """customer_invariant 家族 · 高风险承诺护栏(确定性·零 LLM·空源 fail-secure)。

    大神天才设计共识(2026-06-09):把质检尺子从"LLM 自评"换成"客户能复述的外部事实",
    且空对账源时必须 fail-secure 而非放行(Bezos 失败路径③:空库默认放行=橡皮图章)。

    规则:输出里出现高风险承诺措辞(赔付/包赔/全额退/免费更换/责任在我方…)时——
      - 有授权对账源(ctx[authorizing_key] 为真,如命中质保条款)→ 放行(承诺有据)
      - 无授权源 → 输出必须挂人工签字门(signoff_marker),否则 hard_fail
        (结构上拿走"凭空向客户承诺不可逆赔付"的可能,这是单向门,必须深)
    无任何高风险措辞 → 放行(没做承诺,无需护栏)。

    cfg: claim_markers(高风险措辞表)·authorizing_key(授权对账源 ctx 键,可空)·
         signoff_marker(无授权时必须出现的人工签字标记)
    """
    claim_markers = cfg.get("claim_markers") or [
        "赔付",
        "包赔",
        "全额赔",
        "全额退",
        "免费更换",
        "免费换新",
        "免费维修",
        "责任在我方",
        "我方承担",
        "承诺赔偿",
        "保证赔",
    ]
    hit = [m for m in claim_markers if m in output]
    if not hit:
        return True, "OK(无高风险承诺措辞,无需护栏)"
    authorizing_key = cfg.get("authorizing_key", "warranty_facts")
    authorized = bool(ctx.get(authorizing_key)) if isinstance(ctx, dict) else False
    if authorized:
        return True, f"OK(高风险承诺有授权源 ctx.{authorizing_key} 背书)"
    signoff_marker = cfg.get("signoff_marker", "需人工签字")
    if signoff_marker in output:
        return True, f"OK(无授权源但已挂人工签字门「{signoff_marker}」)"
    return False, (
        f"出现高风险承诺{hit[:5]}却无授权源(ctx.{authorizing_key})、也未挂签字门「{signoff_marker}」"
        f"——疑凭空向客户承诺不可逆赔付(fail-secure 拦下)"
    )


_POST_HANDLERS: dict[str, Any] = {
    "number_provenance": _assert_number_provenance,
    "disclaimer_when_unverified": _assert_disclaimer_when_unverified,
    "high_stakes_claim_guard": _assert_high_stakes_claim_guarded,
    "output_not_empty": _assert_output_not_empty,
    "contains_all": _assert_contains_all,
    "contains_any": _assert_contains_any,
    "min_word_count": _assert_min_word_count,
    "json_extractable": _assert_json_extractable,
    "no_error_marker": _assert_no_error_marker,
    "language_match": _assert_language_match,
    "score_above": _assert_score_above,
}
