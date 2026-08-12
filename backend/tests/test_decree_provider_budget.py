from __future__ import annotations

from app.agents.chancellor_draft.routing import ApprovedRouteSnapshot
from app.api.decrees import provider_request_limit_for_route


def _route(*departments: tuple[str, tuple[str, ...]]) -> ApprovedRouteSnapshot:
    return ApprovedRouteSnapshot.model_validate(
        {
            "departments": [
                {"department": department, "required_bureaus": list(bureaus)}
                for department, bureaus in departments
            ]
        }
    )


def test_single_department_budget_covers_all_bounded_model_attempts() -> None:
    route = _route(("户部", ("会计司",)))

    assert provider_request_limit_for_route(route) == 22


def test_multi_department_budget_includes_serial_council_and_finalization() -> None:
    route = _route(
        ("户部", ("会计司",)),
        ("吏部", ("任免司",)),
    )

    assert provider_request_limit_for_route(route) == 44
