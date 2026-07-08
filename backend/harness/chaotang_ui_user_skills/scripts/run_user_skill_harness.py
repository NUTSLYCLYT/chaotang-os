from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

from web.main import app

DEFAULT_JSON_OUT = ROOT / "artifacts" / "latest.json"
DEFAULT_MD_OUT = ROOT / "artifacts" / "latest.md"

BOARD_EXPECTATIONS = {
    "home": {
        "label": "大殿首页",
        "job": "提交真实任务",
        "action": "开始朝议",
        "evidence": "丞相拟旨",
        "safety": "按原文",
    },
    "work": {
        "label": "军机处执行",
        "job": "查看部门执行和证据",
        "action": "提交御史",
        "evidence": "证据与风险",
        "safety": "回退",
    },
    "report": {
        "label": "朝堂战报",
        "job": "查看结果和下一步",
        "action": "归档史馆",
        "evidence": "御史判词",
        "safety": "不影响评分",
    },
    "yushi": {
        "label": "御史审查",
        "job": "审查风险边界",
        "action": "补证据",
        "evidence": "风险等级",
        "safety": "禁止项",
    },
    "shiguan": {
        "label": "史馆归档",
        "job": "沉淀可复用记忆",
        "action": "复用模板",
        "evidence": "学习变化",
        "safety": "等待归档",
    },
}

USER_SEGMENTS = {
    "企业家": "下一步",
    "AI 爱好者": "证据",
    "AI 极客": "payload",
}

USER_SKILLS = {
    "企业家": PROJECT_ROOT / "skills" / "chaotang_user_modes" / "xiaobai" / "SKILL.md",
    "AI 爱好者": PROJECT_ROOT / "skills" / "chaotang_user_modes" / "senior_hobbyist" / "SKILL.md",
    "AI 极客": PROJECT_ROOT / "skills" / "chaotang_user_modes" / "geek_expert" / "SKILL.md",
}


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def check_contains(text: str, expected: dict[str, str]) -> list[str]:
    issues = []
    for field, needle in expected.items():
        if field == "job":
            continue
        if needle and needle not in text:
            issues.append(f"missing:{field}:{needle}")
    return issues


