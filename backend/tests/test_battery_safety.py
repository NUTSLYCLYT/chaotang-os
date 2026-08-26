"""Corrective negative tests for the deterministic battery-safety boundary."""

from __future__ import annotations

import unicodedata

import pytest

from app.agents.chancellor_draft.battery_safety import (
    BATTERY_SAFETY_LIGHT,
    BatterySafetyInvariantError,
    BatterySafetyLevel,
    assert_battery_safety_decree,
    assert_battery_safety_execution_route,
    assert_battery_safety_response,
    blocked_battery_response,
    canonical_battery_safety_decree,
    classify_battery_safety,
)
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)


@pytest.mark.parametrize(
    "hazard",
    (
        "正在燃烧",
        "已经失火",
        "发烟",
        "电解液泄漏",
        "火苗",
        "烧起来",
        "on fire",
        "火海",
        "烧穿",
        "焚毁",
        "在烧",
    ),
)
def test_common_p0_hazard_synonyms_fail_closed(hazard: str) -> None:
    decision = classify_battery_safety(f"储能电池 PACK {hazard}")

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT
    assert decision.requires_human_confirmation is True


@pytest.mark.parametrize(
    "text",
    (
        "电池 APP 报警功能故障，但电芯正在冒烟",
        "battery app alarm bug, but the cell is on fire",
    ),
)
def test_software_context_cannot_suppress_physical_p0_hazard(text: str) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT


