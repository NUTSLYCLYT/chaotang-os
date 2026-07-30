from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

import app.api.decrees as decrees_api
from app.accounting_reports.models import NormalizedLedgerRow, SourceRef
from app.accounting_reports.session import AccountingReportSession
from app.api.report_artifacts import configure_report_artifact_db
from app.auth import configure_auth_db, create_session, create_user
from app.main import app
from app.shiguan.storage import list_archives


def _row(year: int, category: str, code: str, closing: int) -> NormalizedLedgerRow:
    from decimal import Decimal

    debit_oriented = category in {"asset", "cost", "expense"}
    return NormalizedLedgerRow(
        year=year,
        category=category,
        account_code=code,
        account_name=f"synthetic-{code}",
        opening_debit=Decimal("0"),
        opening_credit=Decimal("0"),
        movement_debit=Decimal(closing if debit_oriented else 0),
        movement_credit=Decimal(0 if debit_oriented else closing),
        closing_debit=Decimal(closing if debit_oriented else 0),
        closing_credit=Decimal(0 if debit_oriented else closing),
        source=SourceRef(
            file_name="synthetic-ledger.xlsx",
            sheet_name="Synthetic",
            row_number=int(code[-1]) + 1,
            file_sha256="a" * 64,
        ),
    )


SYNTHETIC_ROWS = (
    _row(2025, "asset", "1001", 1000),
    _row(2025, "liability", "2001", 400),
    _row(2025, "equity", "3001", 600),
    _row(2025, "revenue", "4001", 500),
    _row(2025, "cost", "5001", 200),
    _row(2025, "expense", "6001", 100),
)


class _AccountingGraph:
    def __init__(self, report_session: AccountingReportSession, route_type: str):
        self.report_session = report_session
        self.route_type = route_type

    def invoke(self, state: dict[str, object]) -> dict[str, object]:
        decree_text = str(state["decree_text"])
        self.report_session.maybe_generate("户部", "会计司", decree_text)
        departments = ["户部"] if self.route_type == "single" else ["户部", "工部"]
        opinions = [
            {
                "department": department,
                "bureau_opinions": [
                    {
                        "bureau": "会计司" if department == "户部" else "营缮司",
                        "opinion": "合成意见",
                    }
                ],
                "opinion": "合成部议",
            }
            for department in departments
        ]
        path = ["上书房", "丞相（首次分流）"]
        if self.route_type == "multi":
            path.append("军机处（召集）")
        for department in departments:
            bureau = "会计司" if department == "户部" else "营缮司"
            path.extend(
                [department, f"{department}·{bureau}", f"{department}（部级补充）"]
            )
        if self.route_type == "multi":
            path.append("军机处（会审）")
        path.append("丞相（最终汇总）")
        return {
            "decree_text": decree_text,
            "chancellor_rationale": "合成分流",
            "route_type": self.route_type,
            "departments": departments,
            "processing_path": path,
            "ministry_opinions": opinions,
            "council_verdict": "合成会审" if self.route_type == "multi" else None,
            "final_verdict": "合成回奏",
            "recommendations": ["核验来源", "复核勾稽", "审阅报告"],
        }


@pytest.mark.parametrize(
    ("route_type", "expected_departments"),
    [("single", ["户部"]), ("multi", ["户部", "工部"])],
)
def test_synthetic_accounting_report_crosses_decree_archive_publish_and_download(
    route_type: str,
    expected_departments: list[str],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    isolate_shiguan_default_db_path,
) -> None:
    del isolate_shiguan_default_db_path
    auth_db = tmp_path / "auth.sqlite3"
    artifact_db = tmp_path / "artifacts.sqlite3"
    configure_auth_db(auth_db)
    owner = create_user(f"owner-{route_type}", f"{route_type}@example.test", "six-or-more")
    other = create_user(f"other-{route_type}", f"other-{route_type}@example.test", "six-or-more")
    owner_headers = {"Authorization": f"Bearer {create_session(owner.id)}"}
    other_headers = {"Authorization": f"Bearer {create_session(other.id)}"}
    sessions: list[AccountingReportSession] = []

    def build_session(*, owner_user_id: str, run_id: str) -> AccountingReportSession:
        session = AccountingReportSession(
            owner_user_id=owner_user_id,
            run_id=run_id,
            source_dir=tmp_path / "synthetic-source",
            artifact_dir=tmp_path / "report_artifacts",
            db_path=artifact_db,
        )
        sessions.append(session)
        return session

    monkeypatch.setattr(decrees_api, "build_accounting_report_session", build_session)
    monkeypatch.setattr(
        "app.accounting_reports.session.load_ledger_rows",
        lambda _source, _period: SYNTHETIC_ROWS,
    )
    monkeypatch.setattr(
        decrees_api,
        "get_chancellor_graph",
        lambda *, report_session: _AccountingGraph(report_session, route_type),
    )
    monkeypatch.setattr(
        decrees_api.draft_authority_registry, "consume", lambda **_kwargs: True
    )

    try:
        with TestClient(app) as client:
            configure_report_artifact_db(artifact_db)
            response = client.post(
                "/api/v1/decrees/chancellor",
                json={"decree_text": "请生成2025年财务报表"},
                headers=owner_headers,
            )
            assert response.status_code == 200
            body = response.json()
            assert body["departments"] == expected_departments
            assert [
                item["department"] for item in body["ministry_opinions"]
            ] == expected_departments
            if route_type == "multi":
                assert body["processing_path"] == [
                    "上书房",
                    "丞相（首次分流）",
                    "军机处（召集）",
                    "户部",
                    "户部·会计司",
                    "户部（部级补充）",
                    "工部",
                    "工部·营缮司",
                    "工部（部级补充）",
                    "军机处（会审）",
                    "丞相（最终汇总）",
                ]
            assert len(body["artifacts"]) == 1
            artifact_id = body["artifacts"][0]["artifact_id"]
            replies = list_archives(type="REPLY", owner_user_id=owner.id)
            assert len(replies) == 1
            assert sessions[0].storage.get_state(artifact_id) == "PUBLISHED"

            owner_download = client.get(
                f"/api/v1/report-artifacts/{artifact_id}/download",
                headers=owner_headers,
            )
            assert owner_download.status_code == 200
            assert (
                client.get(
                    f"/api/v1/report-artifacts/{artifact_id}/download",
                    headers=other_headers,
                ).status_code
                == 404
            )

        workbook = load_workbook(BytesIO(owner_download.content), data_only=False)
        try:
            assert workbook.sheetnames == [
                "管理摘要",
                "核心财务报表",
                "科目趋势",
                "异常分析",
                "科目明细",
                "校验结果",
                "数据来源",
            ]
            core = workbook["核心财务报表"]
            assert core["A2"].value == 2025
            assert core["B2"].value == (
                "=SUMIFS('科目明细'!$L$2:$L$7,'科目明细'!$A$2:$A$7,$A2,"
                "'科目明细'!$N$2:$N$7,\"assets\")-SUMIFS('科目明细'!$M$2:$M$7,"
                "'科目明细'!$A$2:$A$7,$A2,'科目明细'!$N$2:$N$7,\"assets\")"
            )
            assert core["H2"].value == "=E2-F2-G2"
            assert sum(
                int(str(workbook["科目明细"].cell(row, 12).value).lstrip("="))
                for row in range(2, 8)
                if workbook["科目明细"].cell(row, 14).value == "assets"
            ) == 1000
        finally:
            workbook.close()
    finally:
        configure_report_artifact_db(None)
        configure_auth_db(None)
