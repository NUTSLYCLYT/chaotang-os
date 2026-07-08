# tests/test_chaotang_schemas.py
from web.schemas.chaotang import (
    DraftRequest, DraftResponse, DispatchRequest, DispatchResponse,
    ReviewRequest, Budget, CategorySelection,
)


def test_draft_request_min_length():
    import pytest
    with pytest.raises(Exception):
        DraftRequest(rawCommand="")


def test_dispatch_request_defaults():
    r = DispatchRequest(rawCommand="x", selectedCategories=[
        {"taskType": "analysis", "ministers": ["hu_bu"], "groups": ["finlaw"]}])
    assert r.councilAll is False
    assert r.budget is None
    assert r.selectedCategories[0].groups == ["finlaw"]


def test_review_action_validation():
    import pytest
    ReviewRequest(action="approve", comment="ok")
    with pytest.raises(Exception):
        ReviewRequest(action="nope", comment="")


def test_budget_optional_fields():
    b = Budget(maxCalls=50)
    assert b.maxCostUsd is None and b.maxSubagentsPerGroup is None
