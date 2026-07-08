from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PROMPT_DIR = ROOT / "runtime_prompts"


def read_prompt(agent: str, filename: str) -> str:
    return (PROMPT_DIR / agent / filename).read_text(encoding="utf-8")


def test_legal_review_requires_fact_ids_and_non_opinion_disclaimer():
    text = "\n".join(
        [
            read_prompt("legal_review", "SOUL.md"),
            read_prompt("legal_review", "AGENTS.md"),
            read_prompt("legal_review", "USER.md"),
        ]
    )

    assert "不构成正式法律意见" in text
    assert "事实编号" in text
    assert "F1" in text
    assert "预测口径冲突" in text
    assert "截止时间" in text
    assert "T+N工作日" in text
    assert "F5=35%" in text
    assert "不得改写事实编号中的数字" in text


def test_contract_counsel_blocks_unsupported_penalty_numbers():
    text = "\n".join(
        [
            read_prompt("contract_counsel", "SOUL.md"),
            read_prompt("contract_counsel", "AGENTS.md"),
            read_prompt("contract_counsel", "USER.md"),
        ]
    )

    assert "不得编造违约金比例" in text
    assert "依据待核" in text
    assert "2046" in text
    assert "3000" in text
    assert "万分之五" in text
    assert "不得把任一冲突数字写入业绩承诺" in text
    assert "差额补足50%" in text
    assert "5%-15%" in text


def test_legal_compliance_forbids_fake_owner_names():
    text = "\n".join(
        [
            read_prompt("legal_compliance", "SOUL.md"),
            read_prompt("legal_compliance", "AGENTS.md"),
            read_prompt("legal_compliance", "USER.md"),
        ]
    )

    assert "禁止虚构责任人姓名" in text
    assert "待指定 owner" in text
    assert "审签" in text
    assert "归档" in text
    assert "唯一责任角色" in text
    assert "验收证据" in text
    assert "T+3工作日" in text


def test_legal_qa_accepts_execution_checklist_as_risk_mitigation():
    text = (ROOT / "src" / "prompts_qa_domain.py").read_text(encoding="utf-8")

    assert "风险识别清单" in text
    assert "落地清单" in text
    assert "待指定 owner：财务负责人" in text
    assert "T+N工作日本身即为合格截止时间" in text
    assert "发现无依据编造比例" in text
    assert "事实数字被改写即 FAIL" in text
    assert "F5=35%" in text
    assert "C10 对外发布闸门可见性核查" in text
    assert "不得对外发布" in text
    assert "审签" in text
    assert "归档" in text
    assert "复核" in text
