"""Strict scene input boundaries independent of HTTP and persistence."""

import math

import pytest
from pydantic import ValidationError

from app.scene_packs import storage
from app.scene_packs.models import SceneRunInput

_TEXT_INPUTS = [
    (seed["slug"], field)
    for seed in storage._SCENE_PACK_SEEDS
    for field in seed["required_inputs"] + seed["optional_inputs"]
    if field not in {"attachments", "targetMarkets", "products", "topProblems", "threeMonthMetrics"}
] + [("b2b-inquiry-conversion", field) for field in ("inquiryTime", "applicationScenario")]


@pytest.mark.parametrize("slug,field", _TEXT_INPUTS)
@pytest.mark.parametrize("bad", [None, True, 12, 1.5, {}, [], ["text"]])
def test_text_fields_do_not_coerce(slug, field, bad):
    with pytest.raises(ValidationError):
        SceneRunInput(pack_slug=slug, inputs={field: bad})


@pytest.mark.parametrize("bad", ["false", "true", 0, 1, None, {}, []])
def test_demo_requires_boolean(bad):
    with pytest.raises(ValidationError):
        SceneRunInput(pack_slug="proposal-quotation-tender", demo=bad)


@pytest.mark.parametrize(
    "inputs",
    [
        {"projectName": "x" * 121},
        {"customerRequirement": "x" * 20001},
        {"budget": "x" * 2001},
        {"unknown": "value"},
        {"attachments": [{"name": "fake"}]},
    ],
)
def test_unknown_and_oversize_inputs_rejected(inputs):
    with pytest.raises(ValidationError):
        SceneRunInput(pack_slug="proposal-quotation-tender", inputs=inputs)


@pytest.mark.parametrize("bad", [None, "EU", [None], [1], [[]], [{}], ["x" * 201], ["a"] * 31])
def test_growth_list_boundary(bad):
    for key in ("targetMarkets", "products", "topProblems"):
        with pytest.raises(ValidationError):
            SceneRunInput(pack_slug="enterprise-growth-diagnosis", inputs={key: bad})


@pytest.mark.parametrize(
    "bad",
    [
        True,
        None,
        [],
        {},
        "",
        " ",
        "NaN",
        "Infinity",
        "1e9999",
        "12%%",
        "1 2",
        "1_000",
        math.nan,
        math.inf,
        -math.inf,
        10**400,
    ],
)
@pytest.mark.parametrize("key", ["profitMargin", "conversionRate", "cashflow"])
def test_nonfinite_and_malformed_metrics_rejected(bad, key):
    with pytest.raises(ValidationError):
        SceneRunInput(
            pack_slug="enterprise-growth-diagnosis",
            inputs={"threeMonthMetrics": {key: bad}},
        )


@pytest.mark.parametrize(
    "metrics", [{"cashflow": "2%"}, {"conversionRate": -1}, {"conversionRate": 101}, {"unknown": 1}]
)
def test_metric_semantics(metrics):
    with pytest.raises(ValidationError):
        SceneRunInput(
            pack_slug="enterprise-growth-diagnosis", inputs={"threeMonthMetrics": metrics}
        )


def test_legal_zero_negative_and_decimal_strings():
    metrics = {"profitMargin": " -200% ", "conversionRate": " 0% ", "cashflow": " -1.2e3 "}
    result = SceneRunInput(
        pack_slug="enterprise-growth-diagnosis", inputs={"threeMonthMetrics": metrics}
    )
    assert result.inputs["threeMonthMetrics"] == {
        "profitMargin": -200,
        "conversionRate": 0,
        "cashflow": -1200,
    }


def test_storage_revalidates_constructed_and_copied_input_before_database(tmp_path):
    db = tmp_path / "must-not-create.sqlite3"
    original = SceneRunInput(pack_slug="proposal-quotation-tender")
    for payload in [
        original.model_copy(update={"inputs": {"projectName": {}}}),
        SceneRunInput.model_construct(
            pack_slug="proposal-quotation-tender", inputs={}, attachments=[], demo="false"
        ),
    ]:
        with pytest.raises(ValidationError):
            storage.create_scene_run(payload, owner_user_id="test", tenant_id="test", db_path=db)
        assert not db.exists()


def test_registry_fields_and_legacy_empty_attachment_compatibility():
    for seed in storage._SCENE_PACK_SEEDS:
        fields = {key: "" for key in seed["required_inputs"] + seed["optional_inputs"]}
        fields["attachments"] = []
        if seed["slug"] == "enterprise-growth-diagnosis":
            fields.update(targetMarkets=[], products=[], topProblems=[], threeMonthMetrics={})
        SceneRunInput(pack_slug=seed["slug"], inputs=fields)
    SceneRunInput(
        pack_slug="b2b-inquiry-conversion",
        inputs={"inquiryTime": "today", "applicationScenario": "test"},
    )


@pytest.mark.parametrize(
    "field,limit",
    [("projectName", 120), ("customerRequirement", 20000), ("rfqFile", 20000), ("budget", 2000)],
)
def test_text_codepoint_boundaries_preserve_material(field, limit):
    material = "😀" * limit
    assert (
        SceneRunInput(pack_slug="proposal-quotation-tender", inputs={field: material}).inputs[field]
        == material
    )
    with pytest.raises(ValidationError):
        SceneRunInput(pack_slug="proposal-quotation-tender", inputs={field: material + "x"})


def test_nonempty_attachments_and_bad_unicode_rejected():
    with pytest.raises(ValidationError):
        SceneRunInput(pack_slug="proposal-quotation-tender", attachments=[{"name": "fake"}])
    with pytest.raises(ValidationError):
        SceneRunInput(pack_slug="proposal-quotation-tender", inputs={"projectName": "\ud800"})
