"""Tests for ``app.agents.structured_output.parse_strict_json_object``.

Fully offline: pure-Python parsing/validation logic, no model calls, no
environment variables, no network access.
"""

from __future__ import annotations

import pytest

from app.agents.structured_output import StructuredOutputError, parse_strict_json_object


def test_parses_plain_json_object():
    result = parse_strict_json_object('{"opinion": "准奏"}')
    assert result == {"opinion": "准奏"}


def test_strips_leading_and_trailing_whitespace():
    result = parse_strict_json_object('  \n  {"opinion": "准奏"}  \n  ')
    assert result == {"opinion": "准奏"}


def test_unwraps_json_labeled_code_fence():
    raw = '```json\n{"opinion": "准奏"}\n```'
    result = parse_strict_json_object(raw)
    assert result == {"opinion": "准奏"}


def test_unwraps_plain_code_fence_without_json_label():
    raw = '```\n{"opinion": "准奏"}\n```'
    result = parse_strict_json_object(raw)
    assert result == {"opinion": "准奏"}


def test_unwraps_code_fence_with_surrounding_whitespace():
    raw = '  \n```json\n{"opinion": "准奏"}\n```\n  '
    result = parse_strict_json_object(raw)
    assert result == {"opinion": "准奏"}


def test_rejects_non_string_input():
    with pytest.raises(StructuredOutputError):
        parse_strict_json_object(None)  # type: ignore[arg-type]


def test_rejects_invalid_json():
    with pytest.raises(StructuredOutputError):
        parse_strict_json_object("not json at all")


def test_rejects_truncated_json():
    with pytest.raises(StructuredOutputError):
        parse_strict_json_object('{"opinion": "准奏"')


@pytest.mark.parametrize(
    "raw",
    [
        "[1, 2, 3]",
        '"just a string"',
        "42",
        "null",
        "true",
    ],
)
def test_rejects_non_object_json_values(raw):
    with pytest.raises(StructuredOutputError):
        parse_strict_json_object(raw)


def test_rejects_leading_prose_before_json():
    with pytest.raises(StructuredOutputError):
        parse_strict_json_object('Here is my answer: {"opinion": "准奏"}')


def test_rejects_trailing_prose_after_json():
    with pytest.raises(StructuredOutputError):
        parse_strict_json_object('{"opinion": "准奏"} -- that is my final answer.')


def test_rejects_multiple_json_values_concatenated():
    with pytest.raises(StructuredOutputError):
        parse_strict_json_object('{"opinion": "a"}{"opinion": "b"}')


def test_error_message_never_leaks_raw_model_output():
    leaking_marker = "sk-structured-output-adversarial-should-not-leak-24680"
    raw = f"not json, but contains {leaking_marker}"

    with pytest.raises(StructuredOutputError) as exc_info:
        parse_strict_json_object(raw)

    assert leaking_marker not in str(exc_info.value)


def test_error_preserves_json_decode_error_as_cause():
    with pytest.raises(StructuredOutputError) as exc_info:
        parse_strict_json_object("not json at all")

    assert isinstance(exc_info.value.__cause__, ValueError)
