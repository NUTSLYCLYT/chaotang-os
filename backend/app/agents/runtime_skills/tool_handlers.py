from __future__ import annotations

import math
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from statistics import mean, median
from typing import TypeAlias

from app.accounting_reports.semantic_mapping import (
    AccountingContentProjection,
    PublicationReadiness,
)
from app.agents.evidence_protocol import (
    BureauEvidenceToolAdapter,
    verify_bureau_evidence_tool_adapter,
)
from app.agents.runtime_skills.tool_executor import (
    _authorize_tool_handlers_from_trusted_adapters,
)
from app.agents.runtime_skills.tool_models import ToolHandlerContext, ToolName

ApprovedMaterialReader: TypeAlias = Callable[[ToolHandlerContext], Mapping[str, object]]
ApprovedDataReader: TypeAlias = Callable[[ToolHandlerContext], Mapping[str, object]]
EvidenceRequester: TypeAlias = Callable[[ToolHandlerContext], Mapping[str, object]]

_INSPECT_OPERATIONS = frozenset({"describe", "filter", "aggregate", "compare", "top_n", "lookup"})
_MAX_VALUES = 200
_UNITS = frozenset({"count", "score", "CNY", "USD", "HKD", "people", "items", "ratio", "percent"})


class BureauToolHandlerError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _period_key(label: object) -> tuple[int, object]:
    if not isinstance(label, str) or not label.strip():
        raise BureauToolHandlerError("analysis_period_invalid")
    try:
        numeric = float(label)
        if not math.isfinite(numeric):
            raise BureauToolHandlerError("analysis_period_invalid")
        return (0, numeric)
    except ValueError:
        try:
            parsed = datetime.fromisoformat(label.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("timezone_required")
            return (1, parsed.astimezone(UTC))
        except (TypeError, ValueError) as exc:
            raise BureauToolHandlerError("analysis_period_invalid") from exc


def _adapter_handler(
    adapter: Callable[[ToolHandlerContext], Mapping[str, object]],
    *,
    operations: frozenset[str] | None = None,
):
    def handler(context: ToolHandlerContext) -> Mapping[str, object]:
        arguments = context.approved_call.normalized_arguments
        if operations is not None and arguments.get("operation") not in operations:
            raise BureauToolHandlerError("tool_operation_unavailable")
        ref_key = {
            ToolName.READ_APPROVED_MATERIALS: "input_refs",
            ToolName.INSPECT_APPROVED_DATA: "data_ref",
            ToolName.REQUEST_EVIDENCE: None,
        }[context.approved_call.tool_name]
        if ref_key is None:
            selected: list[str] = []
        else:
            raw_refs = arguments.get(ref_key)
            selected = [raw_refs] if isinstance(raw_refs, str) else list(raw_refs or [])
        if any(ref not in context.resolved_approved_inputs for ref in selected):
            raise BureauToolHandlerError("tool_reference_unavailable")
        narrowed = context.model_copy(update={
            "resolved_approved_inputs": {
                ref: context.resolved_approved_inputs[ref] for ref in selected
            }
        })
        if isinstance(adapter, BureauEvidenceToolAdapter) and not (
            verify_bureau_evidence_tool_adapter(
                adapter,
                case_id=context.approved_call.case_id,
                decree_id=context.approved_call.decree_id,
            )
        ):
            raise BureauToolHandlerError("evidence_adapter_invalid")
        return adapter(narrowed)
    return handler


def _numbers(
    context: ToolHandlerContext,
) -> tuple[list[float | int], str, list[Mapping[str, object]]]:
    arguments = context.approved_call.normalized_arguments
    refs = arguments.get("data_refs")
    if not isinstance(refs, list) or not refs or len(refs) > 20:
        raise BureauToolHandlerError("analysis_input_invalid")
    values: list[float | int] = []
    records: list[Mapping[str, object]] = []
    unit: str | None = None
    for ref in refs:
        source = context.resolved_approved_inputs.get(ref)
        if not isinstance(source, Mapping):
            raise BureauToolHandlerError("analysis_input_invalid")
        raw_values = source.get("values")
        raw_records = source.get("records")
        if raw_values is None and isinstance(raw_records, list):
            if any(not isinstance(record, Mapping) for record in raw_records):
                raise BureauToolHandlerError("analysis_input_invalid")
            metric_names = arguments.get("metrics", [])
            if not isinstance(metric_names, list) or len(metric_names) != 1:
                raise BureauToolHandlerError("analysis_metric_invalid")
            metric = metric_names[0]
            raw_values = [record.get(metric) for record in raw_records]
            records.extend(raw_records)
        source_unit = source.get("unit")
        if not isinstance(raw_values, Sequence) or isinstance(raw_values, (str, bytes)):
            raise BureauToolHandlerError("analysis_input_invalid")
        if not isinstance(source_unit, str) or not source_unit.strip():
            raise BureauToolHandlerError("analysis_unit_invalid")
        if source_unit not in _UNITS:
            raise BureauToolHandlerError("analysis_unit_invalid")
        if unit is not None and source_unit != unit:
            raise BureauToolHandlerError("analysis_unit_mismatch")
        unit = source_unit
        values.extend(raw_values)
    if not values or len(values) > _MAX_VALUES:
        raise BureauToolHandlerError("analysis_collection_invalid")
    if any(
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        for value in values
    ):
        raise BureauToolHandlerError("analysis_number_invalid")
    return values, unit or "count", records


def _calculate(
    algorithm: str,
    values: list[float | int],
    thresholds: object,
    *,
    arguments: Mapping[str, object],
    records: list[Mapping[str, object]],
) -> tuple[list[object], str | None]:
    invalid_threshold = (
        not isinstance(thresholds, list)
        or len(thresholds) > 20
        or any(
            isinstance(x, bool)
            or not isinstance(x, (int, float))
            or not math.isfinite(x)
            for x in thresholds
        )
    )
    if invalid_threshold:
        raise BureauToolHandlerError("analysis_threshold_invalid")
    if algorithm == "arithmetic":
        operation = arguments.get("arithmetic_operation")
        if operation == "add":
            return [sum(values)], None
        if operation == "subtract" and len(values) == 2:
            return [values[0] - values[1]], None
        if operation == "multiply":
            return [math.prod(values)], None
        if operation == "divide" and len(values) == 2 and values[1] != 0:
            return [values[0] / values[1]], "ratio"
        raise BureauToolHandlerError("analysis_arithmetic_invalid")
    if algorithm == "percentage":
        if len(values) != 2 or values[1] == 0:
            raise BureauToolHandlerError("analysis_division_invalid")
        return [values[0] / values[1] * 100], "percent"
    if algorithm in {"year_over_year", "period_over_period"}:
        periods = arguments.get("periods")
        if (
            not isinstance(periods, list)
            or len(periods) != 2
            or periods[0] == periods[1]
        ):
            raise BureauToolHandlerError("analysis_period_invalid")
        first_period = _period_key(periods[0])
        second_period = _period_key(periods[1])
        if (
            first_period[0] != second_period[0]
            or not first_period < second_period
        ):
            raise BureauToolHandlerError("analysis_period_invalid")
        if len(values) != 2 or values[0] == 0:
            raise BureauToolHandlerError("analysis_division_invalid")
        return [(values[1] - values[0]) / values[0] * 100], "percent"
    if algorithm == "share":
        total = sum(values)
        if total == 0:
            raise BureauToolHandlerError("analysis_division_invalid")
        return [value / total * 100 for value in values], "percent"
    if algorithm == "difference":
        if len(values) != 2:
            raise BureauToolHandlerError("analysis_length_mismatch")
        return [values[0] - values[1]], None
    if algorithm == "mean":
        return [mean(values)], None
    if algorithm == "median":
        return [median(values)], None
    if algorithm == "extrema":
        return [min(values), max(values)], None
    if algorithm == "rank":
        if records:
            metric = arguments["metrics"][0]  # type: ignore[index]
            ranked = sorted(records, key=lambda row: row[metric], reverse=True)  # type: ignore[index,return-value]
            return [{**row, "rank": index} for index, row in enumerate(ranked, 1)], None
        return sorted(values, reverse=True), None
    if algorithm == "group_summary":
        if records:
            dimensions = arguments.get("dimensions")
            metrics = arguments.get("metrics")
            if (
                not isinstance(dimensions, list)
                or len(dimensions) != 1
                or not isinstance(metrics, list)
                or len(metrics) != 1
            ):
                raise BureauToolHandlerError("analysis_group_invalid")
            dimension, metric = dimensions[0], metrics[0]
            grouped: dict[object, float | int] = {}
            for row in records:
                grouped[row[dimension]] = grouped.get(row[dimension], 0) + row[metric]  # type: ignore[operator]
            return [
                {dimension: group, metric: grouped[group]}
                for group in sorted(grouped, key=str)
            ], None
        return [sum(values), mean(values)], None
    if algorithm == "threshold":
        if len(thresholds) != 1:
            raise BureauToolHandlerError("analysis_threshold_invalid")
        return [value >= thresholds[0] for value in values], None
    if algorithm == "trend":
        if len(values) < 2:
            raise BureauToolHandlerError("analysis_length_mismatch")
        slope = (values[-1] - values[0]) / (len(values) - 1)
        direction = "up" if slope > 0 else "down" if slope < 0 else "flat"
        return [{"points": values, "slope": slope, "direction": direction}], None
    if algorithm == "reconcile":
        if len(values) < 2:
            raise BureauToolHandlerError("analysis_length_mismatch")
        tolerance = arguments.get("tolerance")
        if (
            isinstance(tolerance, bool)
            or not isinstance(tolerance, (int, float))
            or tolerance < 0
        ):
            raise BureauToolHandlerError("analysis_tolerance_invalid")
        difference = values[0] - sum(values[1:])
        return [{
            "total": values[0], "parts_total": sum(values[1:]),
            "difference": difference, "tolerance": tolerance,
            "is_consistent": abs(difference) <= tolerance,
        }], None
    raise BureauToolHandlerError("analysis_algorithm_unsupported")


def _compute_analysis(context: ToolHandlerContext) -> Mapping[str, object]:
    arguments = context.approved_call.normalized_arguments
    algorithm = arguments.get("algorithm_id")
    version = arguments.get("algorithm_version")
    if not isinstance(algorithm, str) or version != "1.0.0":
        raise BureauToolHandlerError("analysis_algorithm_unsupported")
    values, unit, records = _numbers(context)
    result, output_unit = _calculate(
        algorithm, values, arguments.get("thresholds", []),
        arguments=arguments, records=records,
    )
    refs = list(arguments["data_refs"])
    return {
        "result_schema": "analysis_result.v1",
        "data": {
            "algorithm_id": algorithm, "algorithm_version": version,
            "values": result, "units": output_unit or unit,
        },
        "input_refs": [], "evidence_refs": [], "approved_data_refs": refs,
        "data_quality": "SUFFICIENT", "limitations": [],
        "as_of": "1970-01-01T00:00:00Z", "algorithm_id": algorithm,
        "algorithm_version": version,
    }


def _inspect_accounting_content(context: ToolHandlerContext) -> Mapping[str, object]:
    arguments = context.approved_call.normalized_arguments
    if arguments.get("operation") != "inspect_content":
        raise BureauToolHandlerError("tool_operation_unavailable")
    ref = arguments.get("data_ref")
    if not isinstance(ref, str) or ref not in context.resolved_approved_inputs:
        raise BureauToolHandlerError("tool_reference_unavailable")
    try:
        content = AccountingContentProjection.model_validate(
            context.resolved_approved_inputs[ref]
        )
        if not content.system_issued:
            raise ValueError("accounting_content_untrusted")
    except ValueError as exc:
        raise BureauToolHandlerError("accounting_content_invalid") from exc
    readiness = {item.readiness for item in content.mapping_decisions}
    if PublicationReadiness.INFERRED_DRAFT in readiness:
        quality, limitations = "INSUFFICIENT", ["mapping_draft_only"]
    elif PublicationReadiness.DISCLOSED in readiness:
        quality, limitations = "PARTIAL", ["mapping_confidence_disclosed"]
    else:
        quality, limitations = "SUFFICIENT", []
    return {
        "result_schema": "accounting_content_result.v1",
        "data": content.model_dump(mode="json"),
        "input_refs": [],
        "evidence_refs": [],
        "approved_data_refs": [ref],
        "data_quality": quality,
        "limitations": limitations,
        "as_of": "1970-01-01T00:00:00Z",
    }


def build_bureau_tool_handlers(
    *,
    material_reader: ApprovedMaterialReader | None,
    data_reader: ApprovedDataReader | None,
    evidence_requester: EvidenceRequester | None,
) -> object:
    adapters = {
        ToolName.COMPUTE_ANALYSIS: _compute_analysis,
        ToolName.INSPECT_ACCOUNTING_CONTENT: _inspect_accounting_content,
    }
    if material_reader is not None:
        adapters[ToolName.READ_APPROVED_MATERIALS] = _adapter_handler(material_reader)
    if data_reader is not None:
        adapters[ToolName.INSPECT_APPROVED_DATA] = _adapter_handler(
            data_reader, operations=_INSPECT_OPERATIONS
        )
    if evidence_requester is not None:
        if not isinstance(evidence_requester, BureauEvidenceToolAdapter):
            raise ValueError("evidence_adapter_invalid")
        adapters[ToolName.REQUEST_EVIDENCE] = _adapter_handler(evidence_requester)
    return _authorize_tool_handlers_from_trusted_adapters(adapters)