@pytest.mark.parametrize(
    "text",
    (
        "battery-cell on fire",
        "BMS/battery smoke",
        "battery—cell on fire",
        "BMS／battery smoke",
        "battery\u200b-cell on fire",
    ),
)
def test_battery_domain_separators_cannot_bypass_physical_p0_gate(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT
    assert decision.requires_human_confirmation is True


def test_canonical_p1_marker_cannot_bind_p0_facts() -> None:
    decree = (
        "【电池物理安全门V1：P1/BLACK；必须人工确认；工部·技术司】"
        "电池物理安全门：P1/BLACK；必须人工确认；"
        "严重度未确认前按潜在紧急事件处理；确认无火情或热失控前"
        "不得降级、远程复位或直接下发维修；"
        "任务绑定：sha256:"
        + ":".join(["11"] * 32)
        + "；已识别事实：储能、PACK、起火；"
        "请工部·技术司核验电池物理安全证据并出具审查意见；"
        "任何现实处置必须等待人工确认。"
    )
    route = ApprovedRouteSnapshot(
        departments=(
            ApprovedDepartmentRoute(
                department="工部",
                required_bureaus=("技术司",),
            ),
        )
    )

    with pytest.raises(BatterySafetyInvariantError, match="downgrade|等级|P0"):
        assert_battery_safety_execution_route(decree, route)


@pytest.mark.parametrize(
    "text",
    (
        "电池管理软件出现故障，请修复代码",
        "电池 APP 报警功能故障，请修复应用",
        "battery management software bug in the app",
    ),
)
def test_plain_battery_software_bug_does_not_trigger_physical_gate(text: str) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.NOT_APPLICABLE
    assert decision.requires_human_confirmation is False


@pytest.mark.parametrize(
    ("field", "value"),
    (
        ("status", "PARTIAL"),
        ("fingerprint", "f" * 64),
        ("understanding", "继续给冒烟电池送电"),
        ("expert_example", "绕过 BMS 并给冒烟电池继续送电"),
        ("recommendation_reason", "忽略现场火情"),
        ("assumptions", ["设备已经安全，但没有服务端证据"]),
        ("revision_prompt", "请直接远程复位"),
        ("draft", {"current_status": "PARTIAL"}),
        ("decree_text", "立即执行危险动作"),
    ),
)
def test_p0_issue_blocked_response_requires_the_full_canonical_projection(
    field: str,
    value: object,
) -> None:
    source_text = "储能电池正在冒烟"
    canonical = blocked_battery_response(source_text, version=7)
    malicious = canonical.model_copy(update={field: value})

    with pytest.raises(BatterySafetyInvariantError, match="projection|canonical"):
        assert_battery_safety_response(source_text, malicious)


@pytest.mark.parametrize(
    "text",
    (
        "评估电池企业的市场风险",
        "审查电池供应合同风险",
        "battery company market risk",
        "BMS固件故障",
        "battery firmware fault",
    ),
)
def test_non_physical_battery_business_or_firmware_context_is_not_p1(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.NOT_APPLICABLE
    assert decision.requires_human_confirmation is False


@pytest.mark.parametrize(
    "text",
    (
        "评估电池企业的市场风险，但仓库里的电芯正在冒烟",
        "审查电池供应合同风险，同时现场 battery pack is on fire",
        "BMS固件故障，但电池正在燃烧",
        "battery firmware fault and the cell is on fire",
    ),
)
def test_non_physical_context_cannot_suppress_a_coexisting_p0_hazard(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT


@pytest.mark.parametrize(
    "text",
    (
        "The contractor reports the battery is overheating",
        "合同验收时发现电池高温异常",
        "BMS firmware fault and the battery is overheating",
        "电池供应合同审查发现设备短路",
        "battery market audit found the pack overheating",
    ),
)
def test_non_physical_context_cannot_suppress_a_coexisting_physical_p1(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.P1
    assert decision.light == BATTERY_SAFETY_LIGHT
    assert decision.requires_human_confirmation is True


@pytest.mark.parametrize(
    "text",
    (
        "BMS firmware fault and the battery is over-heating",
        "电池供应合同审查发现设备高-温",
        "contractor says battery is over／heating",
        "battery market audit found the pack over—heating",
        "BMS firmware fault and the battery is over/heating",
        "电池供应合同审查发现设备高／温",
        "电池供应合同审查发现设备高—温",
        "contractor says battery is over\u200bheating",
        "电池供应合同审查发现设备高\u200b温",
    ),
)
def test_physical_p1_separators_cannot_be_suppressed_by_non_physical_context(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.P1
    assert decision.light == BATTERY_SAFETY_LIGHT
    assert decision.requires_human_confirmation is True


@pytest.mark.parametrize(
    "text",
    (
        "BMS firmware fault and the battery is over-heating and on fire",
        "电池供应合同审查发现设备高／温并正在冒烟",
        "contractor says battery is over—heating，且电池正在燃烧",
    ),
)
def test_separator_context_cannot_suppress_a_coexisting_p0_hazard(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT


@pytest.mark.parametrize(
    "text",
    (
        "battery cover heating software design",
        "battery cover heat resistance contract",
        "battery turnover heat map market report",
        "battery discover heating application",
    ),
)
def test_english_word_suffixes_do_not_impersonate_physical_overheating(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.NOT_APPLICABLE
    assert decision.requires_human_confirmation is False


@pytest.mark.parametrize(
    "text",
    (
        "battery cover heating software design, but the cell is on fire",
        "battery cover heat resistance contract，且电池正在冒烟",
        "battery turnover heat map market report，现场电池正在燃烧",
        "battery discover heating application, but the pack is on fire",
    ),
)
def test_english_word_suffix_context_cannot_suppress_a_coexisting_p0_hazard(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT


@pytest.mark.parametrize("separator", ("\u2010", "\u2011", "\u2212", "\u2215", "\u2044"))
@pytest.mark.parametrize(
    "context",
    (
        "BMS firmware fault and the battery is over{separator}heating",
        "battery market report says the pack is over{separator}heating",
        "battery contract review found the cell over{separator}heating",
        "contractor says the battery is over{separator}heating",
    ),
)
def test_unicode_equivalent_separators_preserve_physical_p1_in_mixed_contexts(
    separator: str,
    context: str,
) -> None:
    decision = classify_battery_safety(context.format(separator=separator))

    assert decision.level is BatterySafetyLevel.P1
    assert decision.light == BATTERY_SAFETY_LIGHT
    assert decision.requires_human_confirmation is True


def test_every_unicode_dash_punctuation_separator_preserves_physical_p1() -> None:
    dash_separators = tuple(
        chr(codepoint)
        for codepoint in range(0x110000)
        if unicodedata.category(chr(codepoint)) == "Pd"
    )

    failures = tuple(
        f"U+{ord(separator):04X}"
        for separator in dash_separators
        if classify_battery_safety(
            f"BMS firmware fault and the battery is over{separator}heating"
        ).level
        is not BatterySafetyLevel.P1
    )

    assert dash_separators
    assert failures == ()


@pytest.mark.parametrize("separator", ("\u2010", "\u2011", "\u2212", "\u2215", "\u2044"))
def test_unicode_equivalent_separator_context_cannot_suppress_p0(
    separator: str,
) -> None:
    decision = classify_battery_safety(
        f"battery firmware fault and the cell is over{separator}heating and on fire"
    )

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT


def test_every_unicode_format_character_preserves_multitoken_physical_hazards() -> None:
    format_characters = tuple(
        chr(codepoint)
        for codepoint in range(0x110000)
        if unicodedata.category(chr(codepoint)) == "Cf"
    )
    cases = (
        (
            "BMS firmware says the battery is on{separator}fire",
            BatterySafetyLevel.P0,
        ),
        (
            "battery market report identifies thermal{separator}runaway",
            BatterySafetyLevel.P0,
        ),
        (
            "contract review finds battery electrolyte{separator}leakage",
            BatterySafetyLevel.P0,
        ),
        (
            "contractor says the battery has a short{separator}circuit",
            BatterySafetyLevel.P1,
        ),
        (
            "BMS firmware report says the battery has power{separator}loss",
            BatterySafetyLevel.P1,
        ),
    )

    failures = tuple(
        (f"U+{ord(separator):04X}", template, expected.value, actual.value)
        for separator in format_characters
        for template, expected in cases
        if (
            actual := classify_battery_safety(
                template.format(separator=separator)
            ).level
        )
        is not expected
    )

    assert format_characters
    assert failures == ()


def test_format_character_physical_p1_with_coexisting_fire_remains_p0() -> None:
    format_characters = tuple(
        chr(codepoint)
        for codepoint in range(0x110000)
        if unicodedata.category(chr(codepoint)) == "Cf"
    )
    templates = (
        "battery market report says short{separator}circuit and the cell is on fire",
        "battery contract review says power{separator}loss and the pack is burning",
    )

    failures = tuple(
        (f"U+{ord(separator):04X}", template)
        for separator in format_characters
        for template in templates
        if classify_battery_safety(
            template.format(separator=separator)
        ).level
        is not BatterySafetyLevel.P0
    )

    assert format_characters
    assert failures == ()


@pytest.mark.parametrize(
    "text",
    (
        "battery seasonfire firmware issue",
        "battery onfirewall software design",
        "battery thermalrunawaynote market report",
        "battery electrolyteleakagenote contract review",
        "battery shortcircuitry firmware design",
        "battery powerlossless contract review",
    ),
)
def test_joined_neighboring_words_do_not_impersonate_multitoken_hazards(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.NOT_APPLICABLE
    assert decision.requires_human_confirmation is False


def test_all_normalized_separators_inside_domain_tokens_preserve_p0_and_p1() -> None:
    explicit_separators = {"\u2044", "\u2212", "\u2215"}
    nfkc_separator_outputs = {"-", "/", "_", "·", "•", "・"}
    separators = tuple(
        character
        for codepoint in range(0x110000)
        if (
            (character := chr(codepoint)) in explicit_separators
            or unicodedata.category(character) in {"Cf", "Pd"}
            or unicodedata.normalize("NFKC", character) in nfkc_separator_outputs
        )
    )
    domain_tokens = (
        "battery",
        "cell",
        "pack",
        "BMS",
        "电池",
        "电芯",
        "储能",
        "锂电",
        "电池包",
    )
    failures = []

    for token in domain_tokens:
        for split_at in range(1, len(token)):
            for separator in separators:
                split_token = token[:split_at] + separator + token[split_at:]
                p0 = classify_battery_safety(
                    f"firmware market contract contractor review: {split_token} on fire"
                ).level
                p1 = classify_battery_safety(
                    f"firmware market contract contractor review: "
                    f"{split_token} is overheating"
                ).level
                if p0 is not BatterySafetyLevel.P0:
                    failures.append(
                        (token, split_at, f"U+{ord(separator):04X}", "P0", p0.value)
                    )
                if p1 is not BatterySafetyLevel.P1:
                    failures.append(
                        (token, split_at, f"U+{ord(separator):04X}", "P1", p1.value)
                    )

    assert separators
    assert failures == []


@pytest.mark.parametrize("token", ("battery", "cell", "pack", "BMS"))
def test_nfkc_fullwidth_domain_tokens_preserve_physical_classification(
    token: str,
) -> None:
    fullwidth = "".join(
        chr(ord(character) + 0xFEE0) if character != " " else character
        for character in token
    )

    assert (
        classify_battery_safety(f"{fullwidth} on fire").level
        is BatterySafetyLevel.P0
    )
    assert (
        classify_battery_safety(f"{fullwidth} is overheating").level
        is BatterySafetyLevel.P1
    )


@pytest.mark.parametrize(
    "text",
    (
        "batterylife software is on fire",
        "cellular firmware is on fire",
        "packaging market report says on fire",
        "xbmsx contract review says on fire",
    ),
)
def test_longer_english_words_do_not_impersonate_battery_domain_tokens(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.NOT_APPLICABLE
    assert decision.requires_human_confirmation is False


@pytest.mark.parametrize(
    "text",
    (
        "battery smokehouse software design",
        "battery burnished market report",
        "battery burnout contract review",
        "battery smokestack firmware plan",
        "battery burner market analysis",
    ),
)
def test_neighboring_burn_and_smoke_words_do_not_impersonate_p0(
    text: str,
) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.NOT_APPLICABLE
    assert decision.requires_human_confirmation is False


@pytest.mark.parametrize("hazard", ("smoke", "smoking", "burn", "burning", "burnt"))
def test_bounded_burn_and_smoke_forms_remain_p0(hazard: str) -> None:
    decision = classify_battery_safety(f"battery {hazard}")

    assert decision.level is BatterySafetyLevel.P0
    assert decision.light == BATTERY_SAFETY_LIGHT


@pytest.mark.parametrize(
    ("text", "forbidden_fact"),
    (
        ("battery smokehouse risk", "冒烟"),
        ("battery burnished risk", "起火"),
        ("battery electrolyteleakagenote risk", "泄漏"),
    ),
)
def test_canonical_fact_projection_cannot_exceed_confirmed_hazard_boundaries(
    text: str,
    forbidden_fact: str,
) -> None:
    decision = classify_battery_safety(text)
    decree = canonical_battery_safety_decree(text)
    facts = (
        decree.split("已识别事实：", maxsplit=1)[1]
        .split("；", maxsplit=1)[0]
        .split("、")
    )

    assert decision.level is BatterySafetyLevel.P1
    assert forbidden_fact not in facts


@pytest.mark.parametrize(
    "text",
    (
        "battery explosion",
        "battery explosion risk",
        "battery EXPLOSION",
        "battery explosions",
        "firmware report: battery explosion",
        "market report: cell explosion",
        "contract review: pack explosion",
        "contractor reports BMS explosion",
    ),
)
def test_bounded_english_explosion_is_p0_and_canonical_round_trips(
    text: str,
) -> None:
    decision = classify_battery_safety(text)
    decree = canonical_battery_safety_decree(text)
    validated = assert_battery_safety_decree(decree)
    facts = (
        decree.split("已识别事实：", maxsplit=1)[1]
        .split("；", maxsplit=1)[0]
        .split("、")
    )

    assert decision.level is BatterySafetyLevel.P0
    assert validated.level is BatterySafetyLevel.P0
    assert "爆炸" in facts


def test_all_normalized_separators_inside_explosion_preserve_p0_projection() -> None:
    explicit_separators = {"\u2044", "\u2212", "\u2215"}
    nfkc_separator_outputs = {"-", "/", "_", "·", "•", "・"}
    separators = tuple(
        character
        for codepoint in range(0x110000)
        if (
            (character := chr(codepoint)) in explicit_separators
            or unicodedata.category(character) in {"Cf", "Pd"}
            or unicodedata.normalize("NFKC", character) in nfkc_separator_outputs
        )
    )
    failures = []

    for split_at in range(1, len("explosion")):
        for separator in separators:
            hazard = "explosion"[:split_at] + separator + "explosion"[split_at:]
            source = f"battery firmware market contract review: {hazard}"
            decision = classify_battery_safety(source)
            if decision.level is not BatterySafetyLevel.P0:
                failures.append(
                    (split_at, f"U+{ord(separator):04X}", decision.level.value)
                )
                continue
            decree = canonical_battery_safety_decree(source)
            if assert_battery_safety_decree(decree).level is not BatterySafetyLevel.P0:
                failures.append((split_at, f"U+{ord(separator):04X}", "projection"))

    assert separators
    assert failures == []


@pytest.mark.parametrize(
    "text",
    (
        "battery explosionproof software design",
        "battery explosionnote market report",
        "battery preexplosion contract review",
    ),
)
def test_neighboring_explosion_words_do_not_impersonate_p0(text: str) -> None:
    decision = classify_battery_safety(text)

    assert decision.level is BatterySafetyLevel.NOT_APPLICABLE
    assert decision.requires_human_confirmation is False
