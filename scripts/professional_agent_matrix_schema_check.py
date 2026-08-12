#!/usr/bin/env python3
"""Validate the professional Agent matrix with JSON Schema Draft 2020-12."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError


def main() -> int:
    if len(sys.argv) != 3:
        print(json.dumps({"decision": "STOP", "reason": "UNSUPPORTED_COMMAND"}))
        return 64

    schema_path, matrix_path = (Path(value) for value in sys.argv[1:])
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        errors = sorted(
            Draft202012Validator(schema).iter_errors(matrix),
            key=lambda error: tuple(str(part) for part in error.absolute_path),
        )
    except (OSError, ValueError, SchemaError) as error:
        print(json.dumps({"decision": "FAIL", "reason": "INVALID_SCHEMA", "detail": str(error)}))
        return 1

    if errors:
        print(
            json.dumps(
                {
                    "decision": "FAIL",
                    "reason": "SCHEMA_VALIDATION_FAILED",
                    "errors": [
                        {
                            "path": "/".join(str(part) for part in error.absolute_path),
                            "message": error.message,
                        }
                        for error in errors
                    ],
                },
                ensure_ascii=False,
            )
        )
        return 1

    print(json.dumps({"decision": "PASS", "draft": "2020-12"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