def build_report() -> dict[str, Any]:
    client = TestClient(app)
    html = client.get("/chaotang-ui").text
    state = client.get("/chaotang-ui/state").json()["data"]
    evaluation = state.get("experience_evaluation", {})
    segment_rows = evaluation.get("user_segments", [])
    segment_text = json.dumps(segment_rows, ensure_ascii=False)
    suggestion_confirmation_needles = (
        "modeSuggestion",
        "钦天监建议确认",
        "确认切换",
        "暂不切换",
        "suggestUserMode",
        "confirmUserModeSuggestion",
        "dismissUserModeSuggestion",
    )
    suggestion_issues = [
        f"missing_confirmation_signal:{needle}"
        for needle in suggestion_confirmation_needles
        if needle not in html
    ]

    board_results = []
    for board, expected in BOARD_EXPECTATIONS.items():
        issues = check_contains(html, expected)
        board_results.append(
            {
                "board": board,
                "label": expected["label"],
                "job": expected["job"],
                "passed": not issues,
                "issues": issues,
            }
        )

    segment_results = []
    for segment, needle in USER_SEGMENTS.items():
        issues = []
        if segment not in segment_text:
            issues.append(f"missing_segment:{segment}")
        if needle not in segment_text and needle not in html:
            issues.append(f"missing_skill_signal:{needle}")
        segment_results.append(
            {
                "segment": segment,
                "passed": not issues,
                "issues": issues,
            }
        )

    skill_results = []
    for segment, path in USER_SKILLS.items():
        issues = []
        if not path.exists():
            issues.append("missing_skill_file")
        else:
            text = path.read_text(encoding="utf-8")
            for needle in ("用户目标", "默认可见", "主动作", "验收"):
                if needle not in text:
                    issues.append(f"missing:{needle}")
            if segment not in text:
                issues.append(f"missing_segment_name:{segment}")
        skill_results.append({"segment": segment, "path": str(path.relative_to(PROJECT_ROOT)), "passed": not issues, "issues": issues})

    interaction = client.post(
        "/chaotang-ui/prime-minister-draft",
        json={
            "task": "请兵部负责销售和售后，调动蜂群输出客户跟进方案。",
            "mode": "beginner",
            "emperor_style": "qinzheng",
            "depth": "standard",
        },
    ).json()
    interaction_issues = []
    if not interaction.get("success"):
        interaction_issues.append("prime_minister_draft.failed")
    else:
        data = interaction["data"]
        if "按丞相拟旨下旨" not in json.dumps(data, ensure_ascii=False):
            interaction_issues.append("prime_minister_draft.missing_choice")
        if "可路由、可审查、可归档" not in json.dumps(data, ensure_ascii=False):
            interaction_issues.append("prime_minister_draft.missing_routeable_language")

    passed = (
        all(item["passed"] for item in board_results)
        and all(item["passed"] for item in segment_results)
        and all(item["passed"] for item in skill_results)
        and not suggestion_issues
        and not interaction_issues
    )
    return {
        "generated_at": utc_now(),
        "passed": passed,
        "summary": {
            "boards": len(board_results),
            "boards_passed": sum(1 for item in board_results if item["passed"]),
            "segments": len(segment_results),
            "segments_passed": sum(1 for item in segment_results if item["passed"]),
            "skills": len(skill_results),
            "skills_passed": sum(1 for item in skill_results if item["passed"]),
            "suggestion_confirmation_ready": not suggestion_issues,
            "suggestion_issues": len(suggestion_issues),
            "interaction_issues": len(interaction_issues),
        },
        "board_results": board_results,
        "segment_results": segment_results,
        "skill_results": skill_results,
        "suggestion_issues": suggestion_issues,
        "interaction_issues": interaction_issues,
    }


def write_markdown(report: dict[str, Any], path: Path) -> None:
    lines = [
        "# Chaotang UI User Skill Harness",
        "",
        f"- passed: {report['passed']}",
        f"- boards: {report['summary']['boards_passed']}/{report['summary']['boards']}",
        f"- user segments: {report['summary']['segments_passed']}/{report['summary']['segments']}",
        f"- user skills: {report['summary']['skills_passed']}/{report['summary']['skills']}",
        f"- suggestion confirmation: {report['summary']['suggestion_confirmation_ready']}",
        "",
        "## Boards",
    ]
    for item in report["board_results"]:
        mark = "PASS" if item["passed"] else "FAIL"
        lines.append(f"- {mark} {item['label']} ({item['job']}): {', '.join(item['issues']) or 'ok'}")
    lines.extend(["", "## User Segments"])
    for item in report["segment_results"]:
        mark = "PASS" if item["passed"] else "FAIL"
        lines.append(f"- {mark} {item['segment']}: {', '.join(item['issues']) or 'ok'}")
    lines.extend(["", "## User Skills"])
    for item in report["skill_results"]:
        mark = "PASS" if item["passed"] else "FAIL"
        lines.append(f"- {mark} {item['segment']} {item['path']}: {', '.join(item['issues']) or 'ok'}")
    if report["suggestion_issues"]:
        lines.extend(["", "## Suggestion Confirmation Issues"])
        lines.extend(f"- {issue}" for issue in report["suggestion_issues"])
    if report["interaction_issues"]:
        lines.extend(["", "## Interaction Issues"])
        lines.extend(f"- {issue}" for issue in report["interaction_issues"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=DEFAULT_MD_OUT)
    args = parser.parse_args()

    report = build_report()
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(report, args.md_out)
    print(f"chaotang_ui_user_skills complete: passed={report['passed']}, summary={report['summary']}")
    print(f"json: {args.json_out}")
    print(f"markdown: {args.md_out}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
